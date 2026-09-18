/**
 * The near-miss pick: when a table lookup's `related` list holds two or more
 * rows, one TypeSafe Choice says which of them the query was most likely
 * asking about. A hint field beside the list, never a filter on it.
 *
 * `lookup()` in mcpLookup.ts stays synchronous and pure; this runs after it,
 * only on the near-miss path (already gated to narrow queries), only when the
 * handler was given a request event (the `/mcp` tiering plugin and the chat
 * bridge both pass one), and only when `TYPESAFE_MCP_MODE` is `on`. Every
 * other case is `null`, and the tool answers exactly as it did before.
 * Design: the private repo's TypeSafe phase 5 doc.
 */
import type { H3Event } from 'h3';
import { askTypeSafe, choice, typesafeConfigured } from './typesafe';
import { serverRuntimeConfig } from './runtimeConfig';
import { captureServerEvent } from './chatUsage';
import type { LookupRelated } from './mcpLookup';

export const RELATED_PICK_CEILING_MS = 700;
/** Below this the model is guessing between rows, and a guess is worse than the plain list. */
export const RELATED_PICK_MIN = 0.5;

export interface RelatedPick {
  /** Index into `related`. */
  index: number;
  p: number;
}

/**
 * The request event a tool's MCP context may carry. `extra` is the toolkit's
 * `McpRequestExtra` on `/mcp` (the tiering plugin adds `event`) and the chat
 * bridge's proxy in-process (which lets only `event` through), so it is read
 * loosely and anything that is not an object yields undefined.
 */
export function eventFromExtra(extra: unknown): H3Event | undefined {
  if (!extra || typeof extra !== 'object') return undefined;
  const event = (extra as { event?: unknown }).event;
  return event && typeof event === 'object' ? (event as H3Event) : undefined;
}

export function mcpPickEnabled(event: H3Event | undefined): event is H3Event {
  if (!event) return false;
  const raw = (serverRuntimeConfig(event).TYPESAFE_MCP_MODE as string) || '';
  return raw.trim().toLowerCase() === 'on' && typesafeConfigured(event);
}

/** One line per row: section, then the item's fields as `key: value`, clipped. */
function describeRow(row: LookupRelated): string {
  const fields = Object.entries(row.item)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join('; ');
  return `[${row.sectionTitle}] ${fields}`.slice(0, 400);
}

export function buildPickRequest(subject: string, query: string, related: LookupRelated[]) {
  const options: Record<string, string> = {};
  related.forEach((row, i) => {
    options[String(i)] = `${describeRow(row)} (the query word this row lacks: "${row.excludedBy}")`;
  });
  options.none = `None of the rows is the ${subject} the query is asking about.`;
  return {
    state: {
      query,
      context: `A caller searched a classic Mini reference table for a ${subject} with \`query\`. Every word had to match, and no row did; these rows matched every word but one. The same ${subject} is often named differently between engine or model variants.`,
    },
    questions: {
      pick: choice(
        `Which row is the ${subject} that \`query\` is asking about, reading the row's own fields rather than the missing word? Pick \`none\` unless one row clearly fits.`,
        options
      ),
    },
  };
}

/**
 * Never throws. `null` means no pick: off, no event, fewer than two rows, the
 * ceiling, an error, `none`, or a choice under `RELATED_PICK_MIN`.
 */
export async function pickRelated(
  event: H3Event | undefined,
  tool: string,
  subject: string,
  query: string | undefined,
  related: LookupRelated[]
): Promise<RelatedPick | null> {
  if (!query || related.length < 2 || !mcpPickEnabled(event)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RELATED_PICK_CEILING_MS);
  try {
    const { state, questions } = buildPickRequest(subject, query, related);
    const answer = await askTypeSafe(event, state, questions, {
      caller: 'mcp-related-pick',
      signal: controller.signal,
      retry: { maxRetries: 0 },
    });
    const raw = answer.answers.pick.choice;
    const index = /^\d+$/.test(raw) ? Number(raw) : -1;
    const p = Math.round(answer.answers.pick.confidence * 1000) / 1000;
    const pick = index >= 0 && index < related.length && p >= RELATED_PICK_MIN ? { index, p } : null;
    captureServerEvent(event, 'mcp_related_pick', `mcp:${tool}`, {
      $process_person_profile: false,
      tool,
      rows: related.length,
      picked: pick !== null,
      p,
      duration_ms: answer.durationMs,
    });
    return pick;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The sentence added to `relatedNote` when there is a pick. */
export function relatedPickNote(pick: RelatedPick | null, related: LookupRelated[]): string | undefined {
  if (!pick) return undefined;
  const row = related[pick.index];
  if (!row) return undefined;
  const name = String(row.item.name ?? row.item.component ?? row.item.fastener ?? row.item.model ?? '').trim();
  return (
    `\`relatedPick\` names the near-miss a classifier read as the one asked about` +
    (name ? ` (${name})` : '') +
    ` at ${pick.p.toFixed(2)}; it is a hint to check first, not a replacement for reading the row's notes.`
  );
}
