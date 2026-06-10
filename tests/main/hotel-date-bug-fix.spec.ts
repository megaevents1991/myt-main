import { test, expect } from "@playwright/test";
import { getDefaultDateRange } from "../../lib/getDefaultDateRange";
import type { Event, Flight } from "../../lib/app.types";

/**
 * Regression test for the production bug where the hotel stay was patched one
 * night longer than the flight window. Original report (event 6/6):
 *   flight 2026-06-03 → 2026-06-08
 *   hotel  2026-06-03 → 2026-06-09   ← buggy (extra night)
 *   hotel  2026-06-03 → 2026-06-08   ← expected
 *
 * Both the online (Ratehawk) pipeline and the offline-inventory pipeline derive
 * checkin/checkout from getDefaultDateRange, so a unit test on the helper
 * covers both. The offline path additionally requires an EXACT date match in
 * app/api/offline-hotels/route.ts — a checkout drift of even one day silently
 * drops the inventory row from the result set.
 */

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const flightWith = (arrivalTime: string, returnDepartureTime: string): Flight =>
  ({
    outbound: { arrivalTime },
    inbound: { departureTime: returnDepartureTime },
  }) as unknown as Flight;

test.describe("hotel date bug — checkout must equal return flight date", () => {
  const event = {
    def_date_depart: "2026-06-03",
    def_date_return: "2026-06-08",
    date: "2026-06-06",
  } as Event;

  test("user's reported scenario: outbound 3/6, inbound 8/6 14:00 → checkout 8/6", () => {
    const [checkIn, checkOut] = getDefaultDateRange(
      event,
      flightWith("2026-06-03T12:00:00", "2026-06-08T14:00:00")
    );
    expect(ymd(checkIn)).toBe("2026-06-03");
    expect(ymd(checkOut)).toBe("2026-06-08");
    expect(ymd(checkOut)).not.toBe("2026-06-09");
  });

  test("morning return at 09:00 → no extra night", () => {
    const [, checkOut] = getDefaultDateRange(
      event,
      flightWith("2026-06-03T12:00:00", "2026-06-08T09:00:00")
    );
    expect(ymd(checkOut)).toBe("2026-06-08");
  });

  test("late evening return at 23:00 → no extra night", () => {
    const [, checkOut] = getDefaultDateRange(
      event,
      flightWith("2026-06-03T12:00:00", "2026-06-08T23:00:00")
    );
    expect(ymd(checkOut)).toBe("2026-06-08");
  });

  test("red-eye return at 02:00 → checkout still = flight date", () => {
    const [, checkOut] = getDefaultDateRange(
      event,
      flightWith("2026-06-03T12:00:00", "2026-06-08T02:00:00")
    );
    expect(ymd(checkOut)).toBe("2026-06-08");
  });

  test("no flight → falls back to event.def_date_return", () => {
    const [checkIn, checkOut] = getDefaultDateRange(event);
    expect(ymd(checkIn)).toBe("2026-06-03");
    expect(ymd(checkOut)).toBe("2026-06-08");
  });
});
