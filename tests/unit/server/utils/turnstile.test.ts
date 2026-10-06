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
    expect(await verifyTurnstile('tok', '203.0.113.9', f as any)).toBe(true);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const form = init.body as URLSearchParams;
    expect(form.get('secret')).toBe('ts-secret');
    expect(form.get('response')).toBe('tok');
    expect(form.get('remoteip')).toBe('203.0.113.9');
  });

  it('is false on a failed check, a non-2xx, a network error or "success": "true"', async () => {
    expect(await verifyTurnstile('tok', undefined, fetcher({ success: false }) as any)).toBe(false);
    expect(await verifyTurnstile('tok', undefined, fetcher({ success: true }, false) as any)).toBe(false);
    expect(
      await verifyTurnstile(
        'tok',
        undefined,
        vi.fn(async () => {
          throw new Error('down');
        }) as any
      )
    ).toBe(false);
    expect(await verifyTurnstile('tok', undefined, fetcher({ success: 'true' }) as any)).toBe(false);
  });

  it('never calls Cloudflare without a secret or a token', async () => {
    const f = fetcher({ success: true });
    expect(await verifyTurnstile('', undefined, f as any)).toBe(false);
    runtimeConfig.mockReturnValue({});
    expect(turnstileConfigured()).toBe(false);
    expect(await verifyTurnstile('tok', undefined, f as any)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});
