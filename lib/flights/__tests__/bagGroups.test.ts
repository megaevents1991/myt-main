import { describe, it, expect } from "vitest";
import { offerSegmentIds, roundTripBagUsd, type BagLine } from "../bagGroups";

const usd = (amount: string, currencyCode: string) =>
  currencyCode === "USD" ? parseFloat(amount) : currencyCode === "EUR" ? parseFloat(amount) * 1.1 : null;
const CHECKED = (n: string) => n === "CHECKED_BAG";
const line = (segmentIds: string[] | undefined, amount: string, quantity = 1, currencyCode = "USD"): BagLine => ({
  quantity,
  name: "CHECKED_BAG",
  price: { amount, currencyCode },
  segmentIds,
});

// El Al round trip: 16 out, 86 back (the 24.09 case - $75 a direction).
const SEGS = ["16", "86"];

describe("offerSegmentIds", () => {
  it("lists every segment of every itinerary", () => {
    expect(
      offerSegmentIds({ itineraries: [{ segments: [{ id: "1" }, { id: "2" }] }, { segments: [{ id: "3" }] }] }),
    ).toEqual(["1", "2", "3"]);
  });
});

describe("roundTripBagUsd", () => {
  it("sums one line per direction - $75 + $75 = $150", () => {
    expect(roundTripBagUsd([line(["16"], "75"), line(["86"], "75")], SEGS, 1, CHECKED, usd)).toBe(150);
  });

  it("never sells a one-way bag", () => {
    expect(roundTripBagUsd([line(["16"], "75")], SEGS, 1, CHECKED, usd)).toBeNull();
  });

  it("keeps the cheapest line per group", () => {
    expect(
      roundTripBagUsd([line(["16"], "90"), line(["16"], "75"), line(["86"], "80")], SEGS, 1, CHECKED, usd),
    ).toBe(155);
  });

  it("a line with no segmentIds covers the whole trip", () => {
    expect(roundTripBagUsd([line(undefined, "120")], SEGS, 1, CHECKED, usd)).toBe(120);
    expect(roundTripBagUsd([line(undefined, "200"), line(["16"], "75"), line(["86"], "75")], SEGS, 1, CHECKED, usd)).toBe(150);
  });

  it("a connection outbound is one group of two segments", () => {
    const segs = ["1", "2", "3"];
    expect(roundTripBagUsd([line(["2", "1"], "60"), line(["3"], "60")], segs, 1, CHECKED, usd)).toBe(120);
    expect(roundTripBagUsd([line(["1"], "60"), line(["3"], "60")], segs, 1, CHECKED, usd)).toBeNull();
  });

  it("never charges a segment twice (overlapping groups)", () => {
    expect(
      roundTripBagUsd([line(["16", "86"], "140"), line(["16"], "10")], SEGS, 1, CHECKED, usd),
    ).toBe(140);
  });

  it("converts each line and filters quantity/name", () => {
    expect(roundTripBagUsd([line(["16"], "50", 1, "EUR"), line(["86"], "55")], SEGS, 1, CHECKED, usd)).toBeCloseTo(110);
    expect(roundTripBagUsd([line(["16"], "75", 2), line(["86"], "75", 2)], SEGS, 1, CHECKED, usd)).toBeNull();
    expect(roundTripBagUsd([line(["16"], "130", 2), line(["86"], "130", 2)], SEGS, 2, CHECKED, usd)).toBe(260);
    expect(roundTripBagUsd([line(["16"], "75", 1, "GBP"), line(["86"], "75")], SEGS, 1, CHECKED, usd)).toBeNull();
  });

  it("ignores a line naming a segment the offer doesn't have", () => {
    expect(roundTripBagUsd([line(["16", "99"], "75"), line(["86"], "75")], SEGS, 1, CHECKED, usd)).toBeNull();
  });
});
