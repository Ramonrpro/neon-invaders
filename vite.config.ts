import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@game': fileURLToPath(new URL('./src/game', import.meta.url)),
      '@pwa': fileURLToPath(new URL('./src/pwa', import.meta.url)),
      '@services': fileURLToPath(new URL('./src/services', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    host: true,
    port: 5173,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
