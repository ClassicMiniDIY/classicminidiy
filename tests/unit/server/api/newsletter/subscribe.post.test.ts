/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// POST /api/newsletter/subscribe (Ghost retirement Phase 2).
const callMarketingEdge = vi.fn();
const verifyTurnstile = vi.fn();
const turnstileConfigured = vi.fn();
vi.mock('~~/server/utils/marketingEdge', () => ({ callMarketingEdge }));
vi.mock('~~/server/utils/turnstile', () => ({ verifyTurnstile, turnstileConfigured }));
vi.mock('~~/server/utils/clientIp', () => ({ clientIp: () => '203.0.113.9' }));

const readBody = vi.fn();
vi.stubGlobal('defineEventHandler', (h: Function) => h);
vi.stubGlobal('readBody', readBody);
vi.stubGlobal('createError', (opts: any) => {
  const e: any = new Error(opts.statusMessage);
  e.statusCode = opts.statusCode;
  e.statusMessage = opts.statusMessage;
  return e;
});

const handler = (await import('~~/server/api/newsletter/subscribe.post')).default as (e: any) => Promise<any>;
const ok = { email: 'reader@gmail.com', turnstileToken: 'tok' };

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

  it('verifies Turnstile (platform IP, newsletter action), then asks the edge function to send', async () => {
    expect(await call({ ...ok, email: ' reader@gmail.com ' })).toEqual({ ok: { ok: true } });
    expect(verifyTurnstile).toHaveBeenCalledWith('tok', '203.0.113.9', 'newsletter');
    expect(callMarketingEdge).toHaveBeenCalledWith(
      { action: 'mailing_list_signup', email: 'reader@gmail.com', source: 'signup_form' },
      { timeout: 20000 }
    );
  });

  it('refuses before Cloudflare or the edge function: bad email, no token, no secret', async () => {
    expect(await call({ email: 'nope', turnstileToken: 'tok' })).toEqual({ status: 400, message: 'invalid_email' });
    expect(await call({ email: 'reader@gmail.com' })).toEqual({ status: 400, message: 'captcha_required' });
    turnstileConfigured.mockReturnValue(false);
    expect(await call(ok)).toEqual({ status: 503, message: 'signup_unavailable' });
    expect(verifyTurnstile).not.toHaveBeenCalled();
    expect(callMarketingEdge).not.toHaveBeenCalled();
  });

  it('a failed captcha is 403 and nothing is sent', async () => {
    verifyTurnstile.mockResolvedValue(false);
    expect(await call(ok)).toEqual({ status: 403, message: 'captcha_failed' });
    expect(callMarketingEdge).not.toHaveBeenCalled();
  });

  it('maps only the edge invalid_email to 400; any other error (an undeployed action too) is 502', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const edgeError = (statusCode: number, statusMessage?: string) =>
      Object.assign(new Error('x'), { statusCode, statusMessage });
    callMarketingEdge.mockRejectedValueOnce(edgeError(400, 'invalid_email'));
    expect(await call(ok)).toEqual({ status: 400, message: 'invalid_email' });
    callMarketingEdge.mockRejectedValueOnce(edgeError(400, 'Unknown action: mailing_list_signup'));
    expect(await call(ok)).toEqual({ status: 502, message: 'signup_failed' });
    callMarketingEdge.mockRejectedValueOnce(edgeError(500));
    expect(await call(ok)).toEqual({ status: 502, message: 'signup_failed' });
    errSpy.mockRestore();
  });
});
