/**
 * The TypeSafe read of "is this 3D model a safety-critical part".
 *
 * The legal review left server-side safety flagging open: the strong
 * disclaimer and the download interstitial hang off a seller checkbox. This
 * asks one Noul at creation and on any edit of title, description or
 * category, and writes P(safety-critical) to `models.safety_model_p` through
 * the service client (the column is guarded against owner writes in the
 * database). Then `safety_critical OR safety_model_p >= SAFETY_MODEL_MIN`
 * drives the disclaimer: the model only ever ADDS caution, and never writes
 * `safety_critical` itself, which stays the human's flag.
 *
 * Off by default: `TYPESAFE_MODELS_MODE` (`NUXT_TYPESAFE_MODELS_MODE`) must be
 * `on`. Never throws; a failed read leaves the column as it was, and a route
 * never waits on it beyond the ceiling.
 */
import type { H3Event } from 'h3';
import { askTypeSafe, noul, typesafeConfigured } from '../typesafe';
import { serverRuntimeConfig } from '../runtimeConfig';
import { getServiceClient } from '../supabase';

/** Threshold at which the model's read alone shows the strong disclaimer. */
export const SAFETY_MODEL_MIN = 0.7;
const CEILING_MS = 1500;

export function modelsSafetyReadEnabled(event: H3Event): boolean {
  const raw = (serverRuntimeConfig(event).TYPESAFE_MODELS_MODE as string) || '';
  return raw.trim().toLowerCase() === 'on' && typesafeConfigured(event);
}

/** True when either the seller's flag or the model's read says the part is safety-critical. */
export function isSafetyCritical(flag: boolean | null | undefined, modelP: number | null | undefined): boolean {
  return Boolean(flag) || (typeof modelP === 'number' && modelP >= SAFETY_MODEL_MIN);
}

export function buildSafetyQuestion() {
  return {
    safety_critical: noul(
      'Is the part described by `title`, `description` and `category` one whose failure on the road could hurt someone: a part that carries load, or belongs to the brake, steering, suspension, structural, wheel, or fuel system of a classic Mini?',
      {
        true: 'A brake, steering, suspension, subframe, chassis, wheel, hub, fuel, or other load-bearing or road-safety part, or a bracket, mount or fastener for one.',
        false:
          'Trim, interior, badges, tools, jigs, cosmetic covers, electrical housings, storage, display pieces, or anything whose failure is an inconvenience, not a danger.',
      }
    ),
  };
}

/**
 * Read one model and write the score. Fire-and-forget from a route: the
 * caller does not await the write to answer the request.
 */
export async function readModelSafety(
  event: H3Event,
  modelId: string,
  fields: { title: string; description?: string | null; category?: string | null }
): Promise<{ p: number; model: string } | null> {
  if (!modelsSafetyReadEnabled(event)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CEILING_MS);
  try {
    const answer = await askTypeSafe(
      event,
      {
        title: fields.title.slice(0, 200),
        description: (fields.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 2000),
        category: fields.category ?? '',
      },
      buildSafetyQuestion(),
      { caller: 'model-safety', signal: controller.signal, retry: { maxRetries: 0 } }
    );
    const p = Math.round(answer.answers.safety_critical.noul * 1000) / 1000;
    const { error } = await getServiceClient()
      .from('models')
      .update({ safety_model_p: p, safety_model_version: answer.model, safety_model_at: new Date().toISOString() })
      .eq('id', modelId);
    if (error) {
      console.warn('[model-safety] write failed:', error.message);
      return null;
    }
    console.log(JSON.stringify({ event: 'model_safety_read', model_id: modelId, p, model: answer.model }));
    return { p, model: answer.model };
  } catch (e) {
    if (!controller.signal.aborted) {
      console.warn('[model-safety] read failed:', e instanceof Error ? e.message : String(e));
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
