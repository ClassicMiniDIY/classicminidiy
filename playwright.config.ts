import { defineConfig, devices } from '@playwright/test';

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
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Firefox is not redundant coverage. Hydration-mismatch repair is browser-
    // and timing-dependent, and the nav dropdown bug reproduced ONLY in
    // Firefox — every Chromium verification passed while it was still broken.
    // See the dropdown invariants in CLAUDE.md.
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
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
    },
  },
});
