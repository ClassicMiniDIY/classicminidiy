/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Nitro global stubs + small limit (must be hoisted before source import) ----
const { mockGetRequestURL, mockGetRequestIP, mockSetHeader } = vi.hoisted(() => {
  // Force a tiny limit so we can drive the 429 path in a couple of calls.
  process.env.LANGGRAPH_RATELIMIT_MAX = '3';
  process.env.LANGGRAPH_RATELIMIT_WINDOW_MS = '60000';

  const mockGetRequestURL = vi.fn();
  const mockGetRequestIP = vi.fn();
  const mockSetHeader = vi.fn();

  (globalThis as any).defineEventHandler = (handler: Function) => handler;
  (globalThis as any).getRequestURL = mockGetRequestURL;
  (globalThis as any).getRequestIP = mockGetRequestIP;
  (globalThis as any).setHeader = mockSetHeader;
  (globalThis as any).createError = (opts: { statusCode: number; statusMessage?: string; message?: string }) => {
    const e = new Error(opts.message || opts.statusMessage) as Error & { statusCode: number };
    e.statusCode = opts.statusCode;
    return e;
  };

  return { mockGetRequestURL, mockGetRequestIP, mockSetHeader };
});

import handler from '~/server/middleware/rate-limit';
import { _resetRateLimitStore } from '~/server/utils/rateLimit';

describe('server/middleware/rate-limit', () => {
  const fakeEvent = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetRateLimitStore();
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
});
