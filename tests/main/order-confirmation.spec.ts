import { test, expect, type Page } from "@playwright/test";

/**
 * Full order-funnel → confirmation E2E tests (main app).
 *
 * Walks the real 4-step booking funnel end to end and asserts the
 * /confirmation page renders every order detail. Two flows:
 *
 *  Test 1 — Happy flow WITH a flight.
 *  Test 2 — Skip-flight flow (order WITHOUT a flight).
 *
 * Test 2 guards a real regression: skipping the flight used to blank the
 * confirmation page (Date "N/A", "Tickets: (x)", empty event details).
 * PASS = event/date/location/tickets populated and the flight section shows
 * the single row "Flight: ללא טיסה".
 *
 * Event under test — id 454 "מטאליקה" (Metallica, Berlin), a
 * `music_live_event_dynamic` event with `skip_flight: true`, so its flight
 * step always renders the split "skip flight" buttons.
 *
 * NOTE: both tests hit live providers (Amadeus flights, Ratehawk hotels) and
 * real inventory, so they are inherently slow. Orders are submitted as a
 * phone order — payNow=false, onlySave=false — which redirects straight to
 * /confirmation without a payment step.
 */

const EVENT_ID = 454;
const EVENT_NAME = "מטאליקה"; // event 454 name
const EVENT_LOCATION = "ברלין"; // substring of "ברלין, גרמניה"
const TICKET_CATEGORY = "טבעת תחתונה"; // substring of "טבעת תחתונה, ישיבה"
// numberOfEventTickets defaults to 2 in OrderContext (app/order/layout.tsx),
// so qty 2 needs no UI action — we just assert it.
const QUANTITY = 2;

// Step-1 ticket cards — the offline-hotel.spec.ts selector.
const TICKET_CARDS =
  '[role="group"][aria-labelledby="ticket-selection-heading"] > div:not(#ticket-selection-heading)';

/**
 * console.error noise that is NOT an order-flow regression — third-party
 * analytics, dev-server HMR, and pre-existing app-wide dev warnings
 * (empty Image `src` on some events, Mantine SSR id hydration mismatch,
 * ReactDOM.preload). These fire regardless of the booking funnel. Tune as
 * needed; a genuine new error still fails the test.
 */
const IGNORED_CONSOLE_ERRORS: RegExp[] = [
  /favicon\.ico/i,
  /ResizeObserver loop/i,
  /mixpanel/i,
  /googletagmanager|google-analytics|gtag|dataLayer/i,
  /Failed to load resource.*\b404\b/i,
  /\[Fast Refresh\]/i,
  /empty string.*was passed to the/i, // Next Image empty src (event assets)
  /ReactDOM\.preload/i, // empty-href preload, same root cause
  /Image is missing required .src. property/i,
  /A tree hydrated but some attributes/i, // Mantine SSR id mismatch (dev only)
];

/**
 * Uncaught page exceptions that are NOT an order-flow regression. The
 * flight/hotel searches abort a superseded request by rejecting its promise;
 * that rejection surfaces as an unhandled "another request is has started"
 * and is benign request-supersession noise.
 */
const IGNORED_PAGE_ERRORS: RegExp[] = [/another request is has started/i];

/** Wire up error capture. Returns getters used for the final error assertions. */
function captureErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));
  return {
    realPageErrors: () =>
      pageErrors.filter((e) => !IGNORED_PAGE_ERRORS.some((r) => r.test(e))),
    realConsoleErrors: () =>
      consoleErrors.filter(
        (e) => !IGNORED_CONSOLE_ERRORS.some((r) => r.test(e))
      ),
  };
}

/**
 * Read a single confirmation-page detail row by its bold label, e.g.
 * "Booking Reference:", "Date:", "Flight:". Returns the whole <p> text,
 * whitespace-collapsed.
 */
async function detailRow(page: Page, label: string): Promise<string> {
  const row = page.locator("p").filter({ hasText: label }).first();
  await expect(row).toBeVisible({ timeout: 60_000 });
  return ((await row.textContent()) ?? "").replace(/\s+/g, " ").trim();
}

