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
    exclude: [...configDefaults.exclude, '**/.claude/**', '**/.nuxt/**'],
    fileParallelism: false,
    sequence: { shuffle: false },
    coverage: {
      provider: 'v8',
      exclude: ['tests/**', 'data/*.json', 'node_modules/**', '*.config.*', '.nuxt/**'],
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
