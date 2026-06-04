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
      '~': fileURLToPath(new URL('./', import.meta.url)),
      '@': fileURLToPath(new URL('./', import.meta.url)),
      '~~': fileURLToPath(new URL('./', import.meta.url)),
      '@@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
});
