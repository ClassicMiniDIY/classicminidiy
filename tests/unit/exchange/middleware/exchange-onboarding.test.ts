import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

// Tests for the hard onboarding gate that guards the Mini Exchange section.
// Source: app/middleware/exchange-onboarding.global.ts
//
// The middleware imports EXCHANGE_ONBOARDING_PREFIXES + pathInPrefixes from
// ~/utils/exchangeRoutes — those resolve for real via the vitest alias, so the
// prefix-matching is exercised end-to-end (not mocked). Everything else
// (defineNuxtRouteMiddleware, navigateTo, useRuntimeConfig, useAuth) is a Nuxt
// auto-import stubbed as a global per case.
//
// Key contract (open-browsing model):
//   - GATED action routes: EXCHANGE_ONBOARDING_PREFIXES =
//       ['/exchange/listings/new', '/exchange/listings/bulk',
//        '/exchange/wanted/new', '/exchange/finds/submit', '/exchange/messages']
//   - OPEN to everyone: browse/detail ('/exchange/listings', '/exchange/listings/123'),
//     landing, dashboard tabs ('/dashboard/listings', '/dashboard/wanted', etc.)
//   - For gated routes: anonymous → pass; authed+complete → pass;
//     authed+incomplete → redirect to /onboarding?redirect=<encoded-fullPath>
//
// NOTE on the `import.meta.server` early-return: vitest.config.ts rewrites
// `import.meta.server` to the literal `(false)` at transform time, so on the
// client (the only env these tests run in) that branch is statically dead and
// cannot be reached by importing the module. The first reachable short-circuit
// is the flag-off return, which is covered exhaustively below.

type Route = { path: string; fullPath: string };

// A real action route — sits inside EXCHANGE_ONBOARDING_PREFIXES.
const ACTION_ROUTE: Route = { path: '/exchange/listings/new', fullPath: '/exchange/listings/new' };

