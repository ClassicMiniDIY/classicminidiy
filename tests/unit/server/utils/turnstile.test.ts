/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeConfig = vi.fn();
vi.stubGlobal('useRuntimeConfig', runtimeConfig);
const { turnstileConfigured, verifyTurnstile } = await import('~~/server/utils/turnstile');

function fetcher(response: unknown, ok = true) {
  return vi.fn(async (_url: string, _init: any) => ({ ok, json: async () => response }) as Response);
}

describe('verifyTurnstile', () => {
  beforeEach(() => runtimeConfig.mockReturnValue({ turnstile: { secretKey: 'ts-secret' } }));

  it('posts secret, token and IP to siteverify and trusts only success === true', async () => {
    const f = fetcher({ success: true });
    expect(await verifyTurnstile('tok', '203.0.113.9', undefined, f as any)).toBe(true);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const form = init.body as URLSearchParams;
    expect(form.get('secret')).toBe('ts-secret');
    expect(form.get('response')).toBe('tok');
    expect(form.get('remoteip')).toBe('203.0.113.9');
  });

  it('is false on a failed check, a non-2xx, a network error or "success": "true"', async () => {
    const down = vi.fn(async () => {
      throw new Error('down');
    });
    expect(await verifyTurnstile('tok', undefined, undefined, fetcher({ success: false }) as any)).toBe(false);
    expect(await verifyTurnstile('tok', undefined, undefined, fetcher({ success: true }, false) as any)).toBe(false);
    expect(await verifyTurnstile('tok', undefined, undefined, down as any)).toBe(false);
    expect(await verifyTurnstile('tok', undefined, undefined, fetcher({ success: 'true' }) as any)).toBe(false);
  });

  it('with an expected action, a token minted on another widget (login) is refused', async () => {
    const ok = fetcher({ success: true, action: 'newsletter' });
    expect(await verifyTurnstile('tok', undefined, 'newsletter', ok as any)).toBe(true);
    const login = fetcher({ success: true, action: 'login' });
    expect(await verifyTurnstile('tok', undefined, 'newsletter', login as any)).toBe(false);
    expect(await verifyTurnstile('tok', undefined, 'newsletter', fetcher({ success: true }) as any)).toBe(false);
  });

  it('never calls Cloudflare without a secret or a token', async () => {
    const f = fetcher({ success: true });
    expect(await verifyTurnstile('', undefined, undefined, f as any)).toBe(false);
    runtimeConfig.mockReturnValue({});
    expect(turnstileConfigured()).toBe(false);
    expect(await verifyTurnstile('tok', undefined, undefined, f as any)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});
