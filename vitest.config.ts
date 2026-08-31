import { defineConfig, configDefaults } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'vitest:import-meta-client',
      transform(code, id) {
        if (id.includes('node_modules')) return;
        if (!code.includes('import.meta.client') && !code.includes('import.meta.server')) return;
        return {
          code: code.replace(/\bimport\.meta\.client\b/g, '(true)').replace(/\bimport\.meta\.server\b/g, '(false)'),
          map: null,
        };
      },
    },
  ],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Keep vitest's defaults but also ignore local git worktrees under
    // .claude/ (past sessions leave full repo copies whose duplicate test
    // files would otherwise be discovered and run) and the Nuxt build dir.
    // `tests/e2e/**` is Playwright's, not vitest's. Its specs import
    // `@playwright/test`, which has no vitest runtime — without this exclude
    // vitest's default `**/*.spec.ts` glob would pick them up and fail.
    exclude: [...configDefaults.exclude, '**/.claude/**', '**/.nuxt/**', 'tests/e2e/**'],
    fileParallelism: false,
    sequence: { shuffle: false },
    coverage: {
      provider: 'v8',
      exclude: ['tests/**', 'data/*.json', 'node_modules/**', '*.config.*', '.nuxt/**'],
      /**
       * Ratchet, seeded from a real measurement on 2026-08-30 and set a few
       * points BELOW it so it only ever tightens. Do not raise one to an
       * aspirational number that fails on the day it lands.
       *
       * READ THIS BEFORE TRUSTING THE NUMBER. `all` is not enabled, so the
       * report covers only files some test actually imports — 204 of the 624
       * source files in app/, server/, data/ and shared/. The measured 91.9%
       * is therefore "91.9% of the third of the codebase the tests touch", not
       * of the codebase. The other 420 files are absent from the denominator
       * entirely, so adding an untested file does not move this.
       *
       * That is deliberate: breadth and depth are different questions, and a
       * single number that answers neither is worse than one that clearly
       * answers one. This gate catches tested code getting worse. Breadth is
       * what tests/static/**, the route crawler and the Playwright tier are
       * for — they exercise files no unit test imports. Turning on `all: true`
       * would report a much lower figure and need its own, separate baseline.
       *
       * Baselines measured: composables 94.9, server/api 92.2, server/utils
       * 84.6, app/utils 86.0, global 91.9.
       */
      thresholds: {
        statements: 89,
        'app/composables/**': { statements: 92 },
        'app/utils/**': { statements: 83 },
        'server/api/**': { statements: 90 },
        'server/utils/**': { statements: 82 },
      },
    },
  },
  resolve: {
    alias: {
      // Nuxt aliases `~` to the `app/` srcDir, but the broad `~` entry below
      // maps to the repo root (needed for `~/server/*` in tests). Map the Nuxt
      // app subtrees explicitly first so source files that import `~/utils/*`,
      // `~/composables/*`, etc. resolve to `app/` as they do at runtime. More
      // specific keys are matched before the bare `~` fallback.
      '~/utils': fileURLToPath(new URL('./app/utils', import.meta.url)),
      '~/composables': fileURLToPath(new URL('./app/composables', import.meta.url)),
      '~': fileURLToPath(new URL('./', import.meta.url)),
      '@': fileURLToPath(new URL('./', import.meta.url)),
      '~~': fileURLToPath(new URL('./', import.meta.url)),
      '@@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
});
