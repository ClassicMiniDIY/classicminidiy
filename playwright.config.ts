import { defineConfig, devices } from '@playwright/test';
import { AUTH_STATE_PATH } from './tests/e2e/paths';

/**
 * E2E config, deliberately SEPARATE from vitest.config.ts.
 *
 * The unit config maps `~` to the repo root (real Nuxt maps it to `app/`),
 * disables file parallelism, rewrites `import.meta.client` at transform time,
 * and loads a setup file that stubs `fetch` to REJECT. Every one of those is
 * correct for unit tests and fatal for a browser suite, so the two runners
 * stay apart rather than sharing a config. `tests/e2e/**` is excluded from
 * vitest discovery in vitest.config.ts for the same reason.
 *
 * `/mcp` is intentionally out of scope here: mcp-toolkit picks its transport
 * provider at BUILD time from the Nitro preset, so a dev-server run exercises
 * the Node provider and proves nothing about the deployed Cloudflare one.
 * `scripts/test-mcp-transport.sh` is the only gate that can.
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  // A cold Nuxt dev server compiles each route on first hit, and this app
  // carries the SEO umbrella plus 10-locale SFC blocks.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Mints the signed-in session ONCE for the run. Per-test minting raced:
    // magic-link tokens are single-use, so six workers issuing links for the
    // same user invalidated each other's — 4 of 6 failed in parallel while all
    // 6 passed serially. It skips itself when the auth env is absent.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    // Anonymous projects. `authenticated.spec.ts` is excluded rather than left
    // to skip itself, so these keep proving the site works with NO session —
    // which is the majority of real traffic.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /authenticated\.spec\.ts/,
    },
    // Firefox is not redundant coverage. Hydration-mismatch repair is browser-
    // and timing-dependent, and the nav dropdown bug reproduced ONLY in
    // Firefox — every Chromium verification passed while it was still broken.
    // See the dropdown invariants in CLAUDE.md.
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: /authenticated\.spec\.ts/,
    },

    // Signed-in projects. Both browsers again, for the same reason: the bug
    // class these exist to catch is the one that only showed up in Firefox.
    {
      name: 'chromium-auth',
      testMatch: /authenticated\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_STATE_PATH },
    },
    {
      name: 'firefox-auth',
      testMatch: /authenticated\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Firefox'], storageState: AUTH_STATE_PATH },
    },
  ],
  webServer: {
    command: 'bun run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      // MEASURED, not guessed: at the default heap the dev server's SSR worker
      // dies partway through a two-browser run with
      // `Worker terminated due to reaching memory limit: JS heap out of memory`,
      // after which EVERY route 500s and the remaining tests fail for reasons
      // that have nothing to do with the code under test. Same class of limit
      // the production build already carries (8192 in deploy-cloudflare.yml).
      NODE_OPTIONS: '--max-old-space-size=8192',
      // The marketplace is flag-gated; without this the /exchange specs skip
      // themselves and the suite silently loses that coverage.
      NUXT_PUBLIC_EXCHANGE_ENABLED: process.env.NUXT_PUBLIC_EXCHANGE_ENABLED ?? 'true',
      // Turns Nuxt DevTools off for this server only — see nuxt.config.ts.
      PLAYWRIGHT: 'true',
    },
  },
});
