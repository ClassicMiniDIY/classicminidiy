/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Nitro global stubs + small limit (must be hoisted before source import) ----
const { mockGetRequestURL, mockGetRequestIP, mockGetHeader, mockSetHeader } = vi.hoisted(() => {
  // Force a tiny limit so we can drive the 429 path in a couple of calls.
  process.env.LANGGRAPH_RATELIMIT_MAX = '3';
  process.env.LANGGRAPH_RATELIMIT_WINDOW_MS = '60000';
  process.env.WRITE_RATELIMIT_MAX = '3';
  process.env.WRITE_RATELIMIT_WINDOW_MS = '60000';

  const mockGetRequestURL = vi.fn();
  const mockGetRequestIP = vi.fn();
  const mockGetHeader = vi.fn();
  const mockSetHeader = vi.fn();

  (globalThis as any).defineEventHandler = (handler: Function) => handler;
  (globalThis as any).getRequestURL = mockGetRequestURL;
  (globalThis as any).getRequestIP = mockGetRequestIP;
  (globalThis as any).getHeader = mockGetHeader;
  (globalThis as any).setHeader = mockSetHeader;
  (globalThis as any).createError = (opts: { statusCode: number; statusMessage?: string; message?: string }) => {
    const e = new Error(opts.message || opts.statusMessage) as Error & { statusCode: number };
    e.statusCode = opts.statusCode;
    return e;
  };

  return { mockGetRequestURL, mockGetRequestIP, mockGetHeader, mockSetHeader };
});

import handler from '~/server/middleware/rate-limit';
import { _resetRateLimitStore } from '~/server/utils/rateLimit';

