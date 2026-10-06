/**
 * Double opt-in confirm links for the newsletter (Ghost retirement Phase 2;
 * classicminidiy-supabase docs/plans/2026-10-06-ghost-retirement-phase2-mailing-list.md).
 * The send-marketing-email edge function mints them (_shared/mailing-list.ts):
 *   e = base64url(lowercased email), x = expiry in unix seconds,
 *   t = base64url(HMAC-SHA256("confirm:" + email + ":" + x, MARKETING_UNSUB_SECRET)).
 * The `confirm:` prefix is load-bearing: an unsubscribe token is the HMAC of the
 * bare email (marketingUnsub.ts), so without it one token could pass as the other.
 * Change both repos together.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** A confirm link lives this long; the link's issue time is its expiry minus this. */
export const CONFIRM_TTL_SECONDS = 7 * 24 * 60 * 60;

export type ConfirmCheck = { ok: true; email: string; issuedAt: Date } | { ok: false; reason: 'invalid' | 'expired' };

function base64urlDecode(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    return Buffer.from(value, 'base64url');
  } catch {
    return null;
  }
}

/** Pure check (secret and clock passed in). The signature is checked before the expiry. */
export function checkConfirmToken(
  secret: string,
  e: unknown,
  x: unknown,
  t: unknown,
  nowSeconds: number
): ConfirmCheck {
  if (!secret) return { ok: false, reason: 'invalid' };
  if (typeof e !== 'string' || typeof x !== 'string' || typeof t !== 'string' || !e || !t) {
    return { ok: false, reason: 'invalid' };
  }
  if (!/^\d{1,12}$/.test(x)) return { ok: false, reason: 'invalid' };
  const emailBytes = base64urlDecode(e);
  const sigBytes = base64urlDecode(t);
  if (!emailBytes || !sigBytes) return { ok: false, reason: 'invalid' };
  const email = emailBytes.toString('utf8').trim().toLowerCase();
  if (!email.includes('@') || email.length > 320) return { ok: false, reason: 'invalid' };

  const expected = createHmac('sha256', secret).update(`confirm:${email}:${x}`).digest();
  if (sigBytes.length !== expected.length || !timingSafeEqual(sigBytes, expected)) {
    return { ok: false, reason: 'invalid' };
  }
  if (Number(x) < nowSeconds) return { ok: false, reason: 'expired' };
  return { ok: true, email, issuedAt: new Date((Number(x) - CONFIRM_TTL_SECONDS) * 1000) };
}

/** checkConfirmToken with MARKETING_UNSUB_SECRET and the current time. */
export function verifyConfirmToken(e: unknown, x: unknown, t: unknown): ConfirmCheck {
  const secret = useRuntimeConfig().MARKETING_UNSUB_SECRET as string;
  return checkConfirmToken(secret, e, x, t, Math.floor(Date.now() / 1000));
}
