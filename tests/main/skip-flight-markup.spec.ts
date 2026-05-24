import {
  test,
  expect,
  request as apiRequest,
  type Page,
} from "@playwright/test";

/**
 * Skip-flight markup diagnostic — main app order funnel.
 *
 * PURPOSE
 * -------
 * Pin down a suspected "double markup" bug in the skip-flight price path.
 * The order total the customer sees on the review screen IS the value saved to
 * the backoffice reservation: `OrderReview.tsx` sets
 *   user_shown_price = finalPurchasePrice
 * and finalPurchasePrice = finalPurchasePriceCalc(affDiscount) = calculateBaseTotal()
 * (see app/order/hooks.tsx). So asserting the review-screen total fully covers
 * what gets charged/stored — no need to place a real order or hit payment.
 *
 * TEST EVENT — 454 "מטאליקה" (Metallica, Berlin), type music_live_event_dynamic.
 * Carries BOTH markups: skip_flight_markup (100) AND event_additional_markup
 * (10) — so a wrong total reveals which one is double-counted. DB row constants
 * are in EVENT_454 below; keep them in sync with the live row.
 * music_live_event_dynamic is NOT a tx_event, so TicketSelection serves the
 * fixed DB `tickets_and_rates` price (779) — the total is deterministic.
 *
 * PRICE FORMULA (app/order/hooks.tsx → calculateBaseTotal, skip-flight path):
 *   total = (ticketPrice + packageMarkup) * pax   // ticket + global markup
 *         + skipFlightMarkup * pax                // admin per-ticket skip-flight markup
 *         + flightComponent (0 — flight skipped)
 *         + hotelComponent                        // 0 when hotel also skipped
 *         + skipHotelCredit * pax                 // hotelPriceAddition when hotel skipped
 *
 * Tests 1 & 2 skip BOTH flight and hotel, so they need NO live provider data
 * (Amadeus / Ratehawk) — fully deterministic. Tests 0 & 3 need live inventory
 * and are left as fixme skeletons (see bottom of file).
 */

const EVENT_ID = 454;

/** Main app — fixed by playwright.config.ts (`main` project runs on :3000). */
const MAIN_URL = "http://localhost:3000";

/**
 * Event 454 constants — from the DB row Dor supplied.
 * If `yarn test:e2e` fails with an "off by N" message, first re-check these
 * against the live DB row and the NEXT_PUBLIC_MARKUP env var.
 */
const EVENT_454 = {
  ticketPrice: 779, // tickets_and_rates[0].price
  baseFlightPrice: 450, // base_flight_price
  skipFlightMarkup: 100, // skip_flight_markup
  eventAdditionalMarkup: 10, // event_additional_markup
};

/** Global package markup. Default 175; overridable via NEXT_PUBLIC_MARKUP. */
const PACKAGE_MARKUP = Number(process.env.NEXT_PUBLIC_MARKUP) || 175;

/**
 * Skip-hotel credit per ticket. hooks.tsx hotelPriceAddition (skipHotel branch):
 *   base_flight_price < 550 ? 100 : 150  →  450 < 550  →  100
 */
const SKIP_HOTEL_CREDIT = EVENT_454.baseFlightPrice < 550 ? 100 : 150;

/** Expected review total for 1 passenger, flight skipped, hotel skipped. */
const EXPECTED_1PAX =
  EVENT_454.ticketPrice +
  PACKAGE_MARKUP +
  EVENT_454.eventAdditionalMarkup +
  EVENT_454.skipFlightMarkup +
  SKIP_HOTEL_CREDIT; // 779 + 175 + 10 + 100 + 100 = 1164

/** Every component scales linearly with passenger count. */
const EXPECTED_2PAX = EXPECTED_1PAX * 2; // 2328

// ── Selectors ──────────────────────────────────────────────────────────────
const TICKET_GROUP =
  '[role="group"][aria-labelledby="ticket-selection-heading"]';
const TICKET_CARDS = `${TICKET_GROUP} > div:not(#ticket-selection-heading)`;

