import { expect, test } from '@playwright/test';
import { assertSessionAdopted, mintSession, readAuthEnv, storageKeyFor } from './_auth';
import { waitForHydration } from './_helpers';

/**
 * The signed-in half of the suite — and the reason it exists.
 *
 * Everything else in `tests/e2e/**` runs anonymously, which keeps the suite
 * zero-setup but leaves a hole exactly where the bugs are. Signed out, the
 * server and the client AGREE that `isAuthenticated` is false, so no hydration
 * mismatch can occur and `console-budget.spec.ts` cannot observe the failure
 * class it was written for.
 *
 * That class is not hypothetical here. The Supabase session lives in
 * localStorage, so `isAuthenticated` is ALWAYS false during SSR and flips true
 * on the client — and branching structurally on it has now corrupted the DOM
 * three separate times: the nav account dropdown, `/chat`, and the passkey UI.
 * CLAUDE.md records ~19 further call sites still branching on ungated
 * `isAuthenticated`/`isAdmin`. These specs are the only thing that can see them.
 *
 * READ-ONLY on purpose. They navigate authenticated surfaces and watch
 * hydration; they do not create listings, submissions or messages, because this
 * runs against production Supabase and a green test is not worth a stray row.
 * Write flows can be added deliberately, with cleanup, if that is wanted.
 *
 * Skips wholesale when the env is absent, so a clean checkout still runs the
 * anonymous suite with no credentials.
 */

const env = readAuthEnv();

test.describe('authenticated surfaces hydrate cleanly', () => {
  test.skip(
    !env,
    'authenticated E2E needs NUXT_PUBLIC_SUPABASE_URL, NUXT_PUBLIC_SUPABASE_KEY, SUPABASE_SERVICE_KEY and E2E_TEST_USER_EMAIL'
  );

  // Routes that render a different tree depending on auth state. Each is a
  // place a structural `v-if` on `isAuthenticated` would tear the DOM.
  const ROUTES = ['/', '/dashboard', '/profile', '/contribute', '/membership'];

  test.beforeEach(async ({ context, page }) => {
    const session = await mintSession(env!);
    const key = storageKeyFor(env!.supabaseUrl);

    // Seed BEFORE any navigation: the app reads localStorage during client
    // init, so a session written after load would not be picked up until a
    // reload and the first render would be the signed-out one.
    await context.addInitScript(
      ([k, value]) => {
        try {
          window.localStorage.setItem(k, value);
        } catch {
          /* storage unavailable — assertSessionAdopted reports it */
        }
      },
      [key, JSON.stringify(session)] as const
    );

    await page.goto('/');
    await assertSessionAdopted(page, key);
  });

  for (const route of ROUTES) {
    test(`${route} hydrates without a mismatch while signed in`, async ({ page }) => {
      const problems: string[] = [];
      page.on('console', (message) => {
        const text = message.text();
        // The two warnings Vue emits when SSR output and the client's first
        // render disagree. A mismatch is not cosmetic here: Vue's repair MERGES
        // the trees, which is how an orphaned .dropdown-content ended up laid
        // out in the header flex row.
        if (text.includes('Hydration node mismatch') || text.includes('Hydration completed but contains mismatches')) {
          problems.push(`${route}: ${text.split('\n')[0]}`);
        }
      });
      page.on('pageerror', (error) => problems.push(`${route}: uncaught ${error.message}`));

      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await waitForHydration(page);

      expect(problems, `hydration problems on ${route} while SIGNED IN`).toEqual([]);
    });
  }

  test('the account dropdown keeps its wrapper while signed in', async ({ page }) => {
    // The signed-in header is the exact tree that broke: SSR emitted the
    // signed-OUT subtree, the client wanted the signed-IN one, and the repair
    // patched the account menu into the wrong parent — orphaning it from any
    // `.dropdown`, which is what stripped its `position: absolute` and its
    // closed-state `display: none` at once.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForHydration(page);

    const orphans = await page.evaluate(() =>
      [...document.querySelectorAll('.dropdown-content')]
        .filter((element) => !element.closest('.dropdown'))
        .map((element) => element.className)
    );

    expect(orphans, 'orphaned .dropdown-content in the SIGNED-IN header').toEqual([]);
  });
});
