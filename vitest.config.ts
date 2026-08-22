import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Each test file gets its own process, so an in-memory database per file
    // keeps the suites isolated without any teardown bookkeeping.
    pool: "forks",
    env: {
      NODE_ENV: "test",
      DATABASE_PATH: ":memory:",
      SECRET_KEY: "test-secret-key-for-vitest-only-0123456789",
      PUBLIC_URL: "http://localhost:4000",
    },
  },
});
