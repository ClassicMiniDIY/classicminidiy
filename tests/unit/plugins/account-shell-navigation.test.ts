/**
 * app/plugins/account-shell-navigation.client.ts: a section change inside an
 * account shell skips the page-level view transition and scroll-to-top.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

type Guard = (to: { path: string; meta: Record<string, unknown> }, from: { path: string }) => void;

async function installPlugin(): Promise<Guard> {
  let guard: Guard | undefined;
  vi.stubGlobal('defineNuxtPlugin', (setup: () => void) => setup);
  vi.stubGlobal('useRouter', () => ({ beforeEach: (g: Guard) => (guard = g) }));
  const { isAccountShellSectionChange } = await import('~/app/utils/accountShellNavigation');
  vi.stubGlobal('isAccountShellSectionChange', isAccountShellSectionChange);
  const plugin = (await import('~/app/plugins/account-shell-navigation.client')).default as unknown as () => void;
  plugin();
  return guard!;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('account shell navigation plugin', () => {
  it('turns off the view transition and scroll-to-top for a section change', async () => {
    const guard = await installPlugin();
    const to = { path: '/settings/api-keys', meta: {} as Record<string, unknown> };
    guard(to, { path: '/settings/membership' });
    expect(to.meta).toEqual({ viewTransition: false, scrollToTop: false });
  });

  it('keeps the saved scroll position on back/forward, still without the view transition', async () => {
    const guard = await installPlugin();
    window.dispatchEvent(new PopStateEvent('popstate'));
    const to = { path: '/settings/membership', meta: {} as Record<string, unknown> };
    guard(to, { path: '/settings/api-keys' });
    expect(to.meta).toEqual({ viewTransition: false });

    // The flag is spent on that navigation; the next click keeps the position again.
    const next = { path: '/settings/security', meta: {} as Record<string, unknown> };
    guard(next, { path: '/settings/membership' });
    expect(next.meta).toEqual({ viewTransition: false, scrollToTop: false });
  });

  it('leaves navigation into a shell from another page alone', async () => {
    const guard = await installPlugin();
    const to = { path: '/settings/preferences', meta: {} as Record<string, unknown> };
    guard(to, { path: '/about' });
    expect(to.meta).toEqual({});
  });
});