describe('server/middleware/rate-limit', () => {
  const fakeEvent = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetRateLimitStore();
    // Default: no x-real-ip header, so keying falls back to getRequestIP.
    mockGetHeader.mockReturnValue(undefined);
    mockGetRequestIP.mockReturnValue('203.0.113.7');
  });

  it('ignores non-langgraph routes (no-op, no IP lookup)', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/api/listings'));

    const result = await (handler as Function)(fakeEvent);
    expect(result).toBeUndefined();
    expect(mockGetRequestIP).not.toHaveBeenCalled();
    expect(mockSetHeader).not.toHaveBeenCalled();
  });

  // The handler is synchronous (returns void / throws via createError), so we
  // assert with sync matchers — a thrown createError must be caught by expect's
  // wrapper, not awaited.
  const call = () => (handler as Function)(fakeEvent);
  const callCatching = (): any => {
    try {
      call();
      return undefined;
    } catch (e) {
      return e;
    }
  };

  it('allows langgraph requests under the limit and sets rate-limit headers', () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/api/langgraph/threads/new/runs/stream'));

    expect(call()).toBeUndefined();
    expect(mockSetHeader).toHaveBeenCalledWith(fakeEvent, 'X-RateLimit-Limit', '3');
    expect(mockSetHeader).toHaveBeenCalledWith(fakeEvent, 'X-RateLimit-Remaining', '2');
  });

  it('throws 429 with Retry-After once the per-IP limit is exceeded', () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/api/langgraph/threads'));

    expect(call()).toBeUndefined(); // 1
    expect(call()).toBeUndefined(); // 2
    expect(call()).toBeUndefined(); // 3 (== max, still allowed)

    expect(callCatching()).toMatchObject({ statusCode: 429 }); // 4
    expect(mockSetHeader).toHaveBeenCalledWith(fakeEvent, 'Retry-After', expect.any(String));
  });

  it('keeps separate budgets per client IP', () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/api/langgraph/threads'));

    mockGetRequestIP.mockReturnValue('198.51.100.1');
    call();
    call();
    call();
    expect(callCatching()).toMatchObject({ statusCode: 429 });

    // A different IP still has a fresh budget.
    mockGetRequestIP.mockReturnValue('198.51.100.2');
    expect(call()).toBeUndefined();
  });

  it('keys on the unspoofable x-real-ip when present, ignoring x-forwarded-for', () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/api/langgraph/threads'));

    // Attacker rotates the spoofable getRequestIP value each request, but the
    // edge-set x-real-ip stays constant — so the limit must still bind.
    mockGetHeader.mockReturnValue('192.0.2.50'); // x-real-ip (constant, trusted)
    mockGetRequestIP.mockReturnValueOnce('1.1.1.1').mockReturnValueOnce('2.2.2.2').mockReturnValueOnce('3.3.3.3');

    call();
    call();
    call();
    expect(callCatching()).toMatchObject({ statusCode: 429 });
  });

  describe('write (mutation) policy', () => {
    // A sibling test above uses mockReturnValueOnce on getRequestIP without
    // consuming the queue (it keys on x-real-ip), and clearAllMocks does not
    // drain that queue. Reset it here so every call in this block resolves to
    // one stable IP and therefore shares a single rate-limit bucket.
    beforeEach(() => {
      mockGetRequestIP.mockReset();
      mockGetRequestIP.mockReturnValue('203.0.113.7');
    });

    const writeEvent = (method: string) => ({ method }) as any;
    const callWrite = (method: string) => (handler as Function)(writeEvent(method));
    const callWriteCatching = (method: string): any => {
      try {
        callWrite(method);
        return undefined;
      } catch (e) {
        return e;
      }
    };

    it('does not throttle GET reads', () => {
      mockGetRequestURL.mockReturnValue(new URL('https://example.com/api/models'));
      expect(callWrite('GET')).toBeUndefined();
      expect(mockGetRequestIP).not.toHaveBeenCalled();
      expect(mockSetHeader).not.toHaveBeenCalled();
    });

    it('throttles POST/PUT/PATCH/DELETE on /api/** once the per-IP limit is exceeded', () => {
      mockGetRequestURL.mockReturnValue(new URL('https://example.com/api/gear-configs'));
      expect(callWrite('POST')).toBeUndefined(); // 1
      expect(callWrite('PUT')).toBeUndefined(); // 2
      expect(callWrite('PATCH')).toBeUndefined(); // 3 (== max)
      expect(callWriteCatching('DELETE')).toMatchObject({ statusCode: 429 }); // 4
      expect(mockSetHeader).toHaveBeenCalledWith(expect.anything(), 'Retry-After', expect.any(String));
    });

    it('exempts /api/admin mutations (moderator queue work)', () => {
      mockGetRequestURL.mockReturnValue(new URL('https://example.com/api/admin/queue/approve'));
      expect(callWrite('POST')).toBeUndefined();
      expect(callWrite('POST')).toBeUndefined();
      expect(callWrite('POST')).toBeUndefined();
      expect(callWrite('POST')).toBeUndefined(); // beyond the limit, still allowed
      expect(mockGetRequestIP).not.toHaveBeenCalled();
    });

    it('does NOT exempt a non-boundary prefix match like /api/admin-foo', () => {
      // '/api/admin' exempts '/api/admin/...', but '/api/admin-foo' is a
      // different route and must still be throttled.
      mockGetRequestURL.mockReturnValue(new URL('https://example.com/api/admin-foo'));
      expect(callWrite('POST')).toBeUndefined();
      expect(callWrite('POST')).toBeUndefined();
      expect(callWrite('POST')).toBeUndefined();
      expect(callWriteCatching('POST')).toMatchObject({ statusCode: 429 });
    });

    it('keeps the write budget separate from the langgraph budget', () => {
      // Exhaust the chat budget on one IP...
      mockGetRequestURL.mockReturnValue(new URL('https://example.com/api/langgraph/threads'));
      call();
      call();
      call();
      expect(callCatching()).toMatchObject({ statusCode: 429 });

      // ...the write budget for the same IP is untouched.
      mockGetRequestURL.mockReturnValue(new URL('https://example.com/api/models'));
      expect(callWrite('POST')).toBeUndefined();
    });
  });
});
