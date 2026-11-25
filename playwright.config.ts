import { defineConfig } from '@playwright/test';

const live = process.env.E2E_BASE_URL;
const port = 8787;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  reporter: [['list']],
  use: {
    baseURL: live ?? `http://localhost:${port}`,
    trace: 'off',
    serviceWorkers: 'allow',
  },
  webServer: live
    ? undefined
    : { command: `npx tsx scripts/serve-dist.ts ${port}`, port, reuseExistingServer: true, timeout: 60_000 },
  projects: [
    // Clean-up check: the setup starts a ledger of sign-up addresses; the teardown runs after every
    // other project and fails if the API still has an account for any of them.
    { name: 'run-setup', testMatch: /run\.setup\.ts/, teardown: 'no-leftovers' },
    { name: 'no-leftovers', testMatch: /no-leftovers\.teardown\.ts/ },
    { name: 'phone', dependencies: ['run-setup'], use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
    { name: 'tablet', dependencies: ['run-setup'], use: { viewport: { width: 820, height: 1180 }, hasTouch: true }, grep: /@layout/ },
    { name: 'desktop', dependencies: ['run-setup'], use: { viewport: { width: 1440, height: 900 } }, grep: /@layout|@desktop/ },
    { name: 'projector', dependencies: ['run-setup'], use: { viewport: { width: 1920, height: 1080 } }, grep: /@layout|@projector/ },
  ],
});
