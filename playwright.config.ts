import { defineConfig, devices } from "@playwright/test";

/**
 * End to end, against a real build and a real Postgres.
 *
 * 348 tests here stop at a function or a component, and the store contract runs
 * against PGlite in process. None of them signs in, and the permission model is
 * the product: a decision's lifecycle is meaningless unless the person driving
 * it is who they claim to be.
 *
 * `next start`, not `next dev`: dev compiles per request and skips the
 * production checks a deployed build runs. DATABASE_URL is expected to point at
 * a database this suite may seed and truncate, never a shared one. CI provides a
 * service container; locally, point it at a scratch database.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false, // one database, shared state, sequential is the honest default
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Piped, not swallowed: a 500 from a server whose logs go nowhere is a
    // failure you can only guess at.
    stdout: "pipe",
    stderr: "pipe",
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "e2e-secret-not-used-for-anything-real",
      BETTER_AUTH_URL: "http://localhost:3000",
    },
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
