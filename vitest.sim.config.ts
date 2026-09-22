// The difficulty simulator: slow, opt-in, not part of `npm test`. Run with `npm run sim`.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/sim/**/*.sim.ts'],
    environment: 'node',
    testTimeout: 900000,
  },
});
