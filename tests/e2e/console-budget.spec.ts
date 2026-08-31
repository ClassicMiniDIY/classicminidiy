import { expect, test } from './_fixtures';
import { type ConsoleMessage, type Page } from '@playwright/test';
import { gotoHydrated } from './_helpers';

/**
 * No route may hydrate with a console error or a Vue hydration warning.
 *
 * This is the single most valuable assertion in the suite, because a hydration
 * mismatch is not a cosmetic warning here — Vue's repair merges the server and
 * client subtrees, and the resulting DOM corruption is what orphaned the nav
 * dropdown from its wrapper. Vue logs "Hydration node mismatch" (dev builds) at
 * exactly the moment that happens, so watching the console turns a silent
 * structural bug into a hard failure.
 *
 * Runs in Firefox as well as Chromium: hydration repair is browser- and
 * timing-dependent, and the nav bug reproduced only in Firefox.
 */

/** One route per rendering shape, not every route — the crawler covers breadth. */
const ROUTES = [
  '/',
  '/technical',
  '/technical/gearing',
  '/technical/needles',
  '/archive',
  '/archive/documents',
  '/archive/colors',
  '/exchange',
  '/exchange/listings',
  '/models',
  '/search',
  '/login',
  '/membership',
  '/contribute',
  // The dashboard shell is the parent layout for 14 routes, and it branches on
  // auth. Signed out it must render its neutral resolving state on both sides,
  // so hydration has nothing to repair.
  '/dashboard/models',
];

/**
 * Console noise that is not ours to fix and not a signal of breakage.
 * Keep this list short and specific — a broad pattern here silently disables
 * the whole check.
 */
const IGNORED = [
  // Third-party embeds and analytics blocked in a clean automation profile.
  /posthog/i,
  /Failed to load resource.*(fonts\.googleapis|ytimg|youtube|mapbox|turnstile)/i,
  // Dev-server HMR chatter.
  /\[vite\]/i,
  // Supabase has no session in a fresh context; the app handles this.
  /AuthSessionMissingError/i,
];

const HYDRATION_PATTERN = /hydration|hydrat(e|ing) (node|children|text|class|style|attribute)/i;

function collect(page: Page) {
  const errors: string[] = [];
  const hydration: string[] = [];

  const onMessage = (message: ConsoleMessage) => {
    const text = message.text();
    if (IGNORED.some((pattern) => pattern.test(text))) return;
    if (HYDRATION_PATTERN.test(text)) {
      hydration.push(text);
      return;
    }
    if (message.type() === 'error') errors.push(text);
  };

  page.on('console', onMessage);
  // An uncaught exception never reaches the console listener.
  page.on('pageerror', (error) => {
    const text = String(error?.message ?? error);
    if (IGNORED.some((pattern) => pattern.test(text))) return;
    errors.push(`pageerror: ${text}`);
  });

  return { errors, hydration };
}

test.describe('console budget', () => {
  for (const route of ROUTES) {
    test(`${route} hydrates with no console errors`, async ({ page }) => {
      const { errors, hydration } = collect(page);

      await gotoHydrated(page, route);

      expect(
        hydration,
        `${route} logged a Vue hydration warning. Vue's repair MERGES the mismatched subtrees, ` +
          'which is how the nav dropdown lost its wrapper. Gate the branch on a hasMounted ref.'
      ).toEqual([]);
      expect(errors, `${route} logged console errors`).toEqual([]);
    });
  }
});
