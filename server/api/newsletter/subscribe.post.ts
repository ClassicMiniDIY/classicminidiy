/**
 * POST /api/newsletter/subscribe  { email, turnstileToken }
 *
 * Newsletter signup (Ghost retirement Phase 2). Verifies Turnstile, then asks the
 * send-marketing-email edge function (action mailing_list_signup) to send the
 * double opt-in email. Nobody is subscribed until they press the link.
 *
 * The answer is { ok: true } whether the address is new, already subscribed,
 * suppressed or in its resend cooldown, so the form cannot reveal list state.
 * Only an undeliverable address is a 400 (the visitor can fix a typo).
 * Covered by the /api/** write rate limit (server/middleware/rate-limit.ts).
 */
import { callMarketingEdge } from '../../utils/marketingEdge';
import { turnstileConfigured, verifyTurnstile } from '../../utils/turnstile';

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => null)) as { email?: unknown; turnstileToken?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const token = typeof body?.turnstileToken === 'string' ? body.turnstileToken : '';
  if (!email || email.length > 320 || !email.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'invalid_email' });
  }
  if (!token) throw createError({ statusCode: 400, statusMessage: 'captcha_required' });
  if (!turnstileConfigured()) throw createError({ statusCode: 503, statusMessage: 'signup_unavailable' });

  const ip = getRequestIP(event, { xForwardedFor: true });
  if (!(await verifyTurnstile(token, ip))) {
    throw createError({ statusCode: 403, statusMessage: 'captcha_failed' });
  }

  try {
    await callMarketingEdge({ action: 'mailing_list_signup', email, source: 'signup_form' }, { timeout: 20000 });
  } catch (error: any) {
    if (error?.statusCode === 400) throw createError({ statusCode: 400, statusMessage: 'invalid_email' });
    throw createError({ statusCode: 502, statusMessage: 'signup_failed' });
  }
  return { ok: true };
});
