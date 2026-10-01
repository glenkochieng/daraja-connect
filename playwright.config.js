// @ts-check
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests start the whole stack (matching service, API with an in-memory
 * database and seeded sample data, React client) on their own ports, so they can run
 * while `npm run dev` is running. Run them with `npm run test:e2e`.
 */
const ports = { ml: 8100, api: 4100, web: 5174 };

// Throwaway credentials for the in-memory database, made once per run. Test workers
// inherit process.env from this process, so they see the same values.
process.env.E2E_ADMIN_EMAIL ??= 'e2e-admin@daraja.test';
process.env.E2E_ADMIN_PASSWORD ??= `Admin-${randomBytes(9).toString('hex')}`;
process.env.E2E_SEED_PASSWORD ??= `Sample-${randomBytes(9).toString('hex')}`;
process.env.E2E_API_URL ??= `http://localhost:${ports.api}`;

// Use the matching service's virtual environment when it exists (local Windows or
// macOS/Linux); CI installs the requirements into the runner's Python instead.
const venv = path.join(import.meta.dirname, 'ml-service', '.venv');
const python =
  [path.join(venv, 'Scripts', 'python.exe'), path.join(venv, 'bin', 'python')].find(existsSync) ??
  'python';

export default defineConfig({
  testDir: './e2e',
  // The tests share one seeded database, so they run one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.js',
  use: {
    baseURL: `http://localhost:${ports.web}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      name: 'ml',
      command: `"${python}" -m uvicorn daraja.api:app --port ${ports.ml}`,
      cwd: 'ml-service',
      url: `http://127.0.0.1:${ports.ml}/health`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      name: 'api',
      command: 'node src/index.js',
      cwd: 'server',
      url: `http://localhost:${ports.api}/api/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'development',
        PORT: String(ports.api),
        // Empty means the in-memory database, even if server/.env names a real one.
        MONGODB_URI: '',
        JWT_SECRET: randomBytes(32).toString('hex'),
        CLIENT_ORIGIN: `http://localhost:${ports.web}`,
        ML_SERVICE_URL: `http://127.0.0.1:${ports.ml}`,
        AUTH_RATE_LIMIT: '1000',
        SEED_ON_START: 'true',
        SEED_USER_PASSWORD: process.env.E2E_SEED_PASSWORD,
        ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL,
        ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
      },
    },
    {
      name: 'web',
      command: `node ../node_modules/vite/bin/vite.js --port ${ports.web} --strictPort`,
      cwd: 'client',
      url: `http://localhost:${ports.web}`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: `http://localhost:${ports.api}` },
    },
  ],
});
