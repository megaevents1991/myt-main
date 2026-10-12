import { describe, expect, it } from "vitest";
import {
  MAX_LEG_HOURS,
  getDefaultDateRange,
  trustedArrival,
} from "../getDefaultDateRange";
import type { Event, Flight } from "../app.types";

// Local-time ISO strings on purpose - the flights table and Amadeus both hand
// out timestamps without a zone, and the pickers compare local days.
const day = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

// Far enough ahead that the min-travel-date clamp never applies.
const event = {
  def_date_depart: "2027-05-20",
  def_date_return: "2027-05-24",
} as unknown as Event;

const flight = (
  outbound: { departureTime: string; arrivalTime: string },
  inbound = {
    departureTime: "2027-05-24T15:00:00",
    arrivalTime: "2027-05-24T19:00:00",
  }
): Flight => ({ id: "1", outbound, inbound }) as unknown as Flight;

const range = (f?: Flight) => getDefaultDateRange(event, f).map(day);

describe("getDefaultDateRange", () => {
  it("with no flight the event's default dates are the stay", () => {
    expect(range()).toEqual(["2027-05-20", "2027-05-24"]);
  });

  it("check-in is the day the outbound lands, check-out the day the return leaves", () => {
    expect(
      range(
        flight({
          departureTime: "2027-05-20T10:00:00",
          arrivalTime: "2027-05-20T14:00:00",
        })
      )
    ).toEqual(["2027-05-20", "2027-05-24"]);
  });

  it("a landing before 08:00 checks in the evening before", () => {
    expect(
      range(
        flight({
          departureTime: "2027-05-20T23:30:00",
          arrivalTime: "2027-05-21T03:10:00",
        })
      )
    ).toEqual(["2027-05-20", "2027-05-24"]);
  });

  it("a long leg that lands the next morning still checks in on the landing day", () => {
    expect(
      range(
        flight({
          departureTime: "2027-05-20T06:00:00",
          arrivalTime: "2027-05-21T10:00:00",
        })
      )
    ).toEqual(["2027-05-21", "2027-05-24"]);
  });

  it("a landing saved in the wrong month (20/07 for 20/05) falls back to the takeoff's day", () => {
    // The 2026-10-12 case: an offline flight with its outbound landing two
    // months after its takeoff put the check-in after the check-out.
    expect(
      range(
        flight({
          departureTime: "2027-05-20T10:00:00",
          arrivalTime: "2027-07-20T14:00:00",
        })
      )
    ).toEqual(["2027-05-20", "2027-05-24"]);
  });

  it("a landing before the takeoff falls back to the takeoff's day", () => {
    expect(
      range(
        flight({
          departureTime: "2027-05-20T10:00:00",
          arrivalTime: "2027-05-19T14:00:00",
        })
      )
    ).toEqual(["2027-05-20", "2027-05-24"]);
  });

  it("the '0' an Amadeus offer with no landing segment leaves is not a date to check in on", () => {
    expect(
      range(
        flight({ departureTime: "2027-05-20T10:00:00", arrivalTime: "0" })
      )
    ).toEqual(["2027-05-20", "2027-05-24"]);
  });

  it("an unreadable return departure leaves the check-out on the event's default", () => {
    expect(
      range(
        flight(
          {
            departureTime: "2027-05-20T10:00:00",
            arrivalTime: "2027-05-20T14:00:00",
          },
          { departureTime: "not a date", arrivalTime: "" }
        )
      )
    ).toEqual(["2027-05-20", "2027-05-24"]);
  });
});

describe("trustedArrival", () => {
  const takeoff = "2027-05-20T10:00:00";
  const localIso = (d: Date) =>
    `${day(d)}T${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}:00`;
  const hoursAfterTakeoff = (hours: number) => {
    const d = new Date(takeoff);
    d.setTime(d.getTime() + hours * 3_600_000);
    return localIso(d);
  };

  it("trusts a landing up to MAX_LEG_HOURS after the takeoff", () => {
    expect(trustedArrival(takeoff, "2027-05-20T14:00:00")).not.toBeNull();
    expect(trustedArrival(takeoff, hoursAfterTakeoff(MAX_LEG_HOURS))).not.toBeNull();
  });

  it("refuses a landing past that window or before the takeoff", () => {
    expect(trustedArrival(takeoff, hoursAfterTakeoff(MAX_LEG_HOURS + 1))).toBeNull();
    expect(trustedArrival(takeoff, "2027-05-20T09:59:00")).toBeNull();
  });

  it("with no takeoff to measure against the landing is taken as it is", () => {
    expect(trustedArrival(undefined, "2027-05-20T14:00:00")?.getHours()).toBe(14);
    expect(trustedArrival(takeoff, undefined)).toBeNull();
    expect(trustedArrival(takeoff, "nope")).toBeNull();
  });
});
