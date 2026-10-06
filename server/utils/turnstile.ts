/**
 * Server-side Cloudflare Turnstile check for public forms that have no Supabase
 * Auth captcha behind them (the newsletter signup). login.vue does not use this:
 * Supabase Auth verifies its captcha itself.
 *
 * Secret: runtimeConfig.turnstile.secretKey (env NUXT_TURNSTILE_SECRET_KEY, set by
 * scripts/set-cf-secrets.sh). Unset = turnstileConfigured() is false and the
 * caller answers 503: a public write must never run unverified.
 */
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function turnstileSecret(): string {
  const config = useRuntimeConfig() as { turnstile?: { secretKey?: string } };
  return config.turnstile?.secretKey || '';
}

export function turnstileConfigured(): boolean {
  return turnstileSecret().length > 0;
}

/**
 * True only when Cloudflare says success. Any network or shape error is false.
 * With `expectedAction`, the token must come from a widget rendered with that
 * action, so a token minted on another form (login shares the site key) fails.
 */
export async function verifyTurnstile(
  token: string,
  remoteIp: string | undefined,
  expectedAction?: string,
  fetcher: typeof fetch = fetch
): Promise<boolean> {
  const secret = turnstileSecret();
  if (!secret || !token) return false;
  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp) form.set('remoteip', remoteIp);
  try {
    const res = await fetcher(SITEVERIFY, { method: 'POST', body: form });
    if (!res.ok) return false;
    const body = (await res.json()) as { success?: unknown; action?: unknown };
    if (body.success !== true) return false;
    return expectedAction === undefined || body.action === expectedAction;
  } catch {
    return false;
  }
}
