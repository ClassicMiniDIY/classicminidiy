/** @vitest-environment node */
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { checkConfirmToken } from '~~/server/utils/mailingListConfirm';

// Newsletter double opt-in links (Ghost retirement Phase 2). The edge function
// mints them; classicminidiy-supabase supabase/functions/_shared/mailing-list.test.ts
// holds the same golden vector. Change both together.
const GOLDEN = new URL(
  'https://classicminidiy.com/email/confirm?e=cmVhZGVyQGdtYWlsLmNvbQ&x=1790604800&t=rqCHjGwyfYsgbkIyL47SLOEM0Eotn-uRxXlHvriuObs'
);
const SECRET = 'golden-secret';
const q = (k: string) => GOLDEN.searchParams.get(k);

describe('checkConfirmToken', () => {
  it('accepts the edge function golden vector before it expires', () => {
    // issuedAt = x - 7 days; mailing_list_confirm compares it to the latest unsubscribe.
    expect(checkConfirmToken(SECRET, q('e'), q('x'), q('t'), 1790000000)).toEqual({
      ok: true,
      email: 'reader@gmail.com',
      issuedAt: new Date(1790000000 * 1000),
    });
  });

  it('reports expired after x, but only for a valid signature', () => {
    expect(checkConfirmToken(SECRET, q('e'), q('x'), q('t'), 1790604801)).toEqual({ ok: false, reason: 'expired' });
    expect(checkConfirmToken('other-secret', q('e'), q('x'), q('t'), 1790604801)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('refuses an unsubscribe token (HMAC of the bare email) as a confirm token', () => {
    const unsubT = createHmac('sha256', SECRET).update('reader@gmail.com').digest('base64url');
    expect(checkConfirmToken(SECRET, q('e'), q('x'), unsubT, 1790000000)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('refuses a moved expiry, a changed address and malformed input', () => {
    expect(checkConfirmToken(SECRET, q('e'), '1890604800', q('t'), 1790000000).ok).toBe(false);
    const other = Buffer.from('someone@gmail.com').toString('base64url');
    expect(checkConfirmToken(SECRET, other, q('x'), q('t'), 1790000000).ok).toBe(false);
    for (const [e, x, t] of [
      [undefined, q('x'), q('t')],
      [q('e'), 'soon', q('t')],
      [q('e'), q('x'), 'not+base64'],
      ['', q('x'), q('t')],
    ]) {
      expect(checkConfirmToken(SECRET, e, x, t, 1790000000)).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  it('an unset secret never verifies', () => {
    expect(checkConfirmToken('', q('e'), q('x'), q('t'), 1790000000)).toEqual({ ok: false, reason: 'invalid' });
  });
});
