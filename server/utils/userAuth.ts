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
