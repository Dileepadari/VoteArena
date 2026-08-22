import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Runs the real production server against a throwaway database, so the tests
  // exercise the same build and the same static-file handling that ships.
  webServer: {
    command: "node dist/server/server/index.js",
    port: PORT,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      NODE_ENV: "development",
      DATABASE_PATH: "tests/e2e/.tmp/e2e.db",
      SECRET_KEY: "playwright-e2e-secret-key-0123456789",
    },
  },
});
