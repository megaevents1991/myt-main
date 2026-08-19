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
 * app/api/offline-hotels/route.ts - a checkout drift of even one day silently
 * drops the inventory row from the result set.
 *
 * Fixtures are relative to "today" (the helper clamps past defaults to the min
 * travel date, so hardcoded dates would change behavior once they pass).
 */

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const daysFromNow = (n: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
};

const at = (day: Date, time: string) => `${ymd(day)}T${time}`;

const flightWith = (arrivalTime: string, returnDepartureTime: string): Flight =>
  ({
    outbound: { arrivalTime },
    inbound: { departureTime: returnDepartureTime },
  }) as unknown as Flight;

test.describe("hotel date bug - checkout must equal return flight date", () => {
  const OUTBOUND = daysFromNow(20);
  const INBOUND = daysFromNow(25);

  const event = {
    def_date_depart: ymd(OUTBOUND),
    def_date_return: ymd(INBOUND),
    date: ymd(daysFromNow(23)),
  } as Event;

  test("user's reported scenario: inbound 14:00 → checkout = inbound date", () => {
    const [checkIn, checkOut] = getDefaultDateRange(
      event,
      flightWith(at(OUTBOUND, "12:00:00"), at(INBOUND, "14:00:00")),
    );
    expect(ymd(checkIn)).toBe(ymd(OUTBOUND));
    expect(ymd(checkOut)).toBe(ymd(INBOUND));
    expect(ymd(checkOut)).not.toBe(ymd(daysFromNow(26)));
  });

  test("morning return at 09:00 → no extra night", () => {
    const [, checkOut] = getDefaultDateRange(
      event,
      flightWith(at(OUTBOUND, "12:00:00"), at(INBOUND, "09:00:00")),
    );
    expect(ymd(checkOut)).toBe(ymd(INBOUND));
  });

  test("late evening return at 23:00 → no extra night", () => {
    const [, checkOut] = getDefaultDateRange(
      event,
      flightWith(at(OUTBOUND, "12:00:00"), at(INBOUND, "23:00:00")),
    );
    expect(ymd(checkOut)).toBe(ymd(INBOUND));
  });

  test("red-eye return at 02:00 → checkout still = flight date", () => {
    const [, checkOut] = getDefaultDateRange(
      event,
      flightWith(at(OUTBOUND, "12:00:00"), at(INBOUND, "02:00:00")),
    );
    expect(ymd(checkOut)).toBe(ymd(INBOUND));
  });

  test("no flight → falls back to event.def_date_return", () => {
    const [checkIn, checkOut] = getDefaultDateRange(event);
    expect(ymd(checkIn)).toBe(ymd(OUTBOUND));
    expect(ymd(checkOut)).toBe(ymd(INBOUND));
  });
});
