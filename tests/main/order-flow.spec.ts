import { test, expect, type Page } from "@playwright/test";

/**
 * Main app order-flow tests — the 4-step booking funnel:
 *   step 1 TicketSelection → 2 FlightSelection → 3 HotelSelection → 4 OrderReview
 *
 * The funnel is React state inside OrderForm.tsx (the URL stays /order/<id>),
 * so step progress is asserted via the DOM, not the URL.
 *
 * NOTE: steps 2–4 hit live providers (Amadeus flights, Ratehawk hotels) and
 * depend on real inventory — they are inherently slow/flaky. The deterministic
 * step-1 path is a real test; the full walkthrough is a `fixme` skeleton below.
 */

const TICKET_GROUP =
  '[role="group"][aria-labelledby="ticket-selection-heading"]';
const TICKET_CARDS = `${TICKET_GROUP} > div:not(#ticket-selection-heading)`;

/** Opens the first bookable event from the homepage and lands on step 1. */
async function openFirstEventOrderPage(page: Page) {
  await page.goto("/");
  const firstEvent = page.locator('a[href^="/order/"]').first();
  await expect(firstEvent).toBeVisible({ timeout: 30_000 });
  // Long timeout: the /order route compiles on first hit in `next dev`.
  await firstEvent.click({ timeout: 90_000 });
  await expect(page).toHaveURL(/\/order\/\d+/, { timeout: 90_000 });
}

test("step 1: select a ticket and advance to flight selection", async ({
  page,
}) => {
  test.slow(); // dev-mode route compilation + heavy order page

  await test.step("open an event order page", async () => {
    await openFirstEventOrderPage(page);
  });

  await test.step("select the first available ticket", async () => {
    const firstTicket = page.locator(TICKET_CARDS).first();
    await expect(firstTicket).toBeVisible({ timeout: 45_000 });
    await firstTicket.click();
  });

  await test.step("advance to step 2 (flight selection)", async () => {
    const toFlight = page.getByRole("button", { name: "לבחירת טיסה" });
    await expect(toFlight).toBeEnabled();
    await toFlight.click();

    // Step 1's continue button is unique to step 1 — its disappearance
    // confirms the funnel advanced to flight selection.
    await expect(toFlight).toBeHidden({ timeout: 20_000 });
  });
});

/**
 * Full walkthrough flight → hotel → review.
 *
 * Marked `fixme` (skipped, won't fail the suite) because it needs selectors
 * from components not yet mapped, plus live provider inventory. To finish it:
 *  - flight step  → see app/order/FlightSelection.tsx  (calls /api/flights/search)
 *  - hotel step   → see app/order/HotelSelection.tsx   (calls /api/hotels)
 *  - review step  → see app/order/OrderReview.tsx
 * Footer continue-button labels per step live in app/order/OrderForm.tsx
 * (`buttonText`): 2 "לבחירת מלון", 3 "לסיכום הזמנה", 4 "שלח הזמנה".
 */
test.fixme(
  "full walkthrough: ticket → flight → hotel → review",
  async ({ page }) => {
    test.slow();

    await openFirstEventOrderPage(page);

    // Step 1 — ticket
    await page.locator(TICKET_CARDS).first().click();
    await page.getByRole("button", { name: "לבחירת טיסה" }).click();

    // Step 2 — flight: wait for /api/flights/search results, pick one.
    // TODO: add a flight-card selector from FlightSelection.tsx.

    // Step 3 — hotel: pick a hotel, or use the "לא צריך מלון" skip button.
    // TODO: add a hotel-card selector from HotelSelection.tsx.

    // Step 4 — review: assert OrderReview renders the "שלח הזמנה" button.
    await expect(
      page.getByRole("button", { name: "שלח הזמנה" })
    ).toBeVisible();
  }
);
