import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // One in-memory MongoDB for the whole run; each test file uses its own database.
    globalSetup: ['./tests/globalSetup.js'],
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
});
