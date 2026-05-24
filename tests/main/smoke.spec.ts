import { test, expect } from "@playwright/test";

/**
 * Main app smoke tests — customer-facing booking app (this repo @ :3000).
 *
 * Verifies the homepage renders, lists bookable events, and that an event
 * link opens its order page on step 1 (ticket selection).
 */

test("homepage loads and lists bookable events", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/.+/);

  // Event cards link to /order/<id>; sold-out cards link to "#no-op".
  const orderLinks = page.locator('a[href^="/order/"]');
  await expect(orderLinks.first()).toBeVisible({ timeout: 30_000 });
});

test("opening an event lands on the order page at step 1", async ({ page }) => {
  await page.goto("/");

  const firstEvent = page.locator('a[href^="/order/"]').first();
  await expect(firstEvent).toBeVisible({ timeout: 30_000 });
  // Long timeout: the /order route compiles on first hit in `next dev`.
  await firstEvent.click({ timeout: 90_000 });

  await expect(page).toHaveURL(/\/order\/\d+/, { timeout: 90_000 });

  // Step 1 (ticket selection) renders a "to flight selection" continue button.
  await expect(
    page.getByRole("button", { name: "לבחירת טיסה" })
  ).toBeVisible({ timeout: 45_000 });
});
