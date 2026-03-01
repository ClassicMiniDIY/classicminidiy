import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const config = useRuntimeConfig();
  return createClient(config.public.supabaseUrl as string, config.SUPABASE_SERVICE_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireAdminAuth(event: any) {
  // Try to get the access token from the Authorization header
  const authHeader = getHeader(event, 'authorization');
  let accessToken: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    accessToken = authHeader.slice(7);
  }

  // If no Authorization header, try Supabase auth cookies
  if (!accessToken) {
    const cookieHeader = getHeader(event, 'cookie') || '';
    const cookies = Object.fromEntries(
      cookieHeader
        .split(';')
        .filter((c) => c.trim())
        .map((c) => {
          const [key, ...val] = c.trim().split('=');
          return [key, val.join('=')];
        }),
    );

    // Supabase stores tokens in cookies named sb-<project-ref>-auth-token
    const authCookieKey = Object.keys(cookies).find(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
    );
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

  // Check admin status from profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.is_admin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access required',
    });
  }

  return { user, profile };
}

export async function isAdminAuthenticated(event: any): Promise<boolean> {
  try {
    await requireAdminAuth(event);
    return true;
  } catch {
    return false;
  }
}
