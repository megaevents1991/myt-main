import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

/**
 * Playwright E2E config for the MYT platform.
 *
 * Covers BOTH apps from this single repo:
 *  - `main`       — customer-facing booking app (this repo)        → localhost:3000
 *  - `backoffice` — admin dashboard (../../MYT-backoffice-app)     → localhost:3001
 *
 * Both dev servers are started automatically (see `webServer` below).
 * Backoffice tests reuse a logged-in session created by `global-setup.ts`.
 */

// Load test-only secrets (backoffice creds) from tests/.env — never committed.
dotenv.config({ path: path.resolve(__dirname, ".env") });

const MAIN_PORT = 3000;
const BACKOFFICE_PORT = 3001;
const MAIN_URL = `http://localhost:${MAIN_PORT}`;
const BACKOFFICE_URL = `http://localhost:${BACKOFFICE_PORT}`;

// Saved backoffice session — produced by global-setup, consumed by backoffice tests.
export const STORAGE_STATE = path.resolve(__dirname, ".auth", "backoffice.json");

export default defineConfig({
  testDir: __dirname,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ["list"],
    ["html", { outputFolder: path.resolve(__dirname, "playwright-report"), open: "never" }],
  ],

  // Logs into the backoffice once and saves the session to STORAGE_STATE.
  globalSetup: path.resolve(__dirname, "global-setup.ts"),

  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    // Generous — first navigation to an uncompiled route in `next dev` is slow.
    navigationTimeout: 60_000,
  },

  projects: [
    {
      name: "main",
      testDir: path.resolve(__dirname, "main"),
      use: {
        ...devices["Desktop Chrome"],
        baseURL: MAIN_URL,
        locale: "he-IL",
      },
    },
    {
      name: "backoffice",
      testDir: path.resolve(__dirname, "backoffice"),
      use: {
        ...devices["Desktop Chrome"],
        baseURL: BACKOFFICE_URL,
        // Reuse the session from global-setup. Individual tests that need a
        // fresh (logged-out) context override this via `test.use`.
        storageState: STORAGE_STATE,
      },
    },
  ],

  // Auto-start both dev servers. `reuseExistingServer` means a server you
  // already have running locally is used as-is instead of spawning a new one.
  webServer: [
    {
      command: `npm run dev -- -p ${MAIN_PORT}`,
      cwd: path.resolve(__dirname, ".."),
      url: MAIN_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `npm run dev -- -p ${BACKOFFICE_PORT}`,
      cwd: path.resolve(__dirname, "..", "..", "MYT-backoffice-app"),
      url: BACKOFFICE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