// ── Helpers ────────────────────────────────────────────────────────────────

/** "$1,164" → 1164 */
function parseMoney(text: string): number {
  return Number(text.replace(/[^0-9.]/g, ""));
}

/**
 * Explains a wrong total in terms of the suspected bug. The per-passenger diff
 * is the tell: it equals whichever markup(s) got applied an extra time.
 */
function diagnose(actual: number, expected: number, pax: number): string {
  const diff = actual - expected;
  if (diff === 0) return "matches expected";
  const perPax = diff / pax;

  // Each markup that could be double-counted, by per-passenger amount.
  const components: Record<string, number> = {
    "skip-flight markup": EVENT_454.skipFlightMarkup,
    "package markup": PACKAGE_MARKUP,
    "event_additional_markup": EVENT_454.eventAdditionalMarkup,
    "package + event_additional markup (getTotalMarkup)":
      PACKAGE_MARKUP + EVENT_454.eventAdditionalMarkup,
  };
  for (const [name, amount] of Object.entries(components)) {
    if (amount > 0 && perPax === amount) {
      return `${name} counted TWICE (+$${amount}/passenger)`;
    }
  }
  return `off by $${diff} ($${perPax}/passenger) — not a clean single double; re-check EVENT_454 constants and NEXT_PUBLIC_MARKUP`;
}

/** Step 1 — open event 454's order page and select the (only) ticket. */
async function openEventAndSelectTicket(page: Page) {
  await page.goto(`/order/${EVENT_ID}`);
  const ticket = page.locator(TICKET_CARDS).first();
  // Long timeout: the /order route compiles on first hit in `next dev`.
  await expect(ticket).toBeVisible({ timeout: 60_000 });
  await ticket.click();
}

/**
 * Set the ticket quantity to `pax`. The step-1 counter DEFAULTS TO 2 (music
 * events guarantee pair seating), so reaching 1 means stepping DOWN. Two
 * CounterInputs exist (desktop + mobile); `:visible` keeps the active one.
 */
async function setQuantity(page: Page, pax: number) {
  const counter = page.locator('[aria-label$="כרטיסים נבחרו"]:visible');
  await expect(counter).toBeVisible();
  const plus = page.locator('button[aria-label="הוסף כמות כרטיסים"]:visible');
  const minus = page.locator('button[aria-label="הפחת כמות כרטיסים"]:visible');

  let current = Number(await counter.innerText());
  while (current < pax) {
    await plus.click();
    current++;
    await expect(counter).toHaveText(String(current));
  }
  while (current > pax) {
    await minus.click();
    current--;
    await expect(counter).toHaveText(String(current));
  }
}

