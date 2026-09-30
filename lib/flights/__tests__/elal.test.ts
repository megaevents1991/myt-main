import { describe, it, expect } from "vitest";
import {
  ELAL_CLASSIC_UPGRADE_USD,
  classicSearchBody,
  elalClassicUpgradeUsd,
  offerIncludesCheckedBag,
  pickClassicOffer,
  sameFlights,
  validatingCarrier,
} from "../elal";

const seg = (carrier: string, number: string, from: string, to: string, at: string) => ({
  carrierCode: carrier,
  number,
  departure: { iataCode: from, at },
  arrival: { iataCode: to, at: at.replace("T06", "T10") },
});
const fare = (bag: boolean) => ({ includedCheckedBags: bag ? { quantity: 1 } : { quantity: 0 } });

/** El Al TLV-LON 20.11 / LON-TLV 23.11, two adults. */
const flights = [
  { segments: [seg("LY", "311", "TLV", "LHR", "2026-11-20T06:10:00")] },
  { segments: [seg("LY", "312", "LHR", "TLV", "2026-11-23T12:15:00")] },
];
const offer = (grandTotal: string, bag: boolean, itineraries = flights, currency = "USD") => ({
  validatingAirlineCodes: ["LY"],
  itineraries,
  travelerPricings: [
    { travelerType: "ADULT", fareDetailsBySegment: [fare(bag), fare(bag)] },
    { travelerType: "ADULT", fareDetailsBySegment: [fare(bag), fare(bag)] },
  ],
  price: { currency, grandTotal },
});
const lite = offer("1256.74", false);

describe("elalClassicUpgradeUsd - Amadeus' price only when it is above the floor", () => {
  it("floor when there is no quote", () => {
    expect(elalClassicUpgradeUsd(null)).toBe(ELAL_CLASSIC_UPGRADE_USD);
    expect(elalClassicUpgradeUsd(Number.NaN)).toBe(ELAL_CLASSIC_UPGRADE_USD);
  });
  it("floor when Amadeus is cheaper or equal", () => {
    expect(elalClassicUpgradeUsd(100)).toBe(120);
    expect(elalClassicUpgradeUsd(119.4)).toBe(120);
    expect(elalClassicUpgradeUsd(120)).toBe(120);
  });
  it("Amadeus' price, rounded up, when it is dearer", () => {
    expect(elalClassicUpgradeUsd(120.01)).toBe(121);
    expect(elalClassicUpgradeUsd(134.5)).toBe(135);
    expect(elalClassicUpgradeUsd(150)).toBe(150);
  });
});

describe("sameFlights", () => {
  it("matches on carrier, number and departure time, ignoring ids and prices", () => {
    expect(sameFlights(lite, offer("1456.74", true))).toBe(true);
  });
  it("a different return flight is not the same trip", () => {
    const other = [flights[0], { segments: [seg("LY", "318", "LHR", "TLV", "2026-11-23T20:00:00")] }];
    expect(sameFlights(lite, offer("1456.74", true, other))).toBe(false);
  });
  it("an offer without flights matches nothing", () => {
    expect(sameFlights({ itineraries: [] }, { itineraries: [] })).toBe(false);
  });
});

describe("offerIncludesCheckedBag", () => {
  it("every segment must carry a bag", () => {
    expect(offerIncludesCheckedBag(offer("1", true))).toBe(true);
    expect(offerIncludesCheckedBag(offer("1", false))).toBe(false);
    expect(
      offerIncludesCheckedBag({
        travelerPricings: [{ fareDetailsBySegment: [fare(true), { includedCheckedBags: { weight: 23 } }] }],
      }),
    ).toBe(true);
    expect(offerIncludesCheckedBag({ travelerPricings: [{ fareDetailsBySegment: [fare(true), fare(false)] }] })).toBe(false);
    expect(offerIncludesCheckedBag({})).toBe(false);
  });
});

describe("classicSearchBody", () => {
  it("asks for the bag-included fares of this carrier on the offer's route, dates and party", () => {
    expect(classicSearchBody(lite)).toEqual({
      currencyCode: "USD",
      originDestinations: [
        { id: "1", originLocationCode: "TLV", destinationLocationCode: "LHR", departureDateTimeRange: { date: "2026-11-20" } },
        { id: "2", originLocationCode: "LHR", destinationLocationCode: "TLV", departureDateTimeRange: { date: "2026-11-23" } },
      ],
      travelers: [
        { id: "1", travelerType: "ADULT" },
        { id: "2", travelerType: "ADULT" },
      ],
      sources: ["GDS"],
      searchCriteria: {
        maxFlightOffers: 250,
        flightFilters: { carrierRestrictions: { includedCarrierCodes: ["LY"] } },
        pricingOptions: { includedCheckedBagsOnly: true },
      },
    });
  });
  it("a connection searches city to city, not segment by segment", () => {
    const via = [
      { segments: [seg("LY", "395", "TLV", "MAD", "2026-11-20T06:10:00"), seg("LY", "8390", "MAD", "BCN", "2026-11-20T14:00:00")] },
      { segments: [seg("LY", "394", "BCN", "TLV", "2026-11-23T12:15:00")] },
    ];
    const body = classicSearchBody(offer("900", false, via)) as { originDestinations: Array<Record<string, unknown>> };
    expect(body.originDestinations[0]).toMatchObject({ originLocationCode: "TLV", destinationLocationCode: "BCN" });
  });
  it("null when the offer lacks what the search needs", () => {
    expect(classicSearchBody({ ...lite, itineraries: [] })).toBeNull();
    expect(classicSearchBody({ ...lite, travelerPricings: [] })).toBeNull();
    expect(classicSearchBody({ ...lite, validatingAirlineCodes: [], itineraries: [{ segments: [{ number: "1" }] }] })).toBeNull();
  });
});

describe("pickClassicOffer", () => {
  it("the cheapest bag-included offer on the same flights, priced per traveler", () => {
    const classic = offer("1456.74", true);
    const dearer = offer("1656.74", true);
    const picked = pickClassicOffer(lite, [dearer, classic]);
    expect(picked?.offer).toBe(classic);
    expect(picked?.deltaPerPaxUsd).toBeCloseTo(100);
  });
  it("ignores other flights, bag-less fares and other currencies", () => {
    const otherFlights = offer("1300", true, [flights[0], { segments: [seg("LY", "318", "LHR", "TLV", "2026-11-23T20:00:00")] }]);
    expect(pickClassicOffer(lite, [otherFlights, offer("1300", false), offer("1300", true, flights, "EUR")])).toBeNull();
  });
  it("never a negative delta", () => {
    expect(pickClassicOffer(lite, [offer("1200", true)])?.deltaPerPaxUsd).toBe(0);
  });
  it("null without a usable LITE price or party", () => {
    expect(pickClassicOffer({ ...lite, price: { currency: "USD", grandTotal: "" } }, [offer("1456.74", true)])).toBeNull();
    expect(pickClassicOffer({ ...lite, travelerPricings: [] }, [offer("1456.74", true)])).toBeNull();
  });
});

describe("validatingCarrier", () => {
  it("validating code first, else the first segment's carrier", () => {
    expect(validatingCarrier(lite)).toBe("LY");
    expect(validatingCarrier({ itineraries: [{ segments: [{ carrierCode: "ba" }] }] })).toBe("BA");
    expect(validatingCarrier({})).toBe("");
  });
});
