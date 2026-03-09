import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';

describe('admin middleware', () => {
  let middleware: (to: any) => Promise<any>;

  const mockWaitForAuth = vi.fn().mockResolvedValue(true);
  let mockIsAuthenticated = computed(() => false);
  let mockIsAdmin = computed(() => false);

  beforeEach(async () => {
    vi.resetModules();

    // Re-stub globals after resetModules
    vi.stubGlobal('defineNuxtRouteMiddleware', (fn: any) => fn);
    vi.stubGlobal(
      'navigateTo',
      vi.fn((path: string, opts?: any) => ({ path, ...opts }))
    );

    mockWaitForAuth.mockClear();
    mockWaitForAuth.mockResolvedValue(true);
    mockIsAuthenticated = computed(() => false);
    mockIsAdmin = computed(() => false);

    vi.stubGlobal(
      'useAuth',
      vi.fn(() => ({
        waitForAuth: mockWaitForAuth,
        isAuthenticated: mockIsAuthenticated,
        isAdmin: mockIsAdmin,
      }))
    );

    const mod = await import('~/app/middleware/admin.global');
    middleware = mod.default;
  });

  it('does nothing for non-admin routes', async () => {
    const result = await middleware({ path: '/about' });
    expect(result).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
    // Should not even call useAuth for non-admin routes
    expect(mockWaitForAuth).not.toHaveBeenCalled();
  });

  it('does nothing for root path', async () => {
    const result = await middleware({ path: '/' });
    expect(result).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('redirects to /login when not authenticated on admin route', async () => {
    mockIsAuthenticated = computed(() => false);
    mockIsAdmin = computed(() => false);
    vi.stubGlobal(
      'useAuth',
      vi.fn(() => ({
        waitForAuth: mockWaitForAuth,
        isAuthenticated: mockIsAuthenticated,
        isAdmin: mockIsAdmin,
      }))
    );

    // Re-import to pick up new useAuth mock
    vi.resetModules();
    vi.stubGlobal('defineNuxtRouteMiddleware', (fn: any) => fn);
    vi.stubGlobal(
      'navigateTo',
      vi.fn((path: string, opts?: any) => ({ path, ...opts }))
    );
    vi.stubGlobal(
      'useAuth',
      vi.fn(() => ({
        waitForAuth: mockWaitForAuth,
        isAuthenticated: computed(() => false),
        isAdmin: computed(() => false),
      }))
    );

    const mod = await import('~/app/middleware/admin.global');
    const mw = mod.default;

    const result = await mw({ path: '/admin' });
    expect(mockWaitForAuth).toHaveBeenCalled();
    expect(navigateTo).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('redirects to /login when authenticated but NOT admin', async () => {
    vi.resetModules();
    vi.stubGlobal('defineNuxtRouteMiddleware', (fn: any) => fn);
    vi.stubGlobal(
      'navigateTo',
      vi.fn((path: string, opts?: any) => ({ path, ...opts }))
    );
    vi.stubGlobal(
      'useAuth',
      vi.fn(() => ({
        waitForAuth: mockWaitForAuth,
        isAuthenticated: computed(() => true),
        isAdmin: computed(() => false),
      }))
    );

    const mod = await import('~/app/middleware/admin.global');
    const mw = mod.default;

    const result = await mw({ path: '/admin/users' });
    expect(mockWaitForAuth).toHaveBeenCalled();
    expect(navigateTo).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('allows access when authenticated AND admin', async () => {
    vi.resetModules();
    vi.stubGlobal('defineNuxtRouteMiddleware', (fn: any) => fn);
    vi.stubGlobal(
      'navigateTo',
      vi.fn((path: string, opts?: any) => ({ path, ...opts }))
    );
    vi.stubGlobal(
      'useAuth',
      vi.fn(() => ({
        waitForAuth: mockWaitForAuth,
        isAuthenticated: computed(() => true),
        isAdmin: computed(() => true),
      }))
    );

    const mod = await import('~/app/middleware/admin.global');
    const mw = mod.default;

    const result = await mw({ path: '/admin' });
    expect(mockWaitForAuth).toHaveBeenCalled();
    expect(navigateTo).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('calls waitForAuth before checking authentication', async () => {
    vi.resetModules();
    vi.stubGlobal('defineNuxtRouteMiddleware', (fn: any) => fn);
    vi.stubGlobal(
      'navigateTo',
      vi.fn((path: string, opts?: any) => ({ path, ...opts }))
    );

    const callOrder: string[] = [];
    const trackingWaitForAuth = vi.fn(async () => {
      callOrder.push('waitForAuth');
      return true;
    });
    const trackingNavigateTo = vi.fn((path: string, opts?: any) => {
      callOrder.push('navigateTo');
      return { path, ...opts };
    });
    vi.stubGlobal('navigateTo', trackingNavigateTo);
    vi.stubGlobal(
      'useAuth',
      vi.fn(() => ({
        waitForAuth: trackingWaitForAuth,
        isAuthenticated: computed(() => false),
        isAdmin: computed(() => false),
      }))
    );

    const mod = await import('~/app/middleware/admin.global');
    const mw = mod.default;

    await mw({ path: '/admin/dashboard' });
    expect(callOrder[0]).toBe('waitForAuth');
    expect(callOrder[1]).toBe('navigateTo');
  });

  it('applies to nested admin routes like /admin/listings', async () => {
    vi.resetModules();
    vi.stubGlobal('defineNuxtRouteMiddleware', (fn: any) => fn);
    vi.stubGlobal(
      'navigateTo',
      vi.fn((path: string, opts?: any) => ({ path, ...opts }))
    );
    vi.stubGlobal(
      'useAuth',
      vi.fn(() => ({
        waitForAuth: mockWaitForAuth,
        isAuthenticated: computed(() => true),
        isAdmin: computed(() => true),
      }))
    );

    const mod = await import('~/app/middleware/admin.global');
    const mw = mod.default;

    const result = await mw({ path: '/admin/listings' });
    expect(mockWaitForAuth).toHaveBeenCalled();
    expect(navigateTo).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
