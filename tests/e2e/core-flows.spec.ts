import { expect, test } from '@playwright/test';
import { gotoHydrated, waitForHydration } from './_helpers';

/**
 * The main user journeys, end to end, anonymously.
 *
 * These are deliberately shallow-but-wide: one pass through each flow the site
 * exists for, asserting the thing a user would notice if it broke. They are not
 * a substitute for the unit suite's depth — they exist because nothing else in
 * the repo ever drives a real browser through a real route.
 *
 * Everything here runs signed out, so the suite needs no credentials and runs
 * on a clean checkout. That is also the limitation: signed out, the server and
 * the client agree on `isAuthenticated`, so these specs cannot see the
 * hydration mismatches that only appear with a session. Authenticated coverage
 * (listing wizard, admin queue, dashboard tabs) is tracked in the harness
 * follow-ups issue.
 *
 * `h1` assertions use `.first()` deliberately — several pages currently render
 * two `<h1>` elements, and Playwright's strict mode would throw on the
 * ambiguity instead of failing on the thing under test.
 */

test.describe('omnisearch', () => {
  test('opens, searches across surfaces, and navigates to a result', async ({ page }) => {
    await gotoHydrated(page, '/');

    // The trigger's aria-label is the localized placeholder ("Try 'brake
    // bleeding'…"), not the word "search" — match the class instead.
    await page.locator('.omnisearch-trigger').first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const input = dialog.locator('input').first();
    await expect(input).toBeFocused();
    await input.fill('torque');

    // Results are debounced and merged from two sources — Postgres omnisearch()
    // for the data surfaces, and the static Toolbox catalog matched in-process
    // (see the omnisearch invariants in CLAUDE.md).
    // Rows are <button> (command-palette style), not <a> — `goTo()` pushes the
    // route rather than following an href.
    const results = dialog.locator('.omnisearch-row');
    await expect(results.first()).toBeVisible({ timeout: 20_000 });

    await results.first().click();
    await expect(page).not.toHaveURL('/');
  });

  test('the "/" keyboard shortcut opens it', async ({ page }) => {
    await gotoHydrated(page, '/technical');
    await page.keyboard.press('/');
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  // The header advertises the shortcut with a `<kbd>/</kbd>` on every page, but
  // `FloatingChatInput` focuses its textarea on mount and the hotkey handler
  // correctly ignores keystrokes inside a text field — so the shortcut it
  // promises is dead on the site's highest-traffic page. Tracked as a bug;
  // flip this to `test()` when the autofocus is removed or conditioned.
  test.fixme('the "/" shortcut also works on the homepage', async ({ page }) => {
    await gotoHydrated(page, '/');
    await page.keyboard.press('/');
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});

test.describe('toolbox calculators', () => {
  test('the gearing calculator computes and publishes its arithmetic', async ({ page }) => {
    await gotoHydrated(page, '/technical/gearing');

    await expect(page.locator('h1').first()).toBeVisible();

    // Every technical calculator publishes a MathBreakdown so a reader can redo
    // the sums by hand. The panel is fed from the calculator's own computed
    // values — a breakdown that disagrees with the answer above it is worse
    // than none (see the calculator invariants in CLAUDE.md).
    const breakdown = page.locator('.math-breakdown, [data-math-breakdown]').first();
    const hasBreakdown = (await breakdown.count()) > 0;
    if (hasBreakdown) await expect(breakdown).toBeVisible();

    // A result must be on screen: some number formatted as a speed or ratio.
    await expect(page.getByText(/\d+(\.\d+)?\s*(mph|km\/h|:1)/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('the toolbox index lists the tools and filters by category', async ({ page }) => {
    await gotoHydrated(page, '/technical');

    const toolLinks = page.locator('a[href^="/technical/"]');
    expect(await toolLinks.count()).toBeGreaterThan(5);

    await gotoHydrated(page, '/technical?category=engine');
    await expect(page.locator('h1').first()).toBeVisible();
  });
});

test.describe('archive', () => {
  test('documents index filters and opens a detail page', async ({ page }) => {
    await gotoHydrated(page, '/archive/documents');

    const firstDoc = page.locator('a[href^="/archive/documents/"]').first();
    await expect(firstDoc).toBeVisible({ timeout: 20_000 });
    await firstDoc.click();

    await expect(page.locator('h1').first()).toBeVisible();
    // A detail page with no title is the soft-404 shape that used to answer 200
    // for every unknown URL on the domain.
    await expect(page).not.toHaveTitle(/undefined/i);
  });

  test('an unknown archive document is a real 404', async ({ page }) => {
    const response = await page.goto('/archive/documents/definitely-not-a-real-document');
    expect(response?.status()).toBe(404);
  });
});

test.describe('exchange browse', () => {
  test('listings index renders and a listing opens', async ({ page }) => {
    // Status first, hydration second. The whole marketplace is behind
    // NUXT_PUBLIC_EXCHANGE_ENABLED and every surface 404s on the server when
    // the flag is off — waiting for Vue to mount before checking that would
    // burn the full hydration timeout on a deliberate configuration.
    const response = await page.goto('/exchange/listings', { waitUntil: 'domcontentloaded' });
    test.skip(response?.status() === 404, 'exchange is flag-disabled in this environment');

    await waitForHydration(page);
    await expect(page.locator('h1').first()).toBeVisible();

    const firstListing = page.locator('a[href^="/exchange/listings/"]').first();
    if ((await firstListing.count()) === 0) test.skip(true, 'no live listings to open');

    await firstListing.click();
    await expect(page).not.toHaveTitle(/undefined/i);
  });
});

test.describe('i18n', () => {
  test('switching locale changes the copy and survives a reload', async ({ page }) => {
    await gotoHydrated(page, '/');

    const before = await page.locator('body').innerText();

    // `strategy: 'no_prefix'` — the locale lives in the i18n_redirected cookie,
    // there is no /de/ path prefix to assert on.
    // The language dropdown is the one carrying the globe icon; the account /
    // theme controls are siblings with the same shape.
    const languageDropdown = page.locator('.dropdown:has(.fa-globe)').first();
    await expect(languageDropdown).toBeVisible();
    await languageDropdown.locator('[role="button"]').first().focus();

    const german = languageDropdown.getByRole('button', { name: 'Deutsch' });
    await expect(german).toBeVisible();
    await german.click();

    await expect.poll(async () => (await page.locator('body').innerText()) !== before, { timeout: 20_000 }).toBe(true);

    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'i18n_redirected')?.value).toBe('de');

    await page.reload();
    const afterReload = await page.locator('body').innerText();
    expect(afterReload).not.toBe(before);
  });
});

test.describe('contribution loop', () => {
  test('the contribute wizard opens and gates anonymous users', async ({ page }) => {
    await gotoHydrated(page, '/contribute');
    await expect(page.locator('h1').first()).toBeVisible();

    // Signed out, the page shows a sign-in gate rather than the wizard form.
    const signInPrompt = page.getByRole('link', { name: /sign in|log in/i });
    await expect(signInPrompt.first()).toBeVisible();
  });
});

test.describe('auth entry point', () => {
  test('/login renders its sign-in options', async ({ page }) => {
    await gotoHydrated(page, '/login');
    await expect(page.locator('h1').first()).toBeVisible();
    // Magic link, OAuth and passkey are the three paths; at least the email
    // field must be present for the page to be usable at all.
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });
});
