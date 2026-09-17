/**
 * TypeSafe (Jev) client for the Worker.
 *
 * TypeSafe answers typed questions over a piece of state: a Choice picks one
 * of a defined set, a Noul returns P(yes), a Score places the state on
 * described levels. It generates no text. Here it makes the small judgments
 * around the chat model, never in place of it. Rules, enforced in this file
 * because it is the only place they can be:
 *
 *   - The key is `TYPESAFE_API_KEY` in runtimeConfig, fed by the runtime secret
 *     `NUXT_TYPESAFE_API_KEY`. Never public runtimeConfig, never read from
 *     `app/`. An absent runtimeConfig value is `''`, so `typesafeConfigured`
 *     is an explicit check and every caller degrades to "no judgment" rather
 *     than to an error.
 *   - The model is an EXACT id, never the `jev-latest` alias. The API echoes
 *     the id it was asked for, so an alias would be stored beside every
 *     judgment and a model upgrade would be invisible. Bumping TYPESAFE_MODEL
 *     is a deliberate change.
 *   - Every call is metered: a `typesafe_call` event with the caller, the
 *     question count, the tokens and the wall time, sent the same way chat
 *     usage is (backgrounded, swallowed), so a surface's cost is visible per
 *     phase without TypeSafe's dashboard.
 *
 * The SDK has no runtime dependencies and uses global `fetch`, so it bundles
 * for Workers unchanged. Exact version pin in package.json.
 */
import type { H3Event } from 'h3';
import { TypeSafeClient, type Questions, type SystemOneResult } from '@typesafe-ai/sdk';
import { serverRuntimeConfig } from './runtimeConfig';
import { captureServerEvent } from './chatUsage';

export { choice, noul, score } from '@typesafe-ai/sdk';
export type { ChoiceResponse, NoulResponse, Questions, ScoreResponse } from '@typesafe-ai/sdk';

export const TYPESAFE_MODEL = 'jev-1.13.0';
const ALIASES = new Set(['jev-latest', 'jev-preview']);

export interface TypeSafeAnswer<Q extends Questions> {
  answers: SystemOneResult<Q>['answers'];
  /** The exact model id the request was answered with. */
  model: string;
  inputTokens: number;
  durationMs: number;
}

export function typesafeConfigured(event: H3Event): boolean {
  return Boolean(((serverRuntimeConfig(event).TYPESAFE_API_KEY as string) || '').trim());
}

/**
 * One client per isolate per key. The Worker keeps module state across
 * requests within an isolate and drops it on eviction; either is fine here.
 */
let _client: { key: string; client: TypeSafeClient } | null = null;

function clientFor(apiKey: string): TypeSafeClient {
  if (_client?.key === apiKey) return _client.client;
  const client = new TypeSafeClient({
    apiKey,
    defaultModel: TYPESAFE_MODEL,
    // Per attempt; callers put their own ceiling on the whole await. The chat
    // classifier gives up at 900 ms and answers without it.
    timeout: 5_000,
    retry: { maxRetries: 1 },
    logLevel: 'warn',
  });
  _client = { key: apiKey, client };
  return client;
}

/**
 * Ask one batch of questions over one state. Independent questions batch into
 * one request and run in parallel on TypeSafe's side, so a caller should put
 * every question it has about a state into one call.
 *
 * Throws when the key is missing or the API fails; callers decide what "no
 * judgment" means for them and must never let it become "no answer".
 */
export async function askTypeSafe<const Q extends Questions>(
  event: H3Event,
  state: Parameters<TypeSafeClient['systemOne']>[0]['state'],
  questions: Q,
  meta: { caller: string; signal?: AbortSignal }
): Promise<TypeSafeAnswer<Q>> {
  const apiKey = ((serverRuntimeConfig(event).TYPESAFE_API_KEY as string) || '').trim();
  if (!apiKey) throw new Error('TYPESAFE_API_KEY is not set');

  const started = Date.now();
  const result = await clientFor(apiKey).systemOne(
    { state, questions, model: TYPESAFE_MODEL },
    meta.signal ? { signal: meta.signal } : {}
  );
  const durationMs = Date.now() - started;
  if (!result.model || ALIASES.has(result.model)) {
    throw new Error(`TypeSafe answered with an alias or empty model id (${result.model})`);
  }

  captureServerEvent(event, 'typesafe_call', `typesafe:${meta.caller}`, {
    $process_person_profile: false,
    caller: meta.caller,
    model: result.model,
    questions: Object.keys(questions).length,
    input_tokens: result.usage.input_tokens,
    output_tokens: result.usage.output_tokens,
    duration_ms: durationMs,
  });

  return {
    answers: result.answers,
    model: result.model,
    inputTokens: result.usage.input_tokens,
    durationMs,
  };
}
