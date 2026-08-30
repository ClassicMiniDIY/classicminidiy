import { expect, test } from '@playwright/test';
import { gotoHydrated } from './_helpers';

/**
 * The nav dropdown regression suite.
 *
 * The reported symptom — "the account menu is always visible and off-screen" —
 * was never a CSS bug. `MainNav` branched a `v-if`/`v-else` pair straight off
 * `isAuthenticated`, which is always false during SSR (the Supabase session is
 * in localStorage) and true on the client's first render. Vue's hydration
 * repair MERGED the two subtrees: the signed-out wrapper survived and the
 * account `<ul class="dropdown-content">` was patched INTO it, orphaned from
 * any `.dropdown`. Every rule that positions or hides a menu is scoped
 * `.dropdown … .dropdown-content`, so the orphan lost `position: absolute`
 * (laid out in the header flex row, spilling right) AND its closed-state
 * `display: none` (never hid). One defect, both symptoms — and the neighbouring
 * language dropdown was taken down as collateral, which is the tell that this
 * is structural corruption rather than styling.
 *
 * The first test below is the direct assertion: no `.dropdown-content` may
 * exist without a `.dropdown` ancestor. It is browser-independent and it fails
 * the instant hydration corrupts the tree.
 *
 * This spec runs in FIREFOX as well as Chromium on purpose. The bug reproduced
 * only in Firefox 154, and every prior verification ran in Chromium — which is
 * why it survived being "fixed" repeatedly.
 */

const SAMPLED_ROUTES = ['/', '/technical', '/archive', '/exchange'];

test.describe('nav dropdown structure survives hydration', () => {
  for (const route of SAMPLED_ROUTES) {
    test(`every .dropdown-content keeps its .dropdown wrapper on ${route}`, async ({ page }) => {
      // gotoHydrated waits for Vue's mount to complete, not for the network —
      // the corruption happens DURING hydration, so asserting any earlier would
      // pass against the server's (correct) markup.
      await gotoHydrated(page, route);

      const orphans = await page.evaluate(() =>
        [...document.querySelectorAll('.dropdown-content')]
          .filter((element) => !element.closest('.dropdown'))
          .map((element) => element.className)
      );

      expect(orphans, `orphaned .dropdown-content on ${route} — hydration mismatch corrupted the nav`).toEqual([]);
    });
  }

  test('closed menus are not visible and do not overflow the viewport', async ({ page }) => {
    await gotoHydrated(page, '/');

    const viewport = page.viewportSize();
    expect(viewport, 'viewport size unavailable').not.toBeNull();

    const overflowing = await page.evaluate((width) => {
      return [...document.querySelectorAll('.dropdown-content')]
        .filter((element) => {
          const style = getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          if (Number(style.opacity) === 0) return false;
          const box = element.getBoundingClientRect();
          if (box.width === 0 && box.height === 0) return false;
          // A menu that is laid out past the right edge is the exact
          // "off-screen dropdown" symptom.
          return box.right > width + 1 || box.left < -1;
        })
        .map((element) => `${element.className} @ ${JSON.stringify(element.getBoundingClientRect())}`);
    }, viewport!.width);

    expect(overflowing, 'a dropdown menu is rendered outside the viewport while closed').toEqual([]);
  });

  test('the language menu opens on focus and stays inside the viewport', async ({ page }) => {
    await gotoHydrated(page, '/');

    // Anonymous header: language dropdown + sign-in button. daisyUI dropdowns
    // here are pure CSS opened on :focus-within, so focusing the trigger IS
    // opening the menu — there is no click handler to wait on.
    const trigger = page.locator('.dropdown [role="button"]').first();
    await expect(trigger).toBeVisible();
    await trigger.focus();

    const menu = page.locator('.dropdown:focus-within .dropdown-content').first();
    await expect(menu).toBeVisible();

    const box = await menu.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box, 'open menu has no box').not.toBeNull();
    expect(box!.x, 'menu starts left of the viewport').toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width, 'menu extends past the right edge').toBeLessThanOrEqual(viewport.width + 1);
    // The global rule in app/assets/css/main.css caps every menu so its last
    // item is always reachable.
    expect(box!.height, 'menu is taller than the window').toBeLessThanOrEqual(viewport.height);
  });

  test('Escape dismisses an open menu', async ({ page }) => {
    await gotoHydrated(page, '/');

    const trigger = page.locator('.dropdown [role="button"]').first();
    await trigger.focus();
    await expect(page.locator('.dropdown:focus-within')).toHaveCount(1);

    // app/plugins/dropdown-dismiss.client.ts blurs out of the dropdown — these
    // menus are CSS-only, so there is no state to clear.
    await page.keyboard.press('Escape');
    await expect(page.locator('.dropdown:focus-within')).toHaveCount(0);
  });
});
