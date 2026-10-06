/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// POST /api/newsletter/subscribe (Ghost retirement Phase 2).
const callMarketingEdge = vi.fn();
const verifyTurnstile = vi.fn();
const turnstileConfigured = vi.fn();
vi.mock('~~/server/utils/marketingEdge', () => ({ callMarketingEdge }));
vi.mock('~~/server/utils/turnstile', () => ({ verifyTurnstile, turnstileConfigured }));

const readBody = vi.fn();
vi.stubGlobal('defineEventHandler', (h: Function) => h);
vi.stubGlobal('readBody', readBody);
vi.stubGlobal('getRequestIP', () => '203.0.113.9');
vi.stubGlobal('createError', (opts: any) => {
  const e: any = new Error(opts.statusMessage);
  e.statusCode = opts.statusCode;
  e.statusMessage = opts.statusMessage;
  return e;
});

const handler = (await import('~~/server/api/newsletter/subscribe.post')).default as (e: any) => Promise<any>;

async function call(body: unknown) {
  readBody.mockResolvedValueOnce(body);
  try {
    return { ok: await handler({}) };
  } catch (e: any) {
    return { status: e.statusCode, message: e.statusMessage };
  }
}

describe('POST /api/newsletter/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    turnstileConfigured.mockReturnValue(true);
    verifyTurnstile.mockResolvedValue(true);
    callMarketingEdge.mockResolvedValue({ ok: true });
  });

  it('verifies Turnstile, then asks the edge function to send the confirmation', async () => {
    expect(await call({ email: ' reader@gmail.com ', turnstileToken: 'tok' })).toEqual({ ok: { ok: true } });
    expect(verifyTurnstile).toHaveBeenCalledWith('tok', '203.0.113.9');
    expect(callMarketingEdge).toHaveBeenCalledWith(
      { action: 'mailing_list_signup', email: 'reader@gmail.com', source: 'signup_form' },
      { timeout: 20000 }
    );
  });

  it('refuses before Cloudflare or the edge function: bad email, no token, no secret', async () => {
    expect(await call({ email: 'nope', turnstileToken: 'tok' })).toEqual({ status: 400, message: 'invalid_email' });
    expect(await call({ email: 'reader@gmail.com' })).toEqual({ status: 400, message: 'captcha_required' });
    turnstileConfigured.mockReturnValue(false);
    expect(await call({ email: 'reader@gmail.com', turnstileToken: 'tok' })).toEqual({
      status: 503,
      message: 'signup_unavailable',
    });
    expect(verifyTurnstile).not.toHaveBeenCalled();
    expect(callMarketingEdge).not.toHaveBeenCalled();
  });

  it('a failed captcha is 403 and nothing is sent', async () => {
    verifyTurnstile.mockResolvedValue(false);
    expect(await call({ email: 'reader@gmail.com', turnstileToken: 'tok' })).toEqual({
      status: 403,
      message: 'captcha_failed',
    });
    expect(callMarketingEdge).not.toHaveBeenCalled();
  });

  it('maps an edge 400 to invalid_email and anything else to 502', async () => {
    callMarketingEdge.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 400 }));
    expect(await call({ email: 'reader@gmail.com', turnstileToken: 'tok' })).toEqual({
      status: 400,
      message: 'invalid_email',
    });
    callMarketingEdge.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 500 }));
    expect(await call({ email: 'reader@gmail.com', turnstileToken: 'tok' })).toEqual({
      status: 502,
      message: 'signup_failed',
    });
  });
});
