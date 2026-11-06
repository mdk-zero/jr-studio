import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// The journey talks to the linked Supabase project, like the integration tests.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const port = Number(process.env.E2E_PORT ?? 3100);
// A deployed site to test instead of a local build. It must use the same
// Supabase project as .env.local, which the fixtures write to.
const remote = process.env.E2E_BASE_URL;

/**
 * End-to-end tests against a production build (`npm run build` first), or
 * against a deployed site when E2E_BASE_URL is set.
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
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: remote ?? `http://localhost:${port}`,
    // Recorded on every run so a pass can be shown, not just a failure.
    trace: "on",
    video: "on",
    screenshot: "on",
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /(layout|phone-flows)\.spec/ },
    { name: "phone", use: { ...devices["Pixel 7"] }, testMatch: /(layout|phone-flows)\.spec/ },
  ],
  webServer: remote
    ? undefined
    : {
        command: `npx next start -p ${port}`,
        url: `http://localhost:${port}`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
