import { test, expect } from "@playwright/test";
import {
  getDefaultDateRange,
  getMinTravelDate,
} from "../../lib/getDefaultDateRange";
import type { Event, Flight } from "../../lib/app.types";

/**
 * Unit tests for getDefaultDateRange - pure function, no browser.
 *
 * Hotel checkout = return flight's departure calendar date (any hour).
 * Guest takes the last night and checks out the morning of the flight.
 *
 * Fixtures are built relative to "today" so they never go stale: the helper
 * clamps past/today event defaults to the min travel date (tomorrow), so
 * hardcoded calendar dates would silently change behavior once they pass.
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

const DEPART = daysFromNow(30);
const RETURN = daysFromNow(35);

const event = {
  def_date_depart: ymd(DEPART),
  def_date_return: ymd(RETURN),
} as Event;

// Minimal Flight mock - getDefaultDateRange only reads these two timestamps.
const flightWith = (arrivalTime: string, returnDepartureTime: string): Flight =>
  ({
    outbound: { arrivalTime },
    inbound: { departureTime: returnDepartureTime },
  }) as unknown as Flight;

test.describe("getDefaultDateRange - checkout from return flight time", () => {
  test("no flight → event default dates", () => {
    const [checkIn, checkOut] = getDefaultDateRange(event);
    expect(ymd(checkIn)).toBe(ymd(DEPART));
    expect(ymd(checkOut)).toBe(ymd(RETURN));
  });

  test("return flight before 06:00 → checkout = flight date", () => {
    const [, checkOut] = getDefaultDateRange(
      event,
      flightWith(at(DEPART, "10:00:00"), at(RETURN, "00:30:00")),
    );
    expect(ymd(checkOut)).toBe(ymd(RETURN));
  });

  test("return flight at 06:00 → checkout = flight date", () => {
    const [, checkOut] = getDefaultDateRange(
      event,
      flightWith(at(DEPART, "10:00:00"), at(RETURN, "06:00:00")),
    );
    expect(ymd(checkOut)).toBe(ymd(RETURN));
  });

  test("return flight at 11:00 → checkout = flight date", () => {
    const [, checkOut] = getDefaultDateRange(
      event,
      flightWith(at(DEPART, "10:00:00"), at(RETURN, "11:00:00")),
    );
    expect(ymd(checkOut)).toBe(ymd(RETURN));
  });

  test("late-evening return flight much later than the default → checkout = flight date", () => {
    const lateReturn = daysFromNow(52);
    const [, checkOut] = getDefaultDateRange(
      event,
      flightWith(at(DEPART, "10:00:00"), at(lateReturn, "22:00:00")),
    );
    expect(ymd(checkOut)).toBe(ymd(lateReturn));
  });

  test("check-in still respects the 8 AM arrival rule", () => {
    // arrival before 8 AM → check-in the day before
    const [earlyCheckIn] = getDefaultDateRange(
      event,
      flightWith(at(DEPART, "05:00:00"), at(RETURN, "11:00:00")),
    );
    expect(ymd(earlyCheckIn)).toBe(ymd(daysFromNow(29)));

    // arrival at/after 8 AM → check-in same day
    const [dayCheckIn] = getDefaultDateRange(
      event,
      flightWith(at(DEPART, "09:00:00"), at(RETURN, "11:00:00")),
    );
    expect(ymd(dayCheckIn)).toBe(ymd(DEPART));
  });
});

test.describe("getDefaultDateRange - stale default clamp (min travel date)", () => {
  test("getMinTravelDate = tomorrow at local midnight", () => {
    expect(getMinTravelDate().getTime()).toBe(daysFromNow(1).getTime());
  });

  test("def_date_depart today → check-in clamped to tomorrow, future checkout kept", () => {
    const staleEvent = {
      def_date_depart: ymd(daysFromNow(0)),
      def_date_return: ymd(daysFromNow(5)),
    } as Event;
    const [checkIn, checkOut] = getDefaultDateRange(staleEvent);
    expect(ymd(checkIn)).toBe(ymd(daysFromNow(1)));
    expect(ymd(checkOut)).toBe(ymd(daysFromNow(5)));
  });

  test("def_date_depart in the past, return still ahead → compressed but valid range", () => {
    const staleEvent = {
      def_date_depart: ymd(daysFromNow(-2)),
      def_date_return: ymd(daysFromNow(3)),
    } as Event;
    const [checkIn, checkOut] = getDefaultDateRange(staleEvent);
    expect(ymd(checkIn)).toBe(ymd(daysFromNow(1)));
    expect(ymd(checkOut)).toBe(ymd(daysFromNow(3)));
  });

  test("both defaults in the past → tomorrow + original trip length", () => {
    const staleEvent = {
      def_date_depart: ymd(daysFromNow(-6)),
      def_date_return: ymd(daysFromNow(-1)), // 5 nights originally
    } as Event;
    const [checkIn, checkOut] = getDefaultDateRange(staleEvent);
    expect(ymd(checkIn)).toBe(ymd(daysFromNow(1)));
    expect(ymd(checkOut)).toBe(ymd(daysFromNow(6)));
  });

  test("stale defaults but real flight chosen → flight dates win, no clamp", () => {
    const staleEvent = {
      def_date_depart: ymd(daysFromNow(-6)),
      def_date_return: ymd(daysFromNow(-1)),
    } as Event;
    const [checkIn, checkOut] = getDefaultDateRange(
      staleEvent,
      flightWith(at(daysFromNow(10), "09:00:00"), at(daysFromNow(15), "11:00:00")),
    );
    expect(ymd(checkIn)).toBe(ymd(daysFromNow(10)));
    expect(ymd(checkOut)).toBe(ymd(daysFromNow(15)));
  });
});