describe('exchange-onboarding global middleware', () => {
  // Mutable auth state the stubbed useAuth() closes over.
  let user: ReturnType<typeof ref<any>>;
  let userProfile: ReturnType<typeof ref<any>>;
  let waitForAuth: ReturnType<typeof vi.fn>;
  let fetchUserProfile: ReturnType<typeof vi.fn>;

  // Build (or rebuild) all the global stubs and import a fresh copy of the
  // middleware. Re-importing matters because the module caches `verifiedUserId`
  // at module scope; resetModules + re-import gives each case a clean cache.
  async function loadMiddleware(exchangeEnabled: boolean) {
    vi.resetModules();

    vi.stubGlobal('defineNuxtRouteMiddleware', (fn: any) => fn);
    vi.stubGlobal(
      'navigateTo',
      vi.fn((path: string, opts?: any) => ({ path, ...opts }))
    );
    vi.stubGlobal(
      'useRuntimeConfig',
      vi.fn(() => ({ public: { exchangeEnabled } }))
    );
    vi.stubGlobal(
      'useAuth',
      vi.fn(() => ({ user, userProfile, waitForAuth, fetchUserProfile }))
    );

    const mod = await import('~/app/middleware/exchange-onboarding.global');
    return mod.default as (to: Route) => Promise<any>;
  }

  beforeEach(() => {
    user = ref(null);
    userProfile = ref(null);
    // Default: auth settles immediately on the first bounded wait.
    waitForAuth = vi.fn().mockResolvedValue(true);
    fetchUserProfile = vi.fn(async () => {});
  });

  it('passes through when the exchange flag is OFF (never touches auth)', async () => {
    const middleware = await loadMiddleware(false);
    const result = await middleware(ACTION_ROUTE);

    expect(result).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
    // Flag-off returns before useAuth is even called.
    expect(waitForAuth).not.toHaveBeenCalled();
  });

  it('passes through for a route NOT in EXCHANGE_ONBOARDING_PREFIXES (flag on)', async () => {
    const middleware = await loadMiddleware(true);
    const result = await middleware({ path: '/technical/needles', fullPath: '/technical/needles' });

    expect(result).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
    // Prefix miss short-circuits before auth.
    expect(waitForAuth).not.toHaveBeenCalled();
  });

  it('passes through for /dashboard/settings (not an exchange action route)', async () => {
    const middleware = await loadMiddleware(true);
    const result = await middleware({ path: '/dashboard/settings', fullPath: '/dashboard/settings' });

    expect(result).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
    expect(waitForAuth).not.toHaveBeenCalled();
  });

  // Open-browsing model: dashboard exchange tabs are NOT gated — pass through
  // even for an authed user with an incomplete profile.
  it.each([
    ['/dashboard/listings'],
    ['/dashboard/wanted'],
    ['/dashboard/notifications'],
    ['/dashboard/saved-searches'],
  ])('passes through exchange-owned dashboard tab %s (open to all, no onboarding required)', async (path) => {
    user = ref({ id: 'u1' });
    userProfile = ref({ onboarding_completed: false });
    const middleware = await loadMiddleware(true);

    const result = await middleware({ path, fullPath: path });

    expect(result).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
    // Dashboard tabs are open — middleware returns before ever reaching auth.
    expect(waitForAuth).not.toHaveBeenCalled();
  });

  // Open-browsing model: browse/detail routes pass through for incomplete users.
  it.each([
    ['/exchange/listings'],
    ['/exchange/listings/123'],
    ['/exchange/wanted'],
    ['/exchange/finds'],
    ['/dashboard/listings'],
  ])(
    'passes through open browse/detail route %s for an authed incomplete user',
    async (path) => {
      user = ref({ id: 'u1' });
      userProfile = ref({ onboarding_completed: false });
      const middleware = await loadMiddleware(true);

      const result = await middleware({ path, fullPath: path });

      expect(result).toBeUndefined();
      expect(navigateTo).not.toHaveBeenCalled();
    }
  );

  // The five real action routes in EXCHANGE_ONBOARDING_PREFIXES must redirect
  // an authed user with an incomplete profile.
  it.each([
    ['/exchange/listings/new'],
    ['/exchange/listings/bulk'],
    ['/exchange/wanted/new'],
    ['/exchange/finds/submit'],
    ['/exchange/messages'],
  ])('redirects an incomplete authed user on gated action route %s', async (path) => {
    user = ref({ id: 'u1' });
    userProfile = ref({ onboarding_completed: false });
    const middleware = await loadMiddleware(true);

    await middleware({ path, fullPath: path });

    expect(navigateTo).toHaveBeenCalledWith(`/onboarding?redirect=${encodeURIComponent(path)}`);
  });

  it('never traps the /onboarding page itself (would loop)', async () => {
    user = ref({ id: 'u1' });
    userProfile = ref({ onboarding_completed: false });
    const middleware = await loadMiddleware(true);

    // /onboarding is not in EXCHANGE_ONBOARDING_PREFIXES, so it short-circuits at the
    // prefix check; assert it is never redirected regardless.
    const result = await middleware({ path: '/onboarding', fullPath: '/onboarding' });

    expect(result).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('never traps /auth/callback', async () => {
    user = ref({ id: 'u1' });
    userProfile = ref({ onboarding_completed: false });
    const middleware = await loadMiddleware(true);

    const result = await middleware({ path: '/auth/callback', fullPath: '/auth/callback' });

    expect(result).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('passes through anonymous visitors (user null after waitForAuth)', async () => {
    user = ref(null);
    const middleware = await loadMiddleware(true);

    const result = await middleware(ACTION_ROUTE);

    expect(result).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
    expect(waitForAuth).toHaveBeenCalled();
    // Anonymous → never tries to load a profile.
    expect(fetchUserProfile).not.toHaveBeenCalled();
  });

  it('passes through an authed user whose profile is already complete', async () => {
    user = ref({ id: 'u1' });
    userProfile = ref({ onboarding_completed: true });
    const middleware = await loadMiddleware(true);

    const result = await middleware(ACTION_ROUTE);

    expect(result).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
    // Profile already present → no refetch.
    expect(fetchUserProfile).not.toHaveBeenCalled();
  });

  it('fetches the profile when not yet loaded, then passes when complete', async () => {
    user = ref({ id: 'u1' });
    userProfile = ref(null);
    fetchUserProfile = vi.fn(async (_id: string) => {
      // Simulate the deferred onAuthStateChange fetch populating the profile.
      userProfile.value = { onboarding_completed: true };
    });
    const middleware = await loadMiddleware(true);

    const result = await middleware(ACTION_ROUTE);

    expect(fetchUserProfile).toHaveBeenCalledWith('u1');
    expect(navigateTo).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('redirects an authed user with an INCOMPLETE profile to /onboarding with redirect', async () => {
    user = ref({ id: 'u1' });
    userProfile = ref({ onboarding_completed: false });
    const to: Route = {
      path: '/exchange/listings/new',
      fullPath: '/exchange/listings/new?foo=bar',
    };
    const middleware = await loadMiddleware(true);

    await middleware(to);

    expect(navigateTo).toHaveBeenCalledTimes(1);
    expect(navigateTo).toHaveBeenCalledWith(`/onboarding?redirect=${encodeURIComponent(to.fullPath)}`);
  });

  it('redirects when the profile is still unknown after fetch (no onboarding_completed)', async () => {
    user = ref({ id: 'u1' });
    userProfile = ref(null);
    // fetch resolves but profile stays null (e.g. row not yet created).
    fetchUserProfile = vi.fn(async () => {});
    const middleware = await loadMiddleware(true);

    await middleware(ACTION_ROUTE);

    expect(fetchUserProfile).toHaveBeenCalledWith('u1');
    expect(navigateTo).toHaveBeenCalledWith(
      `/onboarding?redirect=${encodeURIComponent(ACTION_ROUTE.fullPath)}`
    );
  });

  it('properly URL-encodes the redirect target (spaces and ampersands)', async () => {
    user = ref({ id: 'u1' });
    userProfile = ref({ onboarding_completed: false });
    // Use a real action route so the gate is reached.
    const to: Route = {
      path: '/exchange/listings/new',
      fullPath: '/exchange/listings/new?title=mini cooper&year=1979',
    };
    const middleware = await loadMiddleware(true);

    await middleware(to);

    const expected = `/onboarding?redirect=${encodeURIComponent('/exchange/listings/new?title=mini cooper&year=1979')}`;
    expect(navigateTo).toHaveBeenCalledWith(expected);
    // Spaces/ampersands must be encoded, not raw.
    expect(navigateTo).not.toHaveBeenCalledWith(
      '/onboarding?redirect=/exchange/listings/new?title=mini cooper&year=1979'
    );
  });

  it('caches a verified user — second navigation skips the profile fetch', async () => {
    user = ref({ id: 'u1' });
    userProfile = ref({ onboarding_completed: true });
    const middleware = await loadMiddleware(true);

    // First pass verifies + caches the id.
    await middleware(ACTION_ROUTE);
    expect(navigateTo).not.toHaveBeenCalled();

    // Now blank the profile to prove the cache short-circuits before any
    // profile read on the second in-section navigation.
    userProfile = ref(null);
    fetchUserProfile = vi.fn(async () => {});
    const result = await middleware({ path: '/exchange/messages', fullPath: '/exchange/messages' });

    expect(result).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
    expect(fetchUserProfile).not.toHaveBeenCalled();
  });

  it('does NOT use a stale cache for a different user id', async () => {
    // First user verifies and gets cached.
    user = ref({ id: 'u1' });
    userProfile = ref({ onboarding_completed: true });
    const middleware = await loadMiddleware(true);
    await middleware(ACTION_ROUTE);
    expect(navigateTo).not.toHaveBeenCalled();

    // A different incomplete user on the same (non-reset) module must NOT be
    // treated as verified.
    user = ref({ id: 'u2' });
    userProfile = ref({ onboarding_completed: false });
    await middleware(ACTION_ROUTE);

    expect(navigateTo).toHaveBeenCalledWith(
      `/onboarding?redirect=${encodeURIComponent(ACTION_ROUTE.fullPath)}`
    );
  });

  it('extends the wait once when the bounded waitForAuth(1500) times out', async () => {
    user = ref({ id: 'u1' });
    userProfile = ref({ onboarding_completed: true });
    // First (bounded) call times out → false; second (unbounded) settles → true.
    waitForAuth = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const middleware = await loadMiddleware(true);

    const result = await middleware(ACTION_ROUTE);

    expect(waitForAuth).toHaveBeenCalledTimes(2);
    expect(waitForAuth).toHaveBeenNthCalledWith(1, 1500);
    expect(waitForAuth).toHaveBeenNthCalledWith(2); // extended call, no arg
    // After the extended wait resolves the (complete) user, they pass.
    expect(result).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('does NOT extend the wait when the bounded waitForAuth(1500) succeeds first', async () => {
    user = ref(null);
    waitForAuth = vi.fn().mockResolvedValue(true);
    const middleware = await loadMiddleware(true);

    await middleware(ACTION_ROUTE);

    expect(waitForAuth).toHaveBeenCalledTimes(1);
    expect(waitForAuth).toHaveBeenCalledWith(1500);
  });

  it('after an extended wait, a slow-loading incomplete user is still redirected (not bypassed)', async () => {
    // Regression guard: a slow logged-in user must not be read as anonymous.
    user = ref({ id: 'u-slow' });
    userProfile = ref({ onboarding_completed: false });
    waitForAuth = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const middleware = await loadMiddleware(true);

    await middleware(ACTION_ROUTE);

    expect(waitForAuth).toHaveBeenCalledTimes(2);
    expect(navigateTo).toHaveBeenCalledWith(
      `/onboarding?redirect=${encodeURIComponent(ACTION_ROUTE.fullPath)}`
    );
  });
});