/** Steps 1→2→3→4 with both flight and hotel skipped. Returns the review total. */
async function runSkipFlightSkipHotel(page: Page, pax: number): Promise<number> {
  await test.step("step 1 — select ticket, set quantity", async () => {
    await openEventAndSelectTicket(page);
    await setQuantity(page, pax);
    const toFlight = page.getByRole("button", { name: "לבחירת טיסה" });
    await expect(toFlight).toBeEnabled();
    await toFlight.click();
  });

  await test.step("step 2 — skip flight", async () => {
    // Event 454 has skip_flight=true, so the funnel offers a skip button in
    // the footer immediately — no need to wait for the Amadeus search. Its
    // accessible name is the aria-label ("המשך ללא טיסה"); visible text is
    // "לא צריך טיסה".
    const skipFlight = page.getByRole("button", { name: "המשך ללא טיסה" });
    await expect(skipFlight).toBeVisible({ timeout: 30_000 });
    await skipFlight.click();
  });

  await test.step("step 3 — skip hotel", async () => {
    // Accessible name is the aria-label ("המשך ללא מלון"); text is "לא צריך מלון".
    const skipHotel = page.getByRole("button", { name: "המשך ללא מלון" });
    await expect(skipHotel).toBeVisible({ timeout: 30_000 });
    await skipHotel.click();
  });

  return test.step("step 4 — read the review total", async () => {
    const total = page.getByTestId("order-total");
    await expect(total).toBeVisible({ timeout: 30_000 });
    return parseMoney(await total.innerText());
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe("skip-flight markup — event 454 (Metallica Berlin)", () => {
  /**
   * The order page reads events through `unstable_cache` (getCachedEvents,
   * 1h TTL, persisted to .next/cache — survives a dev-server restart). Bust the
   * "events" tag first so the pricing assertions see the live DB row. Without a
   * configured secret the run continues but may read a STALE cached row.
   */
  test.beforeAll(async () => {
    const secret = process.env.REVALIDATION_SECRET;
    if (!secret) {
      console.warn(
        "[skip-flight-markup] REVALIDATION_SECRET not set in tests/.env — " +
          "tests may read a stale cached event row."
      );
      return;
    }
    const ctx = await apiRequest.newContext({ baseURL: MAIN_URL });
    try {
      const res = await ctx.get(
        `/api/revalidate?secret=${encodeURIComponent(secret)}`,
        { timeout: 60_000 }
      );
      expect(
        res.ok(),
        `events cache revalidation failed (HTTP ${res.status()})`
      ).toBeTruthy();
    } finally {
      await ctx.dispose();
    }
  });

  test("Test 1 — 1 passenger, skip flight + skip hotel → $1164", async ({
    page,
  }) => {
    test.slow(); // dev-mode route compilation + heavy order page

    const total = await runSkipFlightSkipHotel(page, 1);

    expect(
      total,
      `Review total $${total}, expected $${EXPECTED_1PAX} ` +
        `(ticket ${EVENT_454.ticketPrice} + markup ${PACKAGE_MARKUP} + ` +
        `skip-flight ${EVENT_454.skipFlightMarkup} + skip-hotel credit ${SKIP_HOTEL_CREDIT}). ` +
        `Diagnosis: ${diagnose(total, EXPECTED_1PAX, 1)}.`
    ).toBe(EXPECTED_1PAX);
  });

  test("Test 2 — 2 passengers, skip flight + skip hotel → $2328", async ({
    page,
  }) => {
    test.slow();

    const total = await runSkipFlightSkipHotel(page, 2);

    expect(
      total,
      `Review total $${total}, expected $${EXPECTED_2PAX} (= $${EXPECTED_1PAX} × 2). ` +
        `Diagnosis: ${diagnose(total, EXPECTED_2PAX, 2)}.`
    ).toBe(EXPECTED_2PAX);
  });

  /**
   * Test 3 — 1 passenger, skip flight, KEEP hotel.
   *
   * Needs live hotel inventory (Ratehawk) + a hotel-card selector from
   * HotelSelection.tsx, and the expected total depends on the chosen hotel's
   * live price. To finish:
   *   - on step 3, pick the cheapest hotel card (add a selector)
   *   - read the hotel price shown, then expected total =
   *       ticketPrice + PACKAGE_MARKUP + skipFlightMarkup + hotelComponent
   *     where hotelComponent follows hooks.tsx (priceOutsidePackBoundaries).
   */
  test.fixme(
    "Test 3 — 1 passenger, skip flight, keep hotel",
    async ({ page }) => {
      test.slow();
      await openEventAndSelectTicket(page);
      await page.getByRole("button", { name: "לבחירת טיסה" }).click();
      await page.getByRole("button", { name: "המשך ללא טיסה" }).click();
      // TODO: pick the cheapest hotel card on step 3, then continue to review.
      // TODO: assert getByTestId("order-total") against the hotel-aware total.
    }
  );

  /**
   * Test 0 — baseline, NO skip (1 passenger, real flight + real hotel).
   *
   * Confirms the non-skip path is clean, isolating any bug to the skip logic.
   * Needs live Amadeus + Ratehawk inventory and flight/hotel card selectors.
   */
  test.fixme("Test 0 — baseline, real flight + hotel", async ({ page }) => {
    test.slow();
    await openEventAndSelectTicket(page);
    // TODO: step 2 pick a flight, step 3 pick a hotel, read review total.
  });
});
