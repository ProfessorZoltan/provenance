import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    fs: { allow: ['.'] },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
