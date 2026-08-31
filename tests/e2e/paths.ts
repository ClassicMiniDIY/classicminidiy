/**
 * Paths shared between the Playwright config and the auth helpers.
 *
 * Deliberately dependency-free. `playwright.config.ts` needs AUTH_STATE_PATH,
 * and importing it from `_auth.ts` pulled `@supabase/supabase-js` into config
 * evaluation for the sake of one string — which meant an anonymous-only run
 * loaded the Supabase SDK, and any failure inside that package broke config
 * parsing for the whole suite, auth or not.
 */

/** Where the setup project writes the signed-in storage state. Gitignored. */
export const AUTH_STATE_PATH = 'playwright/.auth/user.json';
