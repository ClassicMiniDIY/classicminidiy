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

/** True only when Cloudflare says success. Any network or shape error is false. */
export async function verifyTurnstile(
  token: string,
  remoteIp: string | undefined,
  fetcher: typeof fetch = fetch
): Promise<boolean> {
  const secret = turnstileSecret();
  if (!secret || !token) return false;
  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp) form.set('remoteip', remoteIp);
  try {
    const res = await fetcher(SITEVERIFY, { method: 'POST', body: form });
    if (!res.ok) return false;
    const body = (await res.json()) as { success?: unknown };
    return body.success === true;
  } catch {
    return false;
  }
}
