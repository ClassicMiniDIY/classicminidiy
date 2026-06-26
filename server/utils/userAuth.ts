// server/utils/userAuth.ts
import { getServiceClient, getUserClient } from './supabase';

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
  // shared auth helper itself so the ban takes effect on the next request.
  //
  // Fail-open by design: this is an extra lookup layered on top of an already
  // valid session. If the profile row is missing (brand-new user, row not yet
  // provisioned) or the query errors, we do NOT block — we only reject on an
  // explicit `is_banned === true`, never on uncertainty.
  const { data: profile } = await supabase.from('profiles').select('is_banned').eq('id', user.id).maybeSingle();

  if (profile?.is_banned === true) {
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
