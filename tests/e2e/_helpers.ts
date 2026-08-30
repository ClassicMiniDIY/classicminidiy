import type { Page } from '@playwright/test';

/**
 * Navigate and wait for HYDRATION, not for the network.
 *
 * `waitForLoadState('networkidle')` is the obvious choice and the wrong one
 * here: `/login` mounts a Turnstile widget that keeps a connection open, so the
 * network never goes idle and the wait burns its full timeout before failing on
 * a page that hydrated in 118ms.
 *
 * Vue assigns `__vue_app__` to the mount element when `app.mount()` completes,
 * which is precisely the moment hydration has finished — and precisely when a
 * mismatch warning would already have been logged. It is both faster and a
 * better signal than any network heuristic.
 */
export async function gotoHydrated(page: Page, route: string, { settleMs = 250 } = {}) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => !!(document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: unknown }) | null)?.__vue_app__,
    null,
    { timeout: 30_000 }
  );
  // A brief settle so post-mount effects (auth init, watchers with
  // `immediate: true`) have run before anything is asserted.
  await page.waitForTimeout(settleMs);
  return response;
}
