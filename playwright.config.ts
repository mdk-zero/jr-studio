import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// The journey talks to the linked Supabase project, like the integration tests.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const port = Number(process.env.E2E_PORT ?? 3100);

/**
 * End-to-end tests against a production build (`npm run build` first).
 *
 * CHROME_PATH points at an installed Chrome when Playwright's own browser is
 * not downloaded (`npx playwright install chromium` otherwise).
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // One shared database and a studio-wide no-overlap rule: run in sequence.
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /layout\.spec/ },
    { name: "phone", use: { ...devices["Pixel 7"] }, testMatch: /layout\.spec/ },
  ],
  webServer: {
    command: `npx next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
