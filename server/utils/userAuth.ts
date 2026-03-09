// server/utils/userAuth.ts
import { getServiceClient } from './supabase';

export async function requireUserAuth(event: any) {
  const authHeader = getHeader(event, 'authorization');
  let accessToken: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    accessToken = authHeader.slice(7);
  }

  if (!accessToken) {
    const cookieHeader = getHeader(event, 'cookie') || '';
    const cookies = Object.fromEntries(
      cookieHeader
        .split(';')
        .filter((c: string) => c.trim())
        .map((c: string) => {
          const [key, ...val] = c.trim().split('=');
          return [key, val.join('=')];
        })
    );

    const authCookieKey = Object.keys(cookies).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (authCookieKey) {
      try {
        const decoded = JSON.parse(decodeURIComponent(cookies[authCookieKey]));
        accessToken = decoded?.access_token || decoded?.[0];
      } catch {
        // Not valid JSON, skip
      }
    }
  }

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
