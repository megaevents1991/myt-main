import { describe, it, expect } from "vitest";
import { buildOfflineStops, isoDurationToHours } from "../offlineStops";

describe("buildOfflineStops", () => {
  it("returns just the destination for a non-stop leg", () => {
    expect(buildOfflineStops("BCN", null, null)).toEqual([
      { iataCode: "BCN", duration: null },
    ]);
  });

  it("puts the stopover before the destination", () => {
    expect(buildOfflineStops("BCN", "VIE", 2)).toEqual([
      { iataCode: "VIE", duration: 2 },
      { iataCode: "BCN", duration: null },
    ]);
  });

  it("keeps a stopover with an unknown duration", () => {
    expect(buildOfflineStops("BCN", "VIE", null)).toEqual([
      { iataCode: "VIE", duration: null },
      { iataCode: "BCN", duration: null },
    ]);
  });
});

describe("isoDurationToHours", () => {
  it("reads a Postgres interval rendered as HH:MM:SS", () => {
    expect(isoDurationToHours("02:30:00")).toBe(2.5);
  });

  it("returns null when there is no duration", () => {
    expect(isoDurationToHours(null)).toBeNull();
    expect(isoDurationToHours("")).toBeNull();
  });

  it("ignores an unparseable value rather than producing NaN", () => {
    expect(isoDurationToHours("not-a-duration")).toBeNull();
  });
});
