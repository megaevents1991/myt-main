import { test, expect } from "@playwright/test";

/**
 * Backoffice smoke tests — admin dashboard (../../MYT-backoffice-app @ :3001).
 *
 * - "login" group runs logged OUT (fresh context) and exercises the login page.
 * - "authenticated" group reuses the session from global-setup.ts.
 *   It self-skips when tests/.env has no BACKOFFICE_EMAIL/PASSWORD.
 */

const hasCreds = Boolean(
  process.env.BACKOFFICE_EMAIL && process.env.BACKOFFICE_PASSWORD
);

test.describe("backoffice — login page (logged out)", () => {
  // Force a clean, session-free context for these tests.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login page renders its form", async ({ page }) => {
    await page.goto("/auth/login");

    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  });

  test("visiting a protected page redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    // middleware.ts redirects unauthenticated users to /auth/login.
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("valid credentials log in and reach the dashboard", async ({ page }) => {
    test.skip(!hasCreds, "Set BACKOFFICE_EMAIL/PASSWORD in tests/.env");

    await page.goto("/auth/login");
    await page.locator("#email").fill(process.env.BACKOFFICE_EMAIL!);
    await page.locator("#password").fill(process.env.BACKOFFICE_PASSWORD!);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });
});

test.describe("backoffice — authenticated pages", () => {
  test.skip(
    !hasCreds,
    "No backoffice credentials in tests/.env — authenticated tests skipped"
  );

  test("dashboard loads", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("events page loads", async ({ page }) => {
    await page.goto("/events");
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page.locator("body")).toContainText(/.+/);
  });

  test("offline-flights page loads", async ({ page }) => {
    await page.goto("/offline-flights");
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("offline-hotels page loads", async ({ page }) => {
    await page.goto("/offline-hotels");
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page.locator("body")).toBeVisible();
  });
});
