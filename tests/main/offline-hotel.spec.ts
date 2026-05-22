import { test, expect } from "@playwright/test";

/**
 * Offline-hotel flight-date matching (main app).
 *
 * Feature under test — commit da494ab "require exact flight-date match for
 * offline hotels": offline inventory has FIXED dates, so /api/offline-hotels
 * returns a row ONLY when check_in/check_out exactly equal the flight-aligned
 * stay. Shift the stay by a day and the offline hotel must disappear; restore
 * the dates and it must come back.
 *
 * Event 400 has offline inventory row id 18 — "Soho Boutique Congreso",
 * Madrid, check_in 2026-07-09, check_out 2026-07-13.
 */

const EVENT_ID = 400;
const OFFLINE_HOTEL_NAME = /Soho Boutique/i;

// The offline row's own fixed window = the flight-aligned default stay.
const DEFAULT_CHECKIN = "2026-07-09";
const DEFAULT_CHECKOUT = "2026-07-13";
// Same stay shifted one day later — no exact match exists.
const SHIFTED_CHECKIN = "2026-07-10";
const SHIFTED_CHECKOUT = "2026-07-14";

type OfflineResponse = {
  hotels: { id: string }[];
  meta: Record<string, { checkin: string; checkout: string }>;
};

function offlineUrl(checkin: string, checkout: string) {
  return `/api/offline-hotels?eventId=${EVENT_ID}&checkin=${checkin}&checkout=${checkout}`;
}

test.describe("offline hotel — /api/offline-hotels exact date match", () => {
  test("offline hotel appears → disappears on date shift → reappears", async ({
    request,
  }) => {
    await test.step("default dates → offline hotel present", async () => {
      // Long timeout: the API route compiles on first hit in `next dev`.
      const res = await request.get(offlineUrl(DEFAULT_CHECKIN, DEFAULT_CHECKOUT), {
        timeout: 60_000,
      });
      expect(res.ok()).toBeTruthy();

      const body = (await res.json()) as OfflineResponse;
      expect(body.hotels.length).toBeGreaterThan(0);

      // The matched row carries its own fixed check_in/check_out.
      const metas = Object.values(body.meta);
      expect(
        metas.some(
          (m) =>
            m.checkin === DEFAULT_CHECKIN && m.checkout === DEFAULT_CHECKOUT
        )
      ).toBeTruthy();
    });

    await test.step("shift one day → no exact match → empty", async () => {
      const res = await request.get(offlineUrl(SHIFTED_CHECKIN, SHIFTED_CHECKOUT), {
        timeout: 60_000,
      });
      expect(res.ok()).toBeTruthy();

      const body = (await res.json()) as OfflineResponse;
      expect(body.hotels).toHaveLength(0);
    });

    await test.step("restore original dates → offline hotel back", async () => {
      // Long timeout: the API route compiles on first hit in `next dev`.
      const res = await request.get(offlineUrl(DEFAULT_CHECKIN, DEFAULT_CHECKOUT), {
        timeout: 60_000,
      });
      expect(res.ok()).toBeTruthy();

      const body = (await res.json()) as OfflineResponse;
      expect(body.hotels.length).toBeGreaterThan(0);
    });
  });
});

test.describe("offline hotel — order flow UI", () => {
  test("offline hotel toggles on the hotel step as the stay dates change", async ({
    page,
  }) => {
    test.slow(); // ticket + live Amadeus flight search + hotel step

    await test.step("step 1 — select a ticket", async () => {
      await page.goto(`/order/${EVENT_ID}`);
      const firstTicket = page
        .locator(
          '[role="group"][aria-labelledby="ticket-selection-heading"] > div:not(#ticket-selection-heading)'
        )
        .first();
      await expect(firstTicket).toBeVisible({ timeout: 45_000 });
      await firstTicket.click();
      await page.getByRole("button", { name: "לבחירת טיסה" }).click();
    });

    await test.step("step 2 — best (offline) flight auto-selects, continue", async () => {
      // FlightSelection default-selects the best flight, preferring an offline
      // flight when one exists. The footer continue button enables once a
      // flight is set. Long timeout — live Amadeus search.
      // `exact` avoids the Mantine Stepper's "3 מלון" step button.
      const toHotel = page.getByRole("button", {
        name: "לבחירת מלון",
        exact: true,
      });
      await expect(toHotel).toBeEnabled({ timeout: 90_000 });
      await toHotel.click();
    });

    // The hotel-step date picker — a Mantine DatePickerInput rendered as a
    // button showing the current range, e.g. "09/07/26 – 13/07/26".
    const dateButton = page.getByRole("button", { name: /\d\d\/\d\d\/\d\d/ });

    /**
     * Set the hotel stay via the Mantine range date picker. The offline-hotels
     * fetch keys off this date range, so changing it drives the offline list.
     * Calendar day buttons carry a full localized name, e.g. "9 יולי 2026".
     * Assumes the calendar shows July 2026 (the current value's month).
     */
    async function setStay(startDay: number, endDay: number) {
      const MONTH = "יולי 2026"; // July 2026 (Hebrew locale)
      await dateButton.click();
      await page
        .getByRole("button", { name: `${startDay} ${MONTH}`, exact: true })
        .click();
      await page
        .getByRole("button", { name: `${endDay} ${MONTH}`, exact: true })
        .click();
      await page.keyboard.press("Escape");
    }

    const offlineCard = page.getByText(OFFLINE_HOTEL_NAME).first();

    await test.step("step 3 — hotel step renders", async () => {
      await expect(dateButton).toBeVisible({ timeout: 90_000 });
    });

    await test.step("dates match offline row (9→13 Jul) → offline hotel appears", async () => {
      await setStay(9, 13);
      await expect(offlineCard).toBeVisible({ timeout: 60_000 });
    });

    await test.step("shift checkout +1 day (9→14 Jul) → offline hotel gone", async () => {
      await setStay(9, 14);
      await expect(offlineCard).toBeHidden({ timeout: 60_000 });
    });
  });
});
