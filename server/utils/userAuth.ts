// server/utils/userAuth.ts
import { getServiceClient, getUserClient } from './supabase';

// --- Ban-status cache -------------------------------------------------------
// requireUserAuth runs on every authenticated request (all writes plus a few
// authed reads). The ban check is a cheap indexed PK lookup on `profiles`, but
// we memoize the result for a short window so a burst of requests from one
// active user does not fan out into a query per request. The TTL is short, so
// an admin ban still takes effect within ~BAN_CACHE_TTL_MS — far faster than
// the ~1h access-token lifetime that previously let a banned account keep
// writing until the token expired.
const BAN_CACHE_TTL_MS = 30_000;
// Bound the map so a long-lived warm instance can't accumulate an entry per
// distinct user forever. Cardinality is low (authenticated users only, not
// anonymous IPs); on overflow we evict the oldest-inserted entry in O(1).
const BAN_CACHE_MAX = 10_000;
const banCache = new Map<string, { banned: boolean; expiresAt: number }>();

/**
 * Resolve whether a user is banned, memoized for BAN_CACHE_TTL_MS.
 *
 * Fail-open by design: this check is layered on top of an already-valid
 * session. A transient failure — whether the Supabase client THROWS (network)
 * or returns an `error` (query) — must never lock a legitimate user out, so we
 * only ever block on an explicit `is_banned === true`. Uncertain results are
 * not cached, so the next request re-checks promptly.
 */
async function isUserBanned(supabase: any, userId: string): Promise<boolean> {
  const now = Date.now();
  const cached = banCache.get(userId);
  if (cached && cached.expiresAt > now) return cached.banned;

  let banned = false;
  try {
    const { data: profile, error } = await supabase.from('profiles').select('is_banned').eq('id', userId).maybeSingle();
    if (error) {
      console.error('[userAuth] ban-check query error (failing open):', error.message);
      return false; // do not cache uncertainty
    }
    banned = profile?.is_banned === true;
  } catch (err) {
    console.error('[userAuth] ban-check threw (failing open):', err);
    return false; // do not cache uncertainty
  }

  if (banCache.size >= BAN_CACHE_MAX) {
    const oldest = banCache.keys().next().value;
    if (oldest !== undefined) banCache.delete(oldest);
  }
  banCache.set(userId, { banned, expiresAt: now + BAN_CACHE_TTL_MS });
  return banned;
}

/** Test/maintenance helper: clear the in-memory ban-status cache. */
export function _resetBanCache(): void {
  banCache.clear();
}

/**
 * Pull a Supabase access token off the request — prefers the `Authorization:
 * Bearer` header, falls back to the `sb-<ref>-auth-token` cookie (object or
 * array form). Returns undefined when none is present/parseable.
 */
export function extractAccessToken(event: any): string | undefined {
  const authHeader = getHeader(event, 'authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Fall back to the Supabase auth cookie (sb-<ref>-auth-token). h3's parseCookies
  // (auto-imported in Nitro) handles quoting/decoding more robustly than splitting
  // the raw header by hand, and returns already URI-decoded values.
  const cookies = parseCookies(event);
  const authCookieKey = Object.keys(cookies).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
  const rawCookie = authCookieKey ? cookies[authCookieKey] : undefined;
  if (rawCookie) {
    try {
      const decoded = JSON.parse(rawCookie);
      return decoded?.access_token || decoded?.[0];
    } catch {
      // Not valid JSON, skip
    }
  }

  return undefined;
}

export async function requireUserAuth(event: any) {
  const accessToken = extractAccessToken(event);

  if (!accessToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required',
    });
  }

  const supabase = getServiceClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired session',
    });
  }

  // Ban enforcement. A valid Supabase access token keeps working until it
  // expires even after we ban the account in `profiles`, so an admin-banned
  // scammer could otherwise keep hitting every write endpoint (submissions,
  // uploads, comments, checkout) for the remaining token lifetime. Gate the
  // shared auth helper itself so the ban takes effect within ~BAN_CACHE_TTL_MS.
  // See isUserBanned for the fail-open and caching rationale.
  if (await isUserBanned(supabase, user.id)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Account suspended',
      message: 'This account has been suspended. Contact support if you believe this is a mistake.',
    });
  }

  return { user };
}

/**
 * Like requireUserAuth, but also returns the verified access token and a
 * Supabase client bound to it. Use when a route needs to perform writes UNDER
 * the caller's RLS identity (not the service role) — e.g. the model-upload
 * presign route, which relies on `model_files` INSERT policy to confirm the
 * caller owns the draft version it is attaching a file to.
 */
export async function requireUserClient(event: any) {
  const { user } = await requireUserAuth(event);
  const accessToken = extractAccessToken(event)!; // present: requireUserAuth would have thrown otherwise
  return { user, accessToken, supabase: getUserClient(accessToken) };
}
