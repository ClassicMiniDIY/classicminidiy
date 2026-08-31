import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test as setup } from '@playwright/test';
import { AUTH_STATE_PATH, mintSession, readAuthEnv, storageKeyFor } from './_auth';

/**
 * Mint the signed-in session ONCE, for the whole run.
 *
 * This is a setup project rather than a `beforeEach`, and that is not a style
 * preference — the first version minted per test and failed 4 of 6 in parallel
 * while passing 6 of 6 serially. Magic-link tokens are single-use and issuing a
 * new one invalidates the previous, so six workers generating links for the
 * same user clobber each other. Minting once removes the race entirely and
 * costs one round trip instead of six.
 *
 * The state is written as a Playwright storage-state file rather than by
 * driving a browser, because there is nothing to drive: the session simply has
 * to be in localStorage before the app's client boots. Building the JSON
 * directly is deterministic and needs no page.
 */

const env = readAuthEnv();

setup('mint the authenticated storage state', async ({ baseURL }) => {
  setup.skip(
    !env,
    'authenticated E2E needs NUXT_PUBLIC_SUPABASE_URL, NUXT_PUBLIC_SUPABASE_KEY, SUPABASE_SERVICE_KEY and E2E_TEST_USER_EMAIL'
  );

  expect(baseURL, 'baseURL is required — storage state is scoped to an origin').toBeTruthy();

  const session = await mintSession(env!);
  const key = storageKeyFor(env!.supabaseUrl);

  const state = {
    cookies: [],
    origins: [
      {
        // Must be the exact origin the tests visit; Playwright applies
        // localStorage per origin and silently applies nothing on a mismatch.
        origin: new URL(baseURL!).origin,
        localStorage: [{ name: key, value: JSON.stringify(session) }],
      },
    ],
  };

  mkdirSync(dirname(AUTH_STATE_PATH), { recursive: true });
  writeFileSync(AUTH_STATE_PATH, JSON.stringify(state, null, 2));
});
