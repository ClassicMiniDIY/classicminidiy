import { expect, test } from './_fixtures';
import { assertSessionAdopted, readAuthEnv, storageKeyFor } from './_auth';
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

  /**
   * Routes known to mismatch while signed in. EMPTY, and that is a finding in
   * itself — see the note below.
   *
   * This started as all five routes. The first authenticated runs produced Vue
   * hydration mismatches on every one of them, Firefox only, about a third of
   * the time. That turned out to be the HARNESS, not the app: at the time
   * `mintSession` ran per test, and magic-link tokens are single-use, so
   * parallel workers invalidated each other's. A session dying while the page
   * hydrates flips the client from signed-in to signed-out mid-render, which is
   * exactly a hydration mismatch.
   *
   * Once minting moved to a single setup project the symptom vanished and has
   * not returned in roughly forty attempts: reloads in one context, ten fresh
   * contexts, serial and six-worker runs, DevTools on and off, and second
   * visits with populated localStorage. Three consecutive full-suite runs are
   * clean.
   *
   * So the gate is real: a signed-in hydration mismatch on any listed route
   * FAILS. Re-add an entry only with evidence that survives the same battery —
   * a single red run is more likely to be a harness bug than an app bug, which
   * is the lesson that produced this comment.
   */
  const KNOWN_HYDRATION_MISMATCH = new Set<string>();

  // The session arrives via storageState from the `setup` project (see
  // auth.setup.ts) — minted once for the whole run, because magic-link tokens
  // are single-use and per-test minting raced.
  //
  // Adoption is asserted on the page each test ALREADY loads rather than in a
  // beforeEach that navigated to '/' first: that cost a full extra Nuxt route
  // compile per test (~12 per run, twice over for the two tests that also
  // target '/') against the suite's slowest component, and bought nothing the
  // in-test check does not.
  // Computed defensively, NOT `env!.supabaseUrl`. The describe body is
  // evaluated during collection even when `test.skip()` will skip every test in
  // it, so dereferencing a null env here crashed the whole file on a clean
  // checkout — turning a clean skip into a hard error, which is exactly the
  // zero-setup guarantee this suite is supposed to keep.
  const authKey = env ? storageKeyFor(env.supabaseUrl) : '';

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
      // A silent miss here would make every assertion below pass against a
      // signed-OUT page — the exact failure this suite exists to catch.
      await assertSessionAdopted(page, authKey);

      if (KNOWN_HYDRATION_MISMATCH.has(route)) {
        // Report, do not fail. An uncaught page error is still a hard failure
        // below — only the known mismatch is tolerated, and only here.
        const mismatches = problems.filter((p) => p.includes('Hydration'));
        const other = problems.filter((p) => !p.includes('Hydration'));
        if (mismatches.length) console.log(`[known] ${route} still mismatches: ${mismatches.length} warning(s)`);
        expect(other, `NON-hydration page errors on ${route} while SIGNED IN`).toEqual([]);
        return;
      }

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
    await assertSessionAdopted(page, authKey);

    const orphans = await page.evaluate(() =>
      [...document.querySelectorAll('.dropdown-content')]
        .filter((element) => !element.closest('.dropdown'))
        .map((element) => element.className)
    );

    expect(orphans, 'orphaned .dropdown-content in the SIGNED-IN header').toEqual([]);
  });
});
