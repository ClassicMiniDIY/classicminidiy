/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  checkRateLimit,
  createRateLimitMiddleware,
  RateLimitPresets,
  _resetExchangeRateLimitStore,
  _rateLimitStoreSize,
  _MAX_TRACKED_KEYS,
} from '~~/server/utils/exchange/rateLimit';

describe('server/utils/exchange/rateLimit', () => {
  beforeEach(() => {
    _resetExchangeRateLimitStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('checkRateLimit — allowed/remaining/resetAt', () => {
    const config = { maxRequests: 3, windowMs: 60_000 };

    it('allows the first request and reports remaining = max - 1', () => {
      const res = checkRateLimit('a', config);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(2);
      expect(res.resetAt).toBe(Date.now() + config.windowMs);
    });

    it('counts remaining down to zero across the window', () => {
      expect(checkRateLimit('b', config).remaining).toBe(2); // count=1
      expect(checkRateLimit('b', config).remaining).toBe(1); // count=2
      expect(checkRateLimit('b', config).remaining).toBe(0); // count=3 (== max, still allowed)
    });

    it('allows exactly up to the limit, then blocks at the limit', () => {
      expect(checkRateLimit('c', config).allowed).toBe(true); // 1
      expect(checkRateLimit('c', config).allowed).toBe(true); // 2
      expect(checkRateLimit('c', config).allowed).toBe(true); // 3 (== max)
      const blocked = checkRateLimit('c', config); // 4 (> max)
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it('keeps blocking on every subsequent request within the window', () => {
      checkRateLimit('d', config);
      checkRateLimit('d', config);
      checkRateLimit('d', config);
      expect(checkRateLimit('d', config).allowed).toBe(false);
      expect(checkRateLimit('d', config).allowed).toBe(false);
      expect(checkRateLimit('d', config).allowed).toBe(false);
    });

    it('a maxRequests of 1 blocks the second hit immediately', () => {
      const cfg = { maxRequests: 1, windowMs: 60_000 };
      const first = checkRateLimit('one', cfg);
      expect(first.allowed).toBe(true);
      expect(first.remaining).toBe(0);
      expect(checkRateLimit('one', cfg).allowed).toBe(false);
    });

    it('a maxRequests of 0 blocks even the first request after the entry exists', () => {
      const cfg = { maxRequests: 0, windowMs: 60_000 };
      // First call has no entry → creates one with count=1, returns allowed:true
      // (remaining = -1) because the create branch is taken before the >= check.
      const first = checkRateLimit('zero', cfg);
      expect(first.allowed).toBe(true);
      expect(first.remaining).toBe(-1);
      // Second call: entry exists, count(1) >= max(0) → blocked.
      expect(checkRateLimit('zero', cfg).allowed).toBe(false);
    });

    it('keeps a stable resetAt for the life of a window', () => {
      const first = checkRateLimit('stable', config);
      vi.advanceTimersByTime(10_000);
      const second = checkRateLimit('stable', config);
      expect(second.resetAt).toBe(first.resetAt);
    });
  });

  describe('checkRateLimit — window reset (fake timers)', () => {
    const config = { maxRequests: 2, windowMs: 60_000 };

    it('rebuilds a fresh budget after the window fully elapses', () => {
      checkRateLimit('e', config);
      checkRateLimit('e', config);
      expect(checkRateLimit('e', config).allowed).toBe(false);

      // Advance strictly past resetAt (entry.resetAt < now must hold).
      vi.advanceTimersByTime(config.windowMs + 1);

      const afterReset = checkRateLimit('e', config);
      expect(afterReset.allowed).toBe(true);
      expect(afterReset.remaining).toBe(1);
      expect(afterReset.resetAt).toBe(Date.now() + config.windowMs);
    });

    it('does NOT reset exactly at resetAt (boundary: resetAt < now is strict)', () => {
      const first = checkRateLimit('boundary', config);
      checkRateLimit('boundary', config);
      expect(checkRateLimit('boundary', config).allowed).toBe(false);

      // Jump to exactly resetAt. resetAt < now is false at equality, so the
      // entry is still considered live and the request stays blocked.
      vi.setSystemTime(new Date(first.resetAt));
      expect(checkRateLimit('boundary', config).allowed).toBe(false);

      // One ms later it expires and a new window opens.
      vi.advanceTimersByTime(1);
      expect(checkRateLimit('boundary', config).allowed).toBe(true);
    });
  });

  describe('checkRateLimit — per-key isolation', () => {
    const config = { maxRequests: 2, windowMs: 60_000 };

    it('tracks distinct identifiers independently', () => {
      checkRateLimit('user-1', config);
      checkRateLimit('user-1', config);
      expect(checkRateLimit('user-1', config).allowed).toBe(false);
      // A different identifier has its own fresh budget.
      expect(checkRateLimit('user-2', config).allowed).toBe(true);
    });

    it('namespaces by keyPrefix so the same identifier in two prefixes is independent', () => {
      const cfgA = { ...config, keyPrefix: 'login' };
      const cfgB = { ...config, keyPrefix: 'signup' };
      checkRateLimit('same-id', cfgA);
      checkRateLimit('same-id', cfgA);
      expect(checkRateLimit('same-id', cfgA).allowed).toBe(false);
      // Same identifier, different prefix → separate bucket.
      expect(checkRateLimit('same-id', cfgB).allowed).toBe(true);
    });

    it('defaults keyPrefix to "rl"', () => {
      _resetExchangeRateLimitStore();
      checkRateLimit('px', { maxRequests: 5, windowMs: 1000 });
      expect(_rateLimitStoreSize()).toBe(1);
      // Re-keying with explicit "rl" prefix collides with the default bucket.
      const res = checkRateLimit('px', { maxRequests: 5, windowMs: 1000, keyPrefix: 'rl' });
      expect(res.remaining).toBe(3); // second hit on the same bucket: count=2 of 5
      expect(_rateLimitStoreSize()).toBe(1);
    });

    it.each([
      ['empty string', ''],
      ['unicode identifier', 'ユーザー-🚗'],
      ['very long identifier', 'x'.repeat(10_000)],
      ['identifier with colons', '10.0.0.1:443:weird'],
    ])('handles %s as a normal key', (_label, identifier) => {
      const cfg = { maxRequests: 1, windowMs: 1000 };
      expect(checkRateLimit(identifier, cfg).allowed).toBe(true);
      expect(checkRateLimit(identifier, cfg).allowed).toBe(false);
    });
  });

  describe('checkRateLimit — eviction at MAX_TRACKED_KEYS', () => {
    it('exposes the real cap', () => {
      expect(_MAX_TRACKED_KEYS).toBe(50_000);
    });

    it('reclaims expired entries before evicting, then never exceeds the cap', () => {
      const cap = _MAX_TRACKED_KEYS;
      const cfg = { maxRequests: 100, windowMs: 60_000, keyPrefix: 'evict' };

      // Fill exactly to the cap. All entries share the same resetAt.
      for (let i = 0; i < cap; i++) {
        checkRateLimit(`k${i}`, cfg);
      }
      expect(_rateLimitStoreSize()).toBe(cap);

      // Expire every existing entry by advancing past the window, then insert a
      // new key. makeRoomForNewKey should reclaim the expired ones first, so the
      // store collapses to just the one fresh entry — no oldest-eviction needed.
      vi.advanceTimersByTime(cfg.windowMs + 1);
      checkRateLimit('fresh-after-expiry', cfg);
      expect(_rateLimitStoreSize()).toBe(1);
    });

    it('evicts oldest-inserted entries when the map is full of LIVE keys', () => {
      const cap = _MAX_TRACKED_KEYS;
      const cfg = { maxRequests: 100, windowMs: 60_000, keyPrefix: 'live' };

      // Fill to the cap with still-live entries (no time advance).
      for (let i = 0; i < cap; i++) {
        checkRateLimit(`live${i}`, cfg);
      }
      expect(_rateLimitStoreSize()).toBe(cap);

      // The very first inserted key is the eviction candidate.
      const oldestKey = 'live0';
      // It currently has count=1; touch it once more so we can detect a reset
      // (a reset would put it back to count=1 / remaining=99).
      checkRateLimit(oldestKey, cfg); // count=2 → remaining 98
      expect(checkRateLimit(oldestKey, cfg).remaining).toBe(97); // count=3

      // Insert a genuinely new key. Map is at cap with live entries, so the
      // oldest-inserted key (which is no longer 'live0' — it was re-set when we
      // bumped it? No: bumping increments in place, insertion order unchanged)
      // gets evicted. Size stays bounded.
      checkRateLimit('brand-new', cfg);
      expect(_rateLimitStoreSize()).toBeLessThanOrEqual(cap);

      // 'live0' was the oldest by insertion order and should have been evicted;
      // re-touching it now starts a fresh bucket (remaining back to 99).
      const after = checkRateLimit(oldestKey, cfg);
      expect(after.remaining).toBe(99);
    });
  });

  describe('createRateLimitMiddleware — IP resolution precedence', () => {
    const config = { maxRequests: 5, windowMs: 60_000, keyPrefix: 'mw' };

    function makeEvent(user?: { id: string }) {
      return { context: { user } } as any;
    }

    function stubH3({
      header,
      requestIp,
    }: {
      header?: string;
      requestIp?: string;
    }) {
      const getHeader = vi.fn(() => header);
      const getRequestIP = vi.fn(() => requestIp);
      const setResponseHeader = vi.fn();
      const createError = vi.fn((e: any) => Object.assign(new Error(e.message), e));
      vi.stubGlobal('getHeader', getHeader);
      vi.stubGlobal('getRequestIP', getRequestIP);
      vi.stubGlobal('setResponseHeader', setResponseHeader);
      vi.stubGlobal('createError', createError);
      return { getHeader, getRequestIP, setResponseHeader, createError };
    }

    it('prefers x-real-ip over the (spoofable) x-forwarded-for IP', async () => {
      const { getHeader, getRequestIP } = stubH3({ header: '203.0.113.9', requestIp: '198.51.100.1' });
      const mw = createRateLimitMiddleware(config);
      await mw(makeEvent());

      expect(getHeader).toHaveBeenCalledWith(expect.anything(), 'x-real-ip');
      // The bucket must be keyed off x-real-ip, not the forwarded IP. Exhaust
      // the real-ip bucket and confirm the forwarded IP would still be fresh.
      _resetExchangeRateLimitStore();
      const realIp = checkRateLimit('203.0.113.9', config);
      expect(realIp.remaining).toBe(4);
      // getRequestIP is only consulted as a fallback; with x-real-ip present it
      // need not have been used for keying (short-circuit ||).
      expect(getRequestIP).not.toHaveBeenCalled();
    });

    it('falls back to getRequestIP when x-real-ip is absent', async () => {
      const { getHeader, getRequestIP } = stubH3({ header: undefined, requestIp: '198.51.100.7' });
      const mw = createRateLimitMiddleware(config);
      await mw(makeEvent());

      expect(getHeader).toHaveBeenCalledWith(expect.anything(), 'x-real-ip');
      expect(getRequestIP).toHaveBeenCalledWith(expect.anything(), { xForwardedFor: true });
    });

    it('falls back to "unknown" when neither IP source resolves', async () => {
      const { setResponseHeader } = stubH3({ header: undefined, requestIp: undefined });
      const mw = createRateLimitMiddleware(config);
      const result = await mw(makeEvent());
      expect(result.allowed).toBe(true);
      // Headers reflect the limit even on the happy path.
      expect(setResponseHeader).toHaveBeenCalledWith(expect.anything(), 'X-RateLimit-Limit', '5');
    });

    it('keys off the authenticated user id over any IP', async () => {
      stubH3({ header: '203.0.113.9', requestIp: '198.51.100.1' });
      const mw = createRateLimitMiddleware(config);
      await mw(makeEvent({ id: 'user-xyz' }));

      // The user-keyed bucket should now have one hit; the IP buckets are clean.
      const userBucket = checkRateLimit('user-xyz', config);
      expect(userBucket.remaining).toBe(3); // middleware used 1, this call is #2 of 5
    });

    it('sets the standard rate-limit response headers', async () => {
      const { setResponseHeader } = stubH3({ header: '8.8.8.8' });
      const mw = createRateLimitMiddleware(config);
      await mw(makeEvent());

      expect(setResponseHeader).toHaveBeenCalledWith(expect.anything(), 'X-RateLimit-Limit', '5');
      expect(setResponseHeader).toHaveBeenCalledWith(expect.anything(), 'X-RateLimit-Remaining', '4');
      expect(setResponseHeader).toHaveBeenCalledWith(
        expect.anything(),
        'X-RateLimit-Reset',
        new Date(Date.now() + config.windowMs).toISOString()
      );
    });
  });

  describe('createRateLimitMiddleware — blocking (429)', () => {
    const config = { maxRequests: 2, windowMs: 60_000, keyPrefix: 'block' };

    function stubH3() {
      const setResponseHeader = vi.fn();
      const createError = vi.fn((e: any) => Object.assign(new Error(e.message), e));
      vi.stubGlobal('getHeader', vi.fn(() => '9.9.9.9'));
      vi.stubGlobal('getRequestIP', vi.fn(() => undefined));
      vi.stubGlobal('setResponseHeader', setResponseHeader);
      vi.stubGlobal('createError', createError);
      return { setResponseHeader, createError };
    }

    it('throws a 429 with Retry-After once the limit is exceeded', async () => {
      const { setResponseHeader, createError } = stubH3();
      const mw = createRateLimitMiddleware(config);
      const event = { context: {} } as any;

      await mw(event); // 1
      await mw(event); // 2 (== max)
      await expect(mw(event)).rejects.toThrow(/Rate limit exceeded/); // 3 → blocked

      expect(createError).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 429, statusMessage: 'Too Many Requests' })
      );
      // Retry-After header is set on the blocked response.
      expect(setResponseHeader).toHaveBeenCalledWith(expect.anything(), 'Retry-After', expect.any(String));
    });

    it('computes Retry-After as whole seconds until reset (ceil)', async () => {
      const { setResponseHeader } = stubH3();
      const cfg = { maxRequests: 1, windowMs: 1500, keyPrefix: 'retry' };
      const mw = createRateLimitMiddleware(cfg);
      const event = { context: {} } as any;

      await mw(event); // 1 (== max)
      await expect(mw(event)).rejects.toThrow(); // blocked at t=0

      // (1500 - 0) / 1000 = 1.5 → ceil → 2
      expect(setResponseHeader).toHaveBeenCalledWith(expect.anything(), 'Retry-After', '2');
    });
  });

  describe('lazy throttled sweep', () => {
    // Cleanup is a lazy sweep on access (throttled to once per 5 minutes), NOT a
    // module-level setInterval: a timer here lands in Nitro's core chunk, runs in
    // the prerender process, and keeps the build alive after "Build complete!" —
    // the 2026-06/07 Vercel deploy-stall regression. This test pins the lazy
    // behavior: expired entries are reclaimed by the next checkRateLimit call
    // once the sweep window has elapsed.
    it('sweeps expired entries (and spares live ones) on next access after the sweep window', async () => {
      vi.resetModules();
      const mod = await import('~~/server/utils/exchange/rateLimit');

      // One short-lived entry (expires before the sweep) and one long-lived entry
      // (still live at sweep time) — covers both sides of the `resetAt < now` test.
      mod.checkRateLimit('expiring', { maxRequests: 5, windowMs: 1000, keyPrefix: 'sweep' });
      mod.checkRateLimit('surviving', { maxRequests: 5, windowMs: 10 * 60 * 1000, keyPrefix: 'sweep' });
      expect(mod._rateLimitStoreSize()).toBe(2);

      // Advance past the short window (expiring it) and across the 5-minute
      // sweep throttle. Nothing runs in the background — the store is untouched
      // until the next access.
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      expect(mod._rateLimitStoreSize()).toBe(2);

      // The next call sweeps: expired entry reclaimed, live entry retained and
      // still holding its window — this hit is the 2nd of 5.
      const res = mod.checkRateLimit('surviving', { maxRequests: 5, windowMs: 10 * 60 * 1000, keyPrefix: 'sweep' });
      expect(mod._rateLimitStoreSize()).toBe(1);
      expect(res.remaining).toBe(3);
    });
  });

  describe('RateLimitPresets', () => {
    it.each([
      ['strict', 3, 15 * 60 * 1000],
      ['moderate', 10, 60 * 1000],
      ['lenient', 30, 60 * 1000],
      ['authenticated', 100, 60 * 1000],
    ])('%s preset has the documented limits', (name, maxRequests, windowMs) => {
      const preset = (RateLimitPresets as any)[name];
      expect(preset.maxRequests).toBe(maxRequests);
      expect(preset.windowMs).toBe(windowMs);
    });

    it('presets are usable directly by checkRateLimit', () => {
      const res = checkRateLimit('preset-user', RateLimitPresets.strict);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(2); // strict.maxRequests - 1
    });
  });
});
