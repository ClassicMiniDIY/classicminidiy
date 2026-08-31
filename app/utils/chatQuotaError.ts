// `~~/shared/...`, not a relative path. Every other app file that reaches into
// shared/ uses the alias, and the relative form does not survive the Cloudflare
// build: Rollup could not resolve it from the client chunk and the deploy failed
// at the bundling step — after a green unit suite, a green typecheck and a green
// dev server, because only the production build resolves that specifier.
import { CHAT_QUOTAS, MEMBERSHIP_URL, type ChatTier } from '~~/shared/utils/chatTiers';

/**
 * Recognise a quota-exhausted response inside a chat error.
 *
 * The AI SDK's chat transport throws an `Error` whose MESSAGE is the raw
 * response body, so the structured 429 the route sends — tier, usage, ceiling,
 * upgrade URL — arrives as a JSON string and nothing else. Without parsing it
 * the UI can only fall back to its generic "something went wrong, please try
 * again", which for an exhausted quota is advice that can never work: the retry
 * re-sends the same request and fails identically, forever.
 *
 * That matters more than a normal error string. Someone who has used the
 * assistant fifteen times in a day is the most engaged visitor the feature has,
 * and the moment they hit the ceiling is the only moment membership is
 * genuinely relevant to them. Rendering it as a red failure wastes it and
 * reads as a bug.
 */
export interface QuotaExhausted {
  tier: ChatTier;
  used?: number;
  limit?: number;
  upgradeUrl: string;
}

/**
 * Returns the quota details when `error` is a 429 from the chat route, else
 * null. Deliberately forgiving: any shape it does not recognise falls through
 * to the generic error path rather than throwing inside a render.
 */
export function parseQuotaError(error: unknown): QuotaExhausted | null {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : null;
  if (!message) return null;

  let body: any;
  try {
    body = JSON.parse(message);
  } catch {
    // A network failure or a plain-text error. Not a quota.
    return null;
  }

  if (body?.statusCode !== 429) return null;

  // Derived from CHAT_QUOTAS, not restated. A fourth tier added to the shared
  // contract would otherwise compile clean here and render every 429 for it as
  // the anonymous copy — the wrong pitch to the wrong audience, with no error.
  const tier: ChatTier = Object.keys(CHAT_QUOTAS).includes(body?.data?.tier) ? body.data.tier : 'anonymous';

  return {
    tier,
    used: typeof body?.data?.used === 'number' ? body.data.used : undefined,
    // Fall back to the shared constants rather than showing nothing: the client
    // already knows every ceiling, so a body missing the field is not a reason
    // to hide the number from the reader.
    limit:
      typeof body?.data?.limit === 'number'
        ? body.data.limit
        : (CHAT_QUOTAS[tier].perDay ?? CHAT_QUOTAS[tier].perMonth ?? undefined),
    upgradeUrl: typeof body?.data?.upgradeUrl === 'string' ? body.data.upgradeUrl : MEMBERSHIP_URL,
  };
}
