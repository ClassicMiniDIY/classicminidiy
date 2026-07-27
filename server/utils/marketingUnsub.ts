/**
 * Marketing unsubscribe link verification + shared page chrome for the public
 * /email/unsubscribe routes. Links are minted by the send-marketing-email
 * edge function: e = base64url(lowercased email), t = base64url(HMAC-SHA256(
 * email, MARKETING_UNSUB_SECRET)). Same secret both sides — edge signs, web
 * verifies. These are Nitro-rendered pages (no session, no client bundle):
 * recipients from Ghost/Patreon/Shopify have no CMDIY account.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

function base64urlDecode(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    return Buffer.from(value, 'base64url');
  } catch {
    return null;
  }
}

/** Verify e/t query params. Returns the lowercased email, or null. */
export function verifyUnsubToken(e: unknown, t: unknown): string | null {
  const config = useRuntimeConfig();
  const secret = config.MARKETING_UNSUB_SECRET as string;
  if (!secret) return null;
  if (typeof e !== 'string' || typeof t !== 'string' || !e || !t) return null;

  const emailBytes = base64urlDecode(e);
  const sigBytes = base64urlDecode(t);
  if (!emailBytes || !sigBytes) return null;

  const email = emailBytes.toString('utf8').toLowerCase();
  // Cheap shape check before HMAC — the token only ever wraps an email.
  if (!email.includes('@') || email.length > 320) return null;

  const expected = createHmac('sha256', secret).update(email).digest();
  if (sigBytes.length !== expected.length || !timingSafeEqual(sigBytes, expected)) return null;
  return email;
}

/** True when MARKETING_UNSUB_SECRET is configured (unset ⇒ routes 503). */
export function unsubConfigured(): boolean {
  return Boolean(useRuntimeConfig().MARKETING_UNSUB_SECRET);
}

/** Escape a value for interpolation into the unsubscribe pages' HTML. */
export function escapeUnsubHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Mask an email for display: ab…@d….com style — local AND domain masked. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  const maskedLocal = `${local.slice(0, Math.min(2, Math.max(1, local.length - 1)))}…`;
  const lastDot = domain.lastIndexOf('.');
  const maskedDomain = lastDot > 0 ? `${domain[0] ?? ''}…${domain.slice(lastDot)}` : `${domain[0] ?? ''}…`;
  return `${maskedLocal}@${maskedDomain}`;
}

/** Minimal self-contained CMDIY-ish page (no app bundle, no external assets). */
export function unsubPage(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${title} — Classic Mini DIY</title>
  <style>
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #f9fafb; color: #1f2937; }
    .card { max-width: 480px; margin: 80px auto; background: #fff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,.07); padding: 40px 32px; text-align: center; }
    h1 { font-size: 22px; margin: 0 0 16px; }
    p { color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px; }
    .btn { display: inline-block; padding: 12px 32px; background: #435231; color: #fff; border: none; border-radius: 24px; font-weight: 600; font-size: 15px; cursor: pointer; text-decoration: none; }
    .brand { margin-top: 24px; font-size: 12px; color: #9ca3af; }
    .brand a { color: #435231; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    ${bodyHtml}
    <p class="brand"><a href="https://classicminidiy.com">Classic Mini DIY</a> &bull; Keeping Classic Minis on the road</p>
  </div>
</body>
</html>`;
}
