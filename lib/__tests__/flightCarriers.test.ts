import { describe, it, expect } from "vitest";
import {
  getFlightCarrierCodes,
  ISRAELI_AIRLINE_CODES,
} from "../flightCarriers";
import type { Flight } from "../app.types";

// The filter only reads `airline` and the first outbound segment of `offer` -
// everything else is irrelevant to carrier matching.
const flight = (
  airline: string,
  firstSegment?: { carrierCode?: string; operating?: { carrierCode: string } },
): Flight =>
  ({
    airline,
    offer: firstSegment
      ? { itineraries: [{ segments: [firstSegment] }] }
      : ({} as Flight["offer"]),
  }) as unknown as Flight;

// flightFilter.ts's matchesAirline, verbatim.
const matchesIsraeliTab = (f: Flight) =>
  getFlightCarrierCodes(f).some((code) => ISRAELI_AIRLINE_CODES.includes(code));

describe("getFlightCarrierCodes", () => {
  it("a real airline as validating carrier IS the card - the operating carrier must not leak in", () => {
    // Iberia-validated codeshare riding El Al metal: the card says "IBERIA",
    // so the ישראלי tab must not claim it.
    const iberiaOnElAlMetal = flight("IB", {
      carrierCode: "IB",
      operating: { carrierCode: "LY" },
    });
    expect(getFlightCarrierCodes(iberiaOnElAlMetal)).toEqual(["IB"]);
    expect(matchesIsraeliTab(iberiaOnElAlMetal)).toBe(false);
  });

  it("keeps Blue Bird reachable: Hahn Air tickets it, the card shows Bluebird", () => {
    const blueBirdViaHahnAir = flight("HR", {
      carrierCode: "H1",
      operating: { carrierCode: "BZ" },
    });
    expect(getFlightCarrierCodes(blueBirdViaHahnAir)).toEqual(["HR", "BZ"]);
    expect(matchesIsraeliTab(blueBirdViaHahnAir)).toBe(true);
  });

  it("Hahn-Air-ticketed El Al inventory (relabelled card) matches too", () => {
    expect(
      matchesIsraeliTab(flight("HR", { operating: { carrierCode: "LY" } })),
    ).toBe(true);
  });

  it("Hahn Air on foreign metal stays foreign", () => {
    expect(
      matchesIsraeliTab(flight("HR", { operating: { carrierCode: "4Y" } })),
    ).toBe(false);
  });

  it("falls back to the marketing carrier when a Hahn Air segment lacks `operating`", () => {
    expect(getFlightCarrierCodes(flight("HR", { carrierCode: "BZ" }))).toEqual([
      "HR",
      "BZ",
    ]);
  });

  it("offline flights (empty offer) match on airline alone", () => {
    const offline = flight("6H");
    expect(getFlightCarrierCodes(offline)).toEqual(["6H"]);
    expect(matchesIsraeliTab(offline)).toBe(true);
  });

  it("a plainly Israeli-validated flight still matches", () => {
    expect(matchesIsraeliTab(flight("LY", { carrierCode: "LY" }))).toBe(true);
  });
});
