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

/**
 * Remembering a refusal across a page load.
 *
 * The quota panel was derived from the chat transport's transient `error`, so
 * it died with the component: leaving /chat and returning — via the panel's own
 * "Sign in" link and the back button, say — cleared the lockout and re-enabled
 * the composer. The server refuses those sends regardless, so nothing was ever
 * over-served; what broke was the telling. The reader was invited to write a
 * message that could not be delivered, and it landed in the transcript looking
 * sent.
 *
 * `sessionStorage`, not `localStorage`: a refusal is worth carrying across a
 * navigation, not across a week. It also means the worst case of a stale entry
 * is one tab, and closing it is a way out on top of the panel's own dismiss.
 *
 * Every accessor is wrapped, because storage throws outright in some contexts
 * (private windows, blocked site data) and a support panel must never be the
 * reason the assistant fails to load.
 */
const QUOTA_STORAGE_KEY = 'cmdiy-chat-quota';

export function loadQuotaVerdict(): QuotaExhausted | null {
  try {
    const raw = sessionStorage.getItem(QUOTA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Re-validated rather than trusted. Storage is caller-writable, and the
    // panel indexes translations by `tier` — an unrecognised value would render
    // an empty upsell with no error to explain it, the same silent-empty failure
    // `parseQuotaError` guards against for the live path.
    if (!parsed || !Object.keys(CHAT_QUOTAS).includes(parsed.tier)) return null;
    return {
      tier: parsed.tier,
      used: typeof parsed.used === 'number' ? parsed.used : undefined,
      limit: typeof parsed.limit === 'number' ? parsed.limit : undefined,
      upgradeUrl: typeof parsed.upgradeUrl === 'string' ? parsed.upgradeUrl : MEMBERSHIP_URL,
    };
  } catch {
    return null;
  }
}

export function saveQuotaVerdict(verdict: QuotaExhausted): void {
  try {
    sessionStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(verdict));
  } catch {
    // Non-fatal: the panel still shows for this page view from the live error.
  }
}

export function clearQuotaVerdict(): void {
  try {
    sessionStorage.removeItem(QUOTA_STORAGE_KEY);
  } catch {
    // Non-fatal.
  }
}
