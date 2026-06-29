import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computed } from 'vue';

// Helper: (re)stub the Nuxt route-middleware globals + useAuth, then import the
// middleware fresh so it picks up the current useAuth stub. import.meta.server is
// false under happy-dom (the default test env), so the client branch runs.
async function loadMiddleware(opts: {
  isAuthenticated: boolean;
  waitForAuth?: () => Promise<unknown>;
}) {
  vi.resetModules();
  vi.stubGlobal('defineNuxtRouteMiddleware', (fn: any) => fn);
  vi.stubGlobal(
    'navigateTo',
    vi.fn((path: string, navOpts?: any) => ({ path, ...navOpts }))
  );
  const waitForAuth = opts.waitForAuth ?? vi.fn().mockResolvedValue(true);
  vi.stubGlobal(
    'useAuth',
    vi.fn(() => ({
      waitForAuth,
      isAuthenticated: computed(() => opts.isAuthenticated),
    }))
  );
  const mod = await import('~/app/middleware/exchange-auth');
  return { middleware: mod.default as (to?: any) => Promise<any>, waitForAuth };
}

const exchangeRoute = { path: '/exchange/listings', fullPath: '/exchange/listings' };

describe('exchange-auth middleware', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('passes through (returns undefined) when authenticated', async () => {
    const { middleware, waitForAuth } = await loadMiddleware({ isAuthenticated: true });
    const result = await middleware(exchangeRoute);
    expect(waitForAuth).toHaveBeenCalledTimes(1);
    expect(result).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('redirects to /login (replace) when not authenticated', async () => {
    const { middleware, waitForAuth } = await loadMiddleware({ isAuthenticated: false });
    const result = await middleware(exchangeRoute);
    expect(waitForAuth).toHaveBeenCalledTimes(1);
    expect(navigateTo).toHaveBeenCalledTimes(1);
    expect(navigateTo).toHaveBeenCalledWith('/login', { replace: true });
    // navigateTo's return value is returned by the middleware so Nuxt aborts navigation
    expect(result).toEqual({ path: '/login', replace: true });
  });

  it('awaits waitForAuth BEFORE checking isAuthenticated (anon)', async () => {
    const callOrder: string[] = [];
    let authReady = false;
    const waitForAuth = vi.fn(async () => {
      callOrder.push('waitForAuth');
      authReady = true;
      return true;
    });
    vi.resetModules();
    vi.stubGlobal('defineNuxtRouteMiddleware', (fn: any) => fn);
    vi.stubGlobal(
      'navigateTo',
      vi.fn((path: string, navOpts?: any) => {
        callOrder.push('navigateTo');
        return { path, ...navOpts };
      })
    );
    vi.stubGlobal(
      'useAuth',
      vi.fn(() => ({
        waitForAuth,
        // isAuthenticated should only be read after waitForAuth resolves
        isAuthenticated: computed(() => {
          callOrder.push(`read:${authReady}`);
          return false;
        }),
      }))
    );
    const mod = await import('~/app/middleware/exchange-auth');
    const middleware = mod.default as (to?: any) => Promise<any>;

    await middleware(exchangeRoute);
    expect(callOrder[0]).toBe('waitForAuth');
    expect(callOrder).toContain('read:true');
    expect(callOrder[callOrder.length - 1]).toBe('navigateTo');
  });

  it('does not redirect when waitForAuth resolves authenticated (order: wait then pass)', async () => {
    const callOrder: string[] = [];
    const waitForAuth = vi.fn(async () => {
      callOrder.push('waitForAuth');
      return true;
    });
    const { middleware } = await loadMiddleware({ isAuthenticated: true, waitForAuth });
    const result = await middleware(exchangeRoute);
    expect(callOrder).toEqual(['waitForAuth']);
    expect(result).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('applies to any auth-gated exchange path (e.g. /exchange/messages)', async () => {
    const { middleware } = await loadMiddleware({ isAuthenticated: false });
    await middleware({ path: '/exchange/messages', fullPath: '/exchange/messages' });
    expect(navigateTo).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('passes through on a gated path when authenticated (e.g. /exchange/watchlist)', async () => {
    const { middleware } = await loadMiddleware({ isAuthenticated: true });
    const result = await middleware({ path: '/exchange/watchlist', fullPath: '/exchange/watchlist' });
    expect(result).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('always calls useAuth (named middleware, no path gate) for anon', async () => {
    const { waitForAuth } = await loadMiddleware({ isAuthenticated: false });
    const mod = await import('~/app/middleware/exchange-auth');
    const middleware = mod.default as (to?: any) => Promise<any>;
    await middleware(exchangeRoute);
    expect(waitForAuth).toHaveBeenCalled();
  });

  // NOTE: the SSR short-circuit (`if (import.meta.server) return;`) cannot be
  // exercised here — vite-node statically inlines `import.meta.server` to `false`
  // for the happy-dom client env, so the server branch is dead code at test time.
  // The client branch (below/above) is the full testable surface.
});
