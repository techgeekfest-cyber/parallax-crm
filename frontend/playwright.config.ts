import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the real stack: Next.js → Spring Boot → PostgreSQL.
 * Start the database and backend first (see README); Playwright starts the frontend. Global setup signs in as the
 * bootstrap admin (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD, defaulting to the local-profile admin).
 */
const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.CI ? `npm run start -- -p ${port}` : `npm run dev -- -p ${port}`,
    url: `http://localhost:${port}/leads`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
