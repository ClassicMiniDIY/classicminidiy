import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EXCHANGE_FLAG_PREFIXES } from '~~/app/utils/exchangeRoutes';

// Unit tests for the Mini Exchange cutover flag-gate middleware
// (app/middleware/exchange-flag.global.ts).
//
// Contract under test:
//   - Runs on server AND client (no import.meta.server skip) so SSR 404s.
//   - Guards every prefix in EXCHANGE_FLAG_PREFIXES (and their descendants).
//   - When the route is guarded AND exchangeEnabled is falsy => throw a
//     createError({ statusCode: 404 }).
//   - When the route is guarded AND exchangeEnabled is true => return undefined
//     (pass) without touching the config? (it DOES read config, but returns).
//   - When the route is NOT guarded => return undefined WITHOUT reading config,
//     regardless of flag state.
//
// Follows the tests/unit/middleware/admin.test.ts pattern: resetModules +
// re-stub globals in beforeEach, then dynamic-import the default export.

describe('exchange-flag.global middleware', () => {
  let middleware: (to: any) => any;
  let mockUseRuntimeConfig: ReturnType<typeof vi.fn>;

  // Builds a runtimeConfig stub whose public.exchangeEnabled is `enabled`.
  const stubConfig = (enabled: unknown) => {
    mockUseRuntimeConfig = vi.fn(() => ({ public: { exchangeEnabled: enabled } }));
    vi.stubGlobal('useRuntimeConfig', mockUseRuntimeConfig);
  };

  // Mirrors the setup-file createError: an Error carrying statusCode/statusMessage.
  const stubCreateError = () => {
    vi.stubGlobal('createError', (opts: any) => {
      const err: any = new Error(opts?.statusMessage || opts?.message || 'error');
      err.statusCode = opts?.statusCode;
      err.statusMessage = opts?.statusMessage;
      return err;
    });
  };

  const loadMiddleware = async () => {
    const mod = await import('~/app/middleware/exchange-flag.global');
    middleware = mod.default;
  };

  // Re-load the middleware with a fresh exchangeEnabled value mid-test (admin.test
  // pattern: resetModules + re-stub the globals the middleware closes over).
  const reload = async (enabled: unknown) => {
    vi.resetModules();
    vi.stubGlobal('defineNuxtRouteMiddleware', (fn: any) => fn);
    stubCreateError();
    stubConfig(enabled);
    await loadMiddleware();
  };

  beforeEach(async () => {
    vi.resetModules();

    // Re-stub Nuxt auto-import globals after resetModules.
    vi.stubGlobal('defineNuxtRouteMiddleware', (fn: any) => fn);
    vi.stubGlobal(
      'navigateTo',
      vi.fn((path: string, opts?: any) => ({ path, ...opts }))
    );
    stubCreateError();
    // Default: flag OFF (pre-cutover, the production default).
    stubConfig(false);

    await loadMiddleware();
  });

  // ---- Sanity: the guarded set we're asserting against ----
  it('guards exactly the EXCHANGE_FLAG_PREFIXES set', () => {
    expect(EXCHANGE_FLAG_PREFIXES).toEqual([
      '/exchange',
      '/dashboard/listings',
      '/dashboard/wanted',
      '/dashboard/notifications',
      '/dashboard/saved-searches',
      '/onboarding',
      '/admin/exchange',
    ]);
  });

  // ============================================================
  // Flag OFF (default) => guarded routes 404
  // ============================================================
  describe('flag OFF (exchangeEnabled falsy) — guarded routes 404', () => {
    it.each(EXCHANGE_FLAG_PREFIXES)('throws 404 on exact guarded prefix %s', (path) => {
      expect(() => middleware({ path, fullPath: path })).toThrow();
      try {
        middleware({ path, fullPath: path });
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.statusMessage).toBe('Page not found');
      }
    });

    it.each([
      '/exchange/listings',
      '/exchange/listing/abc-123',
      '/exchange/profile/settings',
      '/exchange/a/b/c/d/e/f',
      '/dashboard/listings/new',
      '/dashboard/listings/42/edit',
      '/dashboard/wanted/create',
      '/dashboard/notifications/unread',
      '/dashboard/saved-searches/5',
      '/onboarding/step-2',
      '/admin/exchange/reports/3',
    ])('throws 404 on nested guarded path %s', (path) => {
      expect(() => middleware({ path, fullPath: path })).toThrow();
      try {
        middleware({ path, fullPath: path });
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
      }
    });

    it('reads exchangeEnabled from useRuntimeConfig().public on a guarded route', () => {
      expect(() => middleware({ path: '/exchange', fullPath: '/exchange' })).toThrow();
      expect(mockUseRuntimeConfig).toHaveBeenCalled();
    });

    it('throws on the SERVER too (no import.meta.server skip) so SSR returns a real 404', async () => {
      // The middleware has no server-skip; flag-gate must fire identically
      // regardless of environment. happy-dom is the env, but the source has
      // no environment branch — assert it still throws (proxy for server behavior).
      expect(() => middleware({ path: '/exchange', fullPath: '/exchange' })).toThrow();
    });
  });

  // ============================================================
  // Flag OFF => unguarded routes still PASS (never read/throw)
  // ============================================================
  describe('flag OFF — unguarded routes pass regardless', () => {
    it.each([
      '/',
      '/technical',
      '/technical/needles',
      '/archive/manuals',
      '/about',
      '/membership',
      '/admin', // bare /admin is NOT guarded (only /admin/exchange is)
      '/admin/users',
      '/dashboard', // bare /dashboard is NOT guarded
      '/dashboard/models',
      '/dashboard/purchases',
      '/dashboard/gear-configs',
    ])('returns undefined (pass) for unguarded path %s', (path) => {
      const result = middleware({ path, fullPath: path });
      expect(result).toBeUndefined();
    });

    it('short-circuits before reading config for unguarded paths', () => {
      middleware({ path: '/technical', fullPath: '/technical' });
      // Guard clause returns before touching useRuntimeConfig.
      expect(mockUseRuntimeConfig).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // Prefix-boundary safety — siblings sharing a string prefix must NOT 404
  // ============================================================
  describe('flag OFF — sibling routes sharing a string prefix are NOT guarded', () => {
    it.each([
      '/exchanger',
      '/exchanges',
      '/exchange-rates',
      '/exchangeable',
      '/exchang', // truncated, not a prefix at all
      '/dashboard/listings-archive',
      '/dashboard/listingsxyz',
      '/dashboard/wantedly',
      '/dashboard/notifications-settings',
      '/dashboard/saved-searches-export',
      '/onboarding-complete',
      '/admin/exchanger',
    ])('passes (no 404) for sibling path %s', (path) => {
      const result = middleware({ path, fullPath: path });
      expect(result).toBeUndefined();
    });
  });

  // ============================================================
  // Flag ON => guarded routes PASS
  // ============================================================
  describe('flag ON (exchangeEnabled true) — guarded routes pass', () => {
    beforeEach(async () => {
      await reload(true);
    });

    it.each(EXCHANGE_FLAG_PREFIXES)('returns undefined on exact guarded prefix %s', (path) => {
      const result = middleware({ path, fullPath: path });
      expect(result).toBeUndefined();
    });

    it.each([
      '/exchange/listings',
      '/dashboard/listings/new',
      '/dashboard/wanted/create',
      '/dashboard/notifications/unread',
      '/dashboard/saved-searches/5',
      '/onboarding/step-2',
      '/admin/exchange/reports/3',
    ])('returns undefined on nested guarded path %s', (path) => {
      const result = middleware({ path, fullPath: path });
      expect(result).toBeUndefined();
    });

    it('does not throw on a guarded route when the flag is on', () => {
      expect(() => middleware({ path: '/exchange', fullPath: '/exchange' })).not.toThrow();
    });

    it('still passes unguarded routes when the flag is on', () => {
      expect(middleware({ path: '/technical', fullPath: '/technical' })).toBeUndefined();
      expect(middleware({ path: '/', fullPath: '/' })).toBeUndefined();
    });
  });

  // ============================================================
  // Falsy-flag variants all gate (undefined / '' / 0 / null)
  // ============================================================
  describe('falsy exchangeEnabled variants all 404 a guarded route', () => {
    it.each([
      ['undefined', undefined],
      ['empty string', ''],
      ['zero', 0],
      ['null', null],
      ['false', false],
    ])('404s when exchangeEnabled is %s', async (_label, value) => {
      await reload(value);
      expect(() => middleware({ path: '/exchange', fullPath: '/exchange' })).toThrow();
      try {
        middleware({ path: '/exchange', fullPath: '/exchange' });
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
      }
    });

    it('truthy non-boolean (string "true") passes the gate', async () => {
      // Source uses `if (!exchangeEnabled)`, so any truthy value lights routes up.
      await reload('true');
      expect(middleware({ path: '/exchange', fullPath: '/exchange' })).toBeUndefined();
    });
  });

  // ============================================================
  // Route shape robustness
  // ============================================================
  describe('uses to.path (not fullPath) for matching', () => {
    it('matches on path even when fullPath carries a query string', () => {
      // path is the guarded value; the gate keys off to.path.
      expect(() =>
        middleware({ path: '/exchange', fullPath: '/exchange?ref=email' })
      ).toThrow();
    });

    it('a child path passes flag-on regardless of query in fullPath', async () => {
      await reload(true);
      expect(
        middleware({ path: '/exchange/listings', fullPath: '/exchange/listings?sort=new' })
      ).toBeUndefined();
    });
  });
});
