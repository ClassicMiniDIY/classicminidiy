import { defineConfig } from 'vitest/config';
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
