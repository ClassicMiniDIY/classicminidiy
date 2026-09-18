/**
 * The TypeSafe switches and the event mirror behind `/admin/typesafe`.
 *
 * Every surface's mode used to be a Worker env value alone. It is now a
 * `platform_settings` row first (`typesafe_<surface>_mode`, written only by
 * the private repo's `set_typesafe_mode()`), with the env as the fallback
 * when no row exists. A present row wins, so the admin page can flip a
 * surface without a secret write; an absent row changes nothing. Rows are
 * read together, cached a minute per isolate, and a failed read keeps the
 * last good values (the same posture as `loadScreenSettings`).
 *
 * The mirror: the events the readout needs are written to `typesafe_events`
 * beside the PostHog capture, through a per-event allowlist so only numbers,
 * enums and ids leave the Worker. Text never does: not the message, not the
 * query, not the state. Design: the private repo's typesafe readout doc.
 */
import type { H3Event } from 'h3';
import { serverRuntimeConfig } from './runtimeConfig';
import { getServiceClient } from './supabase';
import type { Json } from '~~/types/database';

export const TYPESAFE_SURFACES = ['chat', 'models', 'search', 'queue', 'mcp'] as const;
export type TypeSafeSurface = (typeof TYPESAFE_SURFACES)[number];

const SETTING_KEY: Record<TypeSafeSurface, string> = {
  chat: 'typesafe_chat_mode',
  models: 'typesafe_models_mode',
  search: 'typesafe_search_mode',
  queue: 'typesafe_queue_mode',
  mcp: 'typesafe_mcp_mode',
};
const ENV_KEY: Record<TypeSafeSurface, string> = {
  chat: 'TYPESAFE_CHAT_MODE',
  models: 'TYPESAFE_MODELS_MODE',
  search: 'TYPESAFE_SEARCH_MODE',
  queue: 'TYPESAFE_QUEUE_MODE',
  mcp: 'TYPESAFE_MCP_MODE',
};

export function typesafeSettingKey(surface: TypeSafeSurface): string {
  return SETTING_KEY[surface];
}

const TTL_MS = 60_000;
let cache: { at: number; rows: Map<string, string> } | null = null;

async function loadRows(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.rows;
  try {
    const { data, error } = await getServiceClient()
      .from('platform_settings')
      .select('key, value')
      .in('key', Object.values(SETTING_KEY));
    if (error) throw error;
    const rows = new Map<string, string>();
    for (const r of data ?? []) if (typeof r.value === 'string') rows.set(r.key, r.value);
    cache = { at: now, rows };
  } catch (e) {
    console.warn(
      `[typesafe] platform_settings read failed; keeping ${cache ? 'the last values' : 'the env'} for a minute:`,
      e instanceof Error ? e.message : String(e)
    );
    cache = { at: now, rows: cache?.rows ?? new Map() };
  }
  return cache.rows;
}

/** The env value alone, normalised. */
export function typesafeEnvMode(event: H3Event, surface: TypeSafeSurface): string {
  const raw = (serverRuntimeConfig(event)[ENV_KEY[surface]] as string) || '';
  return raw.trim().toLowerCase() || 'off';
}

/** The effective mode: the settings row when present, else the env. Never throws. */
export async function typesafeMode(event: H3Event, surface: TypeSafeSurface): Promise<string> {
  const rows = await loadRows();
  const row = rows.get(SETTING_KEY[surface]);
  return (row ?? '').trim().toLowerCase() || typesafeEnvMode(event, surface);
}

/** Test and admin seam. */
export function _resetTypesafeModesCache(): void {
  cache = null;
}

/**
 * Per-event property allowlist for the mirror. An event not listed here is
 * not mirrored; a property not listed is dropped. Adding a text property is
 * the one change this file must refuse.
 */
const MIRRORED: Record<string, readonly string[]> = {
  typesafe_call: ['caller', 'model', 'questions', 'input_tokens', 'output_tokens', 'duration_ms'],
  chat_run_completed: [
    'outcome',
    'tools_called',
    'tool_call_count',
    'entry_point',
    'client',
    'classifier',
    'classifier_ms',
    'classified_tier',
    'classified_tier_confidence',
    'classified_tool',
    'classified_tool_p',
    'classified_tool_only',
    'classified_safety_critical',
    'classified_about_mini',
  ],
  search_intent_shadow: [
    'outcome',
    'regex_kind',
    'model_kind',
    'model_kind_p',
    'regex_lead',
    'model_lead',
    'model_lead_p',
    'agree_kind',
    'agree_lead',
    'duration_ms',
  ],
  mcp_related_pick: ['tool', 'rows', 'picked', 'p', 'duration_ms'],
  contact_seller_screened: ['mode', 'decision', 'tags', 'duration_ms'],
  wanted_post_screened: ['mode', 'decision', 'tags', 'held', 'duration_ms'],
};

export function mirroredProps(name: string, properties: Record<string, unknown>): Record<string, unknown> | null {
  const keys = MIRRORED[name];
  if (!keys) return null;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (properties[k] !== undefined) out[k] = properties[k];
  return out;
}

/** Insert one mirrored event; backgrounded through `waitUntil`, never throws. */
export function mirrorTypesafeEvent(event: H3Event, name: string, properties: Record<string, unknown>): void {
  const props = mirroredProps(name, properties);
  if (!props) return;
  try {
    const send = Promise.resolve(
      getServiceClient()
        .from('typesafe_events')
        .insert({ source: 'worker', event: name, props: props as Json })
    ).then(({ error }) => {
      if (error) console.warn(`[typesafe] event mirror failed for ${name}:`, error.message);
    });
    (event as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil?.(send);
  } catch {
    // swallowed on purpose
  }
}