/** Step 4 — close the "כמעט שם" info modal, fill passengers + contact, accept terms. */
async function fillReviewAndAcceptTerms(page: Page) {
  // The review step opens an info modal on mount — dismiss it first.
  const closeModal = page.getByRole("button", { name: "סגור הודעת זמן" });
  await expect(closeModal).toBeVisible({ timeout: 30_000 });
  await closeModal.click();

  // Passenger 1 (main contact) — name + email + phone.
  await page.locator("#firstName-0").fill("Test");
  await page.locator("#lastName-0").fill("Visitor");
  await page.getByPlaceholder("אימייל").fill("test@example.com");
  await page.getByPlaceholder("טלפון נייד").fill("0501234567");

  // Passenger 2 — name only (contact fields belong to the main contact).
  await page.locator("#firstName-1").fill("Second");
  await page.locator("#lastName-1").fill("Traveler");

  // Accept terms (desktop checkbox — #terms-mobile is hidden at md+).
  await page.locator("#terms").check();
}

/**
 * Submit as a phone order (no payment) and wait for the confirmation page.
 * The "צור קשר עם נציג" button calls handleSubmit() with payNow=false,
 * onlySave=false → POST /api/confirm-order → router.push(/confirmation/...).
 */
async function submitPhoneOrder(page: Page) {
  await page.getByRole("button", { name: "צור קשר עם נציג" }).click();
  await page.waitForURL(/\/confirmation\//, { timeout: 60_000 });
  await expect(
    page.getByRole("heading", { name: "פרטי ההזמנה" })
  ).toBeVisible({ timeout: 60_000 });
}

test.describe("order funnel → confirmation page", () => {
  test("Test 1 — happy flow: ticket → flight → hotel → review → confirmation", async ({
    page,
  }) => {
    test.setTimeout(300_000); // full live funnel + dev-mode route compilation
    const errors = captureErrors(page);

    await test.step("step 1 — ticket step loads, qty 2 selected", async () => {
      await page.goto(`/order/${EVENT_ID}`);
      const ticket = page.locator(TICKET_CARDS).first();
      await expect(ticket).toBeVisible({ timeout: 45_000 });
      await ticket.click(); // idempotent — cheapest ticket auto-selects
      // Quantity defaults to 2 (OrderContext). The card renders both a
      // desktop and a mobile counter — assert the visible one reads 2.
      await expect(
        page.locator(`[aria-label="${QUANTITY} כרטיסים נבחרו"]:visible`)
      ).toBeVisible();

      await page.getByRole("button", { name: "לבחירת טיסה" }).click();
    });

    await test.step("step 2 — best flight auto-selects, continue to hotel", async () => {
      // Event 454 has skip_flight=true, so the flight step shows split
      // buttons; the "with flight" continue enables once a flight is set.
      // FlightSelection default-selects the best flight (live Amadeus search).
      const toHotel = page.getByRole("button", {
        name: "בחר והמשך לבחירת מלון",
      });
      await expect(toHotel).toBeEnabled({ timeout: 90_000 });
      await toHotel.click();
    });

    await test.step("step 3 — hotel auto-selects, continue to review", async () => {
      // HotelSelection default-selects the cheapest hotel (live Ratehawk
      // search); the continue button enables once a hotel is set.
      const toReview = page.getByRole("button", {
        name: "בחר והמשך לסיכום",
      });
      await expect(toReview).toBeEnabled({ timeout: 90_000 });
      await toReview.click();
    });

    await test.step("step 4 — fill passengers + contact, accept terms, submit", async () => {
      await fillReviewAndAcceptTerms(page);
      await submitPhoneOrder(page);
    });

    await test.step("confirmation — every detail row is populated (with flight)", async () => {
      expect(await detailRow(page, "Booking Reference:")).toMatch(
        /Booking Reference:\s*\S+/
      );

      expect(await detailRow(page, "Event:")).toContain(EVENT_NAME);

      const dateRow = await detailRow(page, "Date:");
      expect(dateRow, "event date must render, not N/A").not.toContain("N/A");
      expect(dateRow).toMatch(/\d/);

      expect(await detailRow(page, "Location:")).toContain(EVENT_LOCATION);

      const ticketsRow = await detailRow(page, "Tickets:");
      expect(ticketsRow, "quantity must render, not (x)").toContain(
        `(x${QUANTITY})`
      );
      expect(ticketsRow).toContain(TICKET_CATEGORY);

      // Flight section — airline, flight numbers and schedule all present.
      const airlineRow = await detailRow(page, "Airline:");
      expect(airlineRow.replace("Airline:", "").trim().length).toBeGreaterThan(
        0
      );
      expect(await detailRow(page, "Flight Numbers-")).toMatch(
        /Outbound:.*Return:/
      );
      expect(await detailRow(page, "Flight Schedule-")).toMatch(/\d/);

      // Hotel row present with a value.
      expect(
        (await detailRow(page, "Hotel:")).replace("Hotel:", "").trim().length
      ).toBeGreaterThan(0);
    });

    await test.step("console — no red errors", async () => {
      expect(errors.realPageErrors(), "uncaught page exceptions").toEqual([]);
      expect(errors.realConsoleErrors(), "console errors").toEqual([]);
    });
  });

  test("Test 2 — skip-flight flow: order WITHOUT a flight", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const errors = captureErrors(page);

    await test.step("step 1 — ticket step loads, qty 2 selected", async () => {
      await page.goto(`/order/${EVENT_ID}`);
      const ticket = page.locator(TICKET_CARDS).first();
      await expect(ticket).toBeVisible({ timeout: 45_000 });
      await ticket.click();
      // Quantity defaults to 2 (OrderContext); assert the visible counter.
      await expect(
        page.locator(`[aria-label="${QUANTITY} כרטיסים נבחרו"]:visible`)
      ).toBeVisible();

      await page.getByRole("button", { name: "לבחירת טיסה" }).click();
    });

    await test.step("step 2 — flight step shows split buttons, skip the flight", async () => {
      // skip_flight=true → the footer renders the "לא צריך טיסה" skip button.
      // Skip immediately, while the live Amadeus search is still running —
      // this is the regression path: a search that resolves *after* the skip
      // must NOT re-populate the flight (FlightSelection drops stale results,
      // and OrderReview never serializes a flight on a skipped order).
      const skipFlight = page.getByRole("button", {
        name: "המשך ללא טיסה",
      });
      await expect(skipFlight).toBeVisible({ timeout: 30_000 });
      await skipFlight.click();
    });

    await test.step("step 3 — hotel auto-selects, continue to review", async () => {
      const toReview = page.getByRole("button", {
        name: "בחר והמשך לסיכום",
      });
      await expect(toReview).toBeEnabled({ timeout: 90_000 });
      await toReview.click();
    });

    await test.step("step 4 — fill passengers + contact, accept terms, submit", async () => {
      await fillReviewAndAcceptTerms(page);
      await submitPhoneOrder(page);
    });

    await test.step("confirmation — event details populated (the regression guard)", async () => {
      expect(await detailRow(page, "Booking Reference:")).toMatch(
        /Booking Reference:\s*\S+/
      );

      expect(await detailRow(page, "Event:")).toContain(EVENT_NAME);

      const dateRow = await detailRow(page, "Date:");
      expect(dateRow, "event date must render, not N/A").not.toContain("N/A");
      expect(dateRow).toMatch(/\d/);

      expect(await detailRow(page, "Location:")).toContain(EVENT_LOCATION);

      const ticketsRow = await detailRow(page, "Tickets:");
      expect(ticketsRow, "quantity must render, not (x)").toContain(
        `(x${QUANTITY})`
      );
      expect(ticketsRow).toContain(TICKET_CATEGORY);

      // Hotel row present with a value.
      expect(
        (await detailRow(page, "Hotel:")).replace("Hotel:", "").trim().length
      ).toBeGreaterThan(0);
    });

    await test.step("confirmation — flight section is the single 'ללא טיסה' row", async () => {
      expect(await detailRow(page, "Flight:")).toContain("ללא טיסה");
      // No airline / flight numbers / schedule rows for a skipped flight.
      await expect(page.getByText("Airline:")).toHaveCount(0);
      await expect(page.getByText("Flight Numbers-")).toHaveCount(0);
      await expect(page.getByText("Flight Schedule-")).toHaveCount(0);
    });

    await test.step("console — no red errors", async () => {
      expect(errors.realPageErrors(), "uncaught page exceptions").toEqual([]);
      expect(errors.realConsoleErrors(), "console errors").toEqual([]);
    });
  });
});
