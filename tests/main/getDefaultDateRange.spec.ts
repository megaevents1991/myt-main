import { test, expect } from "@playwright/test";
import { getDefaultDateRange } from "../../lib/getDefaultDateRange";
import type { Event, Flight } from "../../lib/app.types";

/**
 * Unit tests for getDefaultDateRange — pure function, no browser.
 *
 * Hotel checkout = return flight's departure calendar date (any hour).
 * Guest takes the last night and checks out the morning of the flight.
 */

const event = {
  def_date_depart: "2026-07-09",
  def_date_return: "2026-07-14",
} as Event;

// Minimal Flight mock — getDefaultDateRange only reads these two timestamps.
const flightWith = (arrivalTime: string, returnDepartureTime: string): Flight =>
  ({
    outbound: { arrivalTime },
    inbound: { departureTime: returnDepartureTime },
  }) as unknown as Flight;

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

test.describe("getDefaultDateRange — checkout from return flight time", () => {
  test("no flight → event default dates", () => {
    const [checkIn, checkOut] = getDefaultDateRange(event);
    expect(ymd(checkIn)).toBe("2026-07-09");
    expect(ymd(checkOut)).toBe("2026-07-14");
  });

  test("return flight before 06:00 → checkout = flight date", () => {
    const [, checkOut] = getDefaultDateRange(
      event,
      flightWith("2026-07-09T10:00:00", "2026-07-14T00:30:00")
    );
    expect(ymd(checkOut)).toBe("2026-07-14");
  });

  test("return flight at 06:00 → checkout = flight date", () => {
    const [, checkOut] = getDefaultDateRange(
      event,
      flightWith("2026-07-09T10:00:00", "2026-07-14T06:00:00")
    );
    expect(ymd(checkOut)).toBe("2026-07-14");
  });

  test("return flight at 11:00 → checkout = flight date", () => {
    const [, checkOut] = getDefaultDateRange(
      event,
      flightWith("2026-07-09T10:00:00", "2026-07-14T11:00:00")
    );
    expect(ymd(checkOut)).toBe("2026-07-14");
  });

  test("late return flight near a month boundary → checkout = flight date", () => {
    const [, checkOut] = getDefaultDateRange(
      event,
      flightWith("2026-07-09T10:00:00", "2026-07-31T22:00:00")
    );
    expect(ymd(checkOut)).toBe("2026-07-31");
  });

  test("check-in still respects the 8 AM arrival rule", () => {
    // arrival before 8 AM → check-in the day before
    const [earlyCheckIn] = getDefaultDateRange(
      event,
      flightWith("2026-07-09T05:00:00", "2026-07-14T11:00:00")
    );
    expect(ymd(earlyCheckIn)).toBe("2026-07-08");

    // arrival at/after 8 AM → check-in same day
    const [dayCheckIn] = getDefaultDateRange(
      event,
      flightWith("2026-07-09T09:00:00", "2026-07-14T11:00:00")
    );
    expect(ymd(dayCheckIn)).toBe("2026-07-09");
  });
});
