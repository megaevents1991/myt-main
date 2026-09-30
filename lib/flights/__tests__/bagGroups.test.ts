import { describe, it, expect } from "vitest";
import {
  chargedCheckedBagsAmount,
  offerItineraries,
  offerSegmentIds,
  roundTripBagUsd,
  withCheckedBag,
  type BagLine,
} from "../bagGroups";

const usd = (amount: string, currencyCode: string) =>
  currencyCode === "USD" ? parseFloat(amount) : currencyCode === "EUR" ? parseFloat(amount) * 1.1 : null;
const CHECKED = (n: string) => n === "CHECKED_BAG";
const line = (segmentIds: string[] | undefined, amount: string, quantity = 1, currencyCode = "USD"): BagLine => ({
  quantity,
  name: "CHECKED_BAG",
  price: { amount, currencyCode },
  segmentIds,
});
/** A line as Amadeus files it: priced per itinerary it touches. */
const perItinerary = (segmentIds: string[] | undefined, amount: string, quantity = 1): BagLine => ({
  ...line(segmentIds, amount, quantity),
  bookableByItinerary: true,
});

// El Al round trip: 16 out, 86 back (the 24.09 case - $75 a direction).
const SEGS = [["16"], ["86"]];

describe("offerItineraries / offerSegmentIds", () => {
  const offer = { itineraries: [{ segments: [{ id: "1" }, { id: "2" }] }, { segments: [{ id: "3" }] }] };
  it("lists the segments of each itinerary", () => {
    expect(offerItineraries(offer)).toEqual([["1", "2"], ["3"]]);
  });
  it("lists every segment of every itinerary", () => {
    expect(offerSegmentIds(offer)).toEqual(["1", "2", "3"]);
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
    const segs = [["1", "2"], ["3"]];
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

  // What Amadeus answered on 30.09, checked against its own re-price with the bag on.
  describe("a line priced per itinerary", () => {
    it("El Al: ONE $75 line over both directions is $150 for the trip", () => {
      expect(
        roundTripBagUsd([perItinerary(["41", "73"], "75"), perItinerary(["41", "73"], "170", 2)], [["41"], ["73"]], 1, CHECKED, usd),
      ).toBe(150);
      expect(
        roundTripBagUsd([perItinerary(["41", "73"], "75"), perItinerary(["41", "73"], "170", 2)], [["41"], ["73"]], 2, CHECKED, usd),
      ).toBe(340);
    });

    it("LOT with a connection each way: $37 a direction, not a segment", () => {
      expect(
        roundTripBagUsd([perItinerary(["44", "45", "86", "87"], "37")], [["44", "45"], ["86", "87"]], 1, CHECKED, usd),
      ).toBe(74);
    });

    it("British Airways: a line per direction is charged once each", () => {
      expect(
        roundTripBagUsd([perItinerary(["50"], "140"), perItinerary(["127"], "125.90")], [["50"], ["127"]], 1, CHECKED, usd),
      ).toBeCloseTo(265.9);
    });

    it("a line with no segmentIds is owed for every itinerary", () => {
      expect(roundTripBagUsd([perItinerary(undefined, "60")], SEGS, 1, CHECKED, usd)).toBe(120);
    });
  });
});

describe("withCheckedBag", () => {
  const fare = (segmentId: string, includedCheckedBags?: { quantity?: number; weight?: number }) => ({
    segmentId,
    includedCheckedBags,
  });

  it("adds one chargeable bag per traveler on every bag-less segment", () => {
    const offer = {
      id: "1",
      travelerPricings: [
        { travelerId: "1", fareDetailsBySegment: [fare("41", { quantity: 0 }), fare("73")] },
        { travelerId: "2", fareDetailsBySegment: [fare("41", { quantity: 0 }), fare("73")] },
      ],
    };
    const bagged = withCheckedBag(offer);
    expect(bagged?.id).toBe("1");
    for (const tp of bagged?.travelerPricings ?? [])
      for (const f of tp.fareDetailsBySegment)
        expect(f).toMatchObject({ additionalServices: { chargeableCheckedBags: { quantity: 1 } } });
    // The offer handed in is left alone.
    expect(offer.travelerPricings[0].fareDetailsBySegment[0]).not.toHaveProperty("additionalServices");
  });

  it("leaves a segment that already carries a bag (by count or by weight)", () => {
    const bagged = withCheckedBag({
      travelerPricings: [
        { fareDetailsBySegment: [fare("1", { quantity: 1 }), fare("2", { weight: 23 }), fare("3", { quantity: 0 })] },
      ],
    });
    const fares = bagged?.travelerPricings[0].fareDetailsBySegment ?? [];
    expect(fares[0]).not.toHaveProperty("additionalServices");
    expect(fares[1]).not.toHaveProperty("additionalServices");
    expect(fares[2]).toHaveProperty("additionalServices");
  });

  it("null when every segment already includes a bag", () => {
    expect(
      withCheckedBag({ travelerPricings: [{ fareDetailsBySegment: [fare("1", { quantity: 1 }), fare("2", { weight: 23 })] }] }),
    ).toBeNull();
    expect(withCheckedBag({})).toBeNull();
  });
});

describe("chargedCheckedBagsAmount", () => {
  it("reads the CHECKED_BAGS charge in the offer's currency", () => {
    expect(
      chargedCheckedBagsAmount({
        price: { currency: "USD", additionalServices: [{ amount: "300.00", type: "CHECKED_BAGS" }] },
      }),
    ).toEqual({ amount: "300.00", currencyCode: "USD" });
  });

  it("null when Amadeus priced no bag", () => {
    expect(chargedCheckedBagsAmount({ price: { currency: "USD" } })).toBeNull();
    expect(
      chargedCheckedBagsAmount({ price: { currency: "USD", additionalServices: [{ amount: "20.00", type: "SEATS" }] } }),
    ).toBeNull();
    expect(
      chargedCheckedBagsAmount({ price: { currency: "USD", additionalServices: [{ amount: "0.00", type: "CHECKED_BAGS" }] } }),
    ).toBeNull();
    expect(chargedCheckedBagsAmount(undefined)).toBeNull();
  });
});
