import { describe, expect, it } from "vitest";
import fixture from "./fixtures/amadeus-multicity-offer.json";
import {
  isAmadeusRateLimited,
  isAmadeusSystemError,
  itineraryFlightsFromOffers,
  MAX_STOP_DURATION_HOURS,
  MAX_STOPS,
  multiCityBody,
  offerToItineraryFlight,
  validateFlightRequest,
} from "../itinerary/flightOffers";

type Offer = FlightOffer;
const base = fixture as unknown as Offer;
const clone = (): Offer => structuredClone(base);
const CARRIERS = { LY: "EL AL", AF: "AIR FRANCE", HR: "HAHN AIR", U8: "TUS AIRWAYS" };

/**
 * `itineraries[idx]` rebuilt as a chain of 1-hour segments with the given layovers (hours)
 * between them. Every new segment gets the fare details of the itinerary's first one, so
 * the bag policy stays what it was.
 */
function connect(offer: Offer, idx: number, layovers: number[]): Offer {
  const it = offer.itineraries[idx];
  const oldIds = it.segments.map((s) => s.id);
  const first = it.segments[0];
  const hubs = ["AMS", "FRA", "MUC", "ZRH"];
  const start = new Date(first.departure.at).getTime();
  const HOUR = 3_600_000;
  const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 19);

  let t = start;
  const segments = [...layovers, null].map((layover, i) => {
    const dep = t;
    const arr = dep + HOUR;
    t = arr + (layover ?? 0) * HOUR;
    return {
      ...first,
      id: `${idx}${i}`,
      number: String(900 + i),
      departure: { ...first.departure, iataCode: i === 0 ? first.departure.iataCode : hubs[i - 1], at: stamp(dep) },
      arrival: {
        ...first.arrival,
        iataCode: layover === null ? it.segments.at(-1)!.arrival.iataCode : hubs[i],
        at: stamp(arr),
      },
    };
  });
  it.segments = segments;
  for (const tp of offer.travelerPricings) {
    const proto = tp.fareDetailsBySegment.find((f) => f.segmentId === oldIds[0])!;
    tp.fareDetailsBySegment = [
      ...tp.fareDetailsBySegment.filter((f) => !oldIds.includes(f.segmentId)),
      ...segments.map((s) => ({ ...proto, segmentId: s.id })),
    ];
  }
  return offer;
}

describe("multiCityBody", () => {
  const legs = [
    { from: "TLV", to: "PAR", date: "2027-05-11" },
    { from: "PAR", to: "LON", date: "2027-05-13" },
    { from: "LON", to: "TLV", date: "2027-05-16" },
  ];

  it("3 legs / 2 adults / connections allowed: one origin-destination per leg", () => {
    expect(multiCityBody(legs, 2, false)).toEqual({
      currencyCode: "USD",
      originDestinations: [
        { id: "1", originLocationCode: "TLV", destinationLocationCode: "PAR", departureDateTimeRange: { date: "2027-05-11" } },
        { id: "2", originLocationCode: "PAR", destinationLocationCode: "LON", departureDateTimeRange: { date: "2027-05-13" } },
        { id: "3", originLocationCode: "LON", destinationLocationCode: "TLV", departureDateTimeRange: { date: "2027-05-16" } },
      ],
      travelers: [
        { id: "1", travelerType: "ADULT" },
        { id: "2", travelerType: "ADULT" },
      ],
      sources: ["GDS"],
      searchCriteria: { maxFlightOffers: 250 },
    });
  });

  it("nonStop adds the zero-connection filter and nothing else", () => {
    const body = multiCityBody(legs, 2, true) as { searchCriteria: unknown };
    expect(body.searchCriteria).toEqual({
      maxFlightOffers: 250,
      flightFilters: { connectionRestriction: { maxNumberOfConnections: 0 } },
    });
  });

  it("one traveler per adult, numbered from 1", () => {
    const body = multiCityBody(legs, 4, false) as { travelers: { id: string }[] };
    expect(body.travelers.map((t) => t.id)).toEqual(["1", "2", "3", "4"]);
  });
});

describe("offerToItineraryFlight", () => {
  it("constants mirror the live search route", () => {
    expect(MAX_STOPS).toBe(1);
    expect(MAX_STOP_DURATION_HOURS).toBe(4);
  });

  it("a 3-itinerary offer: 3 legs, outbound = first, inbound = last, price = grandTotal", () => {
    const offer = clone();
    const f = offerToItineraryFlight(offer, "7", 2, CARRIERS)!;
    expect(f).not.toBeNull();
    expect(f.legs).toHaveLength(3);
    expect(f.outbound).toEqual(f.legs[0]);
    expect(f.inbound).toEqual(f.legs[2]);
    expect(f.price).toBe(1234.5);
    expect(f.trainLegs).toEqual([]);
    expect(f.id).toBe("7");
    expect(f.offer).toBe(offer);
    expect(f.numOfTravelers).toBe(2);
    expect(f.airline).toBe("LY");
    expect(f.stops).toBe(0);
    expect(f.duration).toBe("PT5H");
    expect(f.metadata).toMatchObject({ iata: "LY", name: "EL AL" });
  });

  it("each leg is the Flight segment of its itinerary", () => {
    const f = offerToItineraryFlight(clone(), "1", 2, CARRIERS)!;
    expect(f.legs.map((l) => [l.departureAirport, l.arrivalAirport])).toEqual([
      ["TLV", "CDG"],
      ["CDG", "LHR"],
      ["LHR", "TLV"],
    ]);
    expect(f.legs[1]).toEqual({
      departureTime: "2027-05-13T10:00:00",
      arrivalTime: "2027-05-13T10:20:00",
      departureAirport: "CDG",
      arrivalAirport: "LHR",
      stops: [{ iataCode: "LHR", duration: null }],
      duration: "PT1H20M",
      checkBagsIncluded: true,
      cabinBagsIncluded: true,
      flightNumber: "LY5012",
      operatedBy: undefined,
    });
  });

  it("a one-stop itinerary stays, with the layover in hours on the stop", () => {
    const offer = connect(clone(), 1, [2]);
    const f = offerToItineraryFlight(offer, "1", 2, CARRIERS)!;
    expect(f).not.toBeNull();
    expect(f.legs[1].stops).toEqual([
      { iataCode: "AMS", duration: 2 },
      { iataCode: "LHR", duration: null },
    ]);
  });

  it("a two-stop itinerary -> null", () => {
    expect(offerToItineraryFlight(connect(clone(), 1, [1, 1]), "1", 2, CARRIERS)).toBeNull();
    expect(offerToItineraryFlight(connect(clone(), 0, [1, 1]), "1", 2, CARRIERS)).toBeNull();
  });

  it("a 5 h layover -> null; exactly 4 h stays; 4 h 30 rounds up to 5 and goes", () => {
    expect(offerToItineraryFlight(connect(clone(), 2, [5]), "1", 2, CARRIERS)).toBeNull();
    expect(offerToItineraryFlight(connect(clone(), 2, [4]), "1", 2, CARRIERS)).not.toBeNull();
    expect(offerToItineraryFlight(connect(clone(), 2, [4.5]), "1", 2, CARRIERS)).toBeNull();
  });

  it("a bag policy that differs between itineraries -> null", () => {
    const offer = clone();
    for (const tp of offer.travelerPricings) {
      const d = tp.fareDetailsBySegment.find((f) => f.segmentId === "2")!;
      d.includedCheckedBags = { quantity: 0 };
    }
    expect(offerToItineraryFlight(offer, "1", 2, CARRIERS)).toBeNull();
  });

  it("a weight allowance counts as a bag, quantity 0 does not", () => {
    const offer = clone();
    for (const tp of offer.travelerPricings) {
      for (const d of tp.fareDetailsBySegment) {
        d.includedCheckedBags = { weight: 23, weightUnit: "KG" };
        d.includedCabinBags = { quantity: 0 };
      }
    }
    const f = offerToItineraryFlight(offer, "1", 2, CARRIERS)!;
    expect(f.legs.every((l) => l.checkBagsIncluded && !l.cabinBagsIncluded)).toBe(true);
  });

  it("carrier U8 on one itinerary -> +45 per adult, once", () => {
    const offer = clone();
    offer.itineraries[1].segments[0].carrierCode = "U8";
    expect(offerToItineraryFlight(offer, "1", 2, CARRIERS)!.price).toBe(1234.5 + 45 * 2);

    offer.itineraries[2].segments[0].carrierCode = "6H";
    expect(offerToItineraryFlight(offer, "1", 2, CARRIERS)!.price).toBe(1234.5 + 45 * 2);
  });

  it("validated by 6H / IZ / U8 -> +45 per adult, like the live route", () => {
    for (const code of ["6H", "IZ", "U8"]) {
      const offer = clone();
      offer.validatingAirlineCodes = [code];
      expect(offerToItineraryFlight(offer, "1", 3, CARRIERS)!.price).toBe(1234.5 + 45 * 3);
    }
  });

  it("HR operated by BZ -> Bluebird, +45 per adult; HR operated by LY -> El Al, no extra", () => {
    const bz = clone();
    bz.validatingAirlineCodes = ["HR"];
    bz.itineraries[0].segments[0].operating = { carrierCode: "BZ" };
    const b = offerToItineraryFlight(bz, "1", 2, CARRIERS)!;
    expect(b.price).toBe(1234.5 + 90);
    expect(b.metadata).toMatchObject({ iata: "HR", name: "Bluebird Airways" });
    expect(b.metadata.logo).toContain("Bluebird");

    const ly = clone();
    ly.validatingAirlineCodes = ["HR"];
    ly.itineraries[0].segments[0].operating = { carrierCode: "LY" };
    const e = offerToItineraryFlight(ly, "1", 2, CARRIERS)!;
    expect(e.price).toBe(1234.5);
    expect(e.metadata.name).toBe("El Al");
  });

  it("Bluebird because of a LATER itinerary: the disclosure agrees with the brand", () => {
    const offer = clone();
    offer.validatingAirlineCodes = ["HR"];
    offer.itineraries[0].segments[0].operating = { carrierCode: "LY" };
    offer.itineraries[1].segments[0].operating = { carrierCode: "BZ" };
    const f = offerToItineraryFlight(offer, "1", 2, CARRIERS)!;
    expect(f.metadata.name).toBe("Bluebird Airways");
    expect(f.price).toBe(1234.5 + 90);
    // BZ is the card's carrier: its own leg needs no disclosure, the LY leg does.
    expect(f.legs[1].operatedBy).toBeUndefined();
    expect(f.legs[0].operatedBy).toEqual(expect.stringContaining("El Al"));
  });

  it("LUFTHANSA gets its logo, any other carrier keeps aircodes'", () => {
    const lh = clone();
    lh.validatingAirlineCodes = ["LH"];
    expect(offerToItineraryFlight(lh, "1", 2, { LH: "LUFTHANSA" })!.metadata.logo).toBe(
      "https://www.avcodes.co.uk/images/logos/DLH.png",
    );
    const other = offerToItineraryFlight(clone(), "1", 2, CARRIERS)!;
    expect(other.metadata.logo).toBe("https://www.avcodes.co.uk/images/logos/ELY.png");
  });

  it("no extra for the other carriers", () => {
    const offer = clone();
    offer.validatingAirlineCodes = ["AF"];
    expect(offerToItineraryFlight(offer, "1", 2, CARRIERS)!.price).toBe(1234.5);
  });

  it("discloses a leg flown by someone else, and only that leg", () => {
    const offer = clone();
    offer.itineraries[1].segments[0].operating = { carrierCode: "AF" };
    const f = offerToItineraryFlight(offer, "1", 2, CARRIERS)!;
    expect(f.legs.map((l) => l.operatedBy)).toEqual([undefined, "Air France", undefined]);
  });

  it("a carrier missing from aircodes does not throw and still yields a full Airline", () => {
    const offer = clone();
    offer.validatingAirlineCodes = ["W6"];
    const f = offerToItineraryFlight(offer, "1", 2, { W6: "WIZZ AIR" })!;
    expect(f.metadata).toEqual({ iata: "W6", country: "", logo: "", name: "WIZZ AIR" });
    expect(f.legs[0].flightNumber).toBe("W6331");
  });

  it("gives up on an offer it cannot read", () => {
    const noSegments = clone();
    noSegments.itineraries[1].segments = [];
    expect(offerToItineraryFlight(noSegments, "1", 2, CARRIERS)).toBeNull();

    const noPrice = clone();
    noPrice.price.grandTotal = "n/a";
    expect(offerToItineraryFlight(noPrice, "1", 2, CARRIERS)).toBeNull();

    const noTravelers = clone();
    noTravelers.travelerPricings = [];
    expect(offerToItineraryFlight(noTravelers, "1", 2, CARRIERS)).toBeNull();
  });
});

describe("validateFlightRequest", () => {
  /** Why the body is refused, or null when it passes. */
  const refusal = (body: unknown, today: string): string | null => {
    const r = validateFlightRequest(body, today);
    return r.ok ? null : r.error;
  };

  const TODAY = "2027-05-01";
  const leg = (from: string, to: string, date: string) => ({ from, to, date });
  const valid = () => ({
    legs: [leg("TLV", "PAR", "2027-05-11"), leg("PAR", "LON", "2027-05-13"), leg("LON", "TLV", "2027-05-16")],
    adults: 2,
  });

  it("a valid 3-leg body -> null", () => {
    expect(refusal(valid(), TODAY)).toBeNull();
    expect(refusal({ ...valid(), nonStop: true }, TODAY)).toBeNull();
  });

  it("2 and 4 legs are the edges", () => {
    expect(refusal({ ...valid(), legs: valid().legs.slice(0, 2) }, TODAY)).toBeNull();
    const four = [...valid().legs, leg("TLV", "ROM", "2027-05-20")];
    expect(refusal({ ...valid(), legs: four }, TODAY)).toBeNull();
  });

  it("1 leg is a move searched alone; none -> error", () => {
    expect(validateFlightRequest({ ...valid(), legs: valid().legs.slice(0, 1) }, TODAY).ok).toBe(true);
    expect(refusal({ ...valid(), legs: [] }, TODAY)).toEqual(expect.any(String));
  });

  it("5 legs -> error", () => {
    const five = [...valid().legs, leg("TLV", "ROM", "2027-05-20"), leg("ROM", "TLV", "2027-05-21")];
    expect(refusal({ ...valid(), legs: five }, TODAY)).toEqual(expect.any(String));
  });

  it("adults 0 / 10 / 1.5 / missing -> error; 1 and 9 pass", () => {
    for (const adults of [0, 10, 1.5, "2", undefined]) {
      expect(refusal({ ...valid(), adults }, TODAY)).toEqual(expect.any(String));
    }
    expect(refusal({ ...valid(), adults: 1 }, TODAY)).toBeNull();
    expect(refusal({ ...valid(), adults: 9 }, TODAY)).toBeNull();
  });

  it("a lowercase / wrong-length code -> error", () => {
    for (const bad of ["tlv", "TL", "TLVX", "T1V", ""]) {
      const body = valid();
      body.legs[0].from = bad;
      expect(refusal(body, TODAY)).toEqual(expect.any(String));
    }
    const body = valid();
    body.legs[1].to = "lon";
    expect(refusal(body, TODAY)).toEqual(expect.any(String));
  });

  it("a leg that goes nowhere -> error", () => {
    const body = valid();
    body.legs[1].to = body.legs[1].from;
    expect(refusal(body, TODAY)).toEqual(expect.any(String));
  });

  it("a date before tomorrow -> error; tomorrow itself passes", () => {
    const today = valid();
    today.legs[0].date = TODAY;
    expect(refusal(today, TODAY)).toEqual(expect.any(String));

    const past = valid();
    past.legs[0].date = "2027-04-01";
    expect(refusal(past, TODAY)).toEqual(expect.any(String));

    const tomorrow = valid();
    tomorrow.legs[0].date = "2027-05-02";
    expect(refusal(tomorrow, TODAY)).toBeNull();
  });

  it("tomorrow is counted across a month end", () => {
    const body = valid();
    body.legs[0].date = "2027-05-01";
    expect(refusal(body, "2027-04-30")).toBeNull();
    expect(refusal(body, "2027-05-01")).toEqual(expect.any(String));
  });

  it("a malformed or impossible date -> error", () => {
    for (const bad of ["2027-5-11", "11/05/2027", "2027-02-30", "2027-13-01", "", "2027-05-11T10:00"]) {
      const body = valid();
      body.legs[0].date = bad;
      expect(refusal(body, TODAY)).toEqual(expect.any(String));
    }
  });

  it("decreasing dates -> error; the same day twice is fine", () => {
    const back = valid();
    back.legs[1].date = "2027-05-10";
    expect(refusal(back, TODAY)).toEqual(expect.any(String));

    const sameDay = valid();
    sameDay.legs[1].date = sameDay.legs[0].date;
    expect(refusal(sameDay, TODAY)).toBeNull();
  });

  it("not an object / no legs / non-boolean nonStop -> error", () => {
    for (const body of [null, undefined, "x", 5, [], {}, { adults: 2 }, { legs: "TLV", adults: 2 }]) {
      expect(refusal(body, TODAY)).toEqual(expect.any(String));
    }
    expect(refusal({ ...valid(), nonStop: "yes" }, TODAY)).toEqual(expect.any(String));
  });

  it("a leg that is not an object -> error", () => {
    expect(refusal({ ...valid(), legs: [null, "TLV"] }, TODAY)).toEqual(expect.any(String));
  });

  it("answers the parsed request: legs cut to from / to / date, nonStop defaulting to false", () => {
    const body = {
      legs: [
        { from: "TLV", to: "PAR", date: "2027-05-11", note: "x" },
        { from: "PAR", to: "TLV", date: "2027-05-13" },
      ],
      adults: 3,
      extra: true,
    };
    expect(validateFlightRequest(body, TODAY)).toEqual({
      ok: true,
      request: {
        legs: [
          { from: "TLV", to: "PAR", date: "2027-05-11" },
          { from: "PAR", to: "TLV", date: "2027-05-13" },
        ],
        adults: 3,
        nonStop: false,
      },
    });
    const parsed = validateFlightRequest({ ...body, nonStop: true }, TODAY);
    expect(parsed.ok && parsed.request.nonStop).toBe(true);
    expect(JSON.stringify(parsed)).not.toContain("note");
  });

  it("answers the reason when it refuses", () => {
    expect(validateFlightRequest({ ...valid(), adults: 0 }, TODAY)).toEqual({
      ok: false,
      error: expect.stringContaining("adults"),
    });
  });
});

describe("itineraryFlightsFromOffers", () => {
  it("keeps good offers cheapest first, with ids over the kept ones", () => {
    const dear = clone();
    dear.price.grandTotal = "2000.00";
    const cheap = clone();
    cheap.price.grandTotal = "900.00";
    const r = itineraryFlightsFromOffers([dear, cheap], 3, 2, CARRIERS);
    expect(r.flights.map((f) => f.price)).toEqual([900, 2000]);
    expect(r.flights.map((f) => f.id).sort()).toEqual(["1", "2"]);
    expect(r.failed).toBe(0);
  });

  it("a malformed offer is skipped and counted, the others survive", () => {
    const broken = clone();
    delete (broken.itineraries[1].segments[0] as { arrival?: unknown }).arrival;
    const broken2 = clone();
    (broken2.itineraries[0].segments[0] as { departure?: unknown }).departure = undefined;
    const r = itineraryFlightsFromOffers([broken, clone(), null as unknown as Offer, broken2], 3, 2, CARRIERS);
    expect(r.flights).toHaveLength(1);
    expect(r.failed).toBe(3);
    expect(r.firstError).toBeInstanceOf(Error);
  });

  it("an offer for another number of legs is skipped quietly; a rule-breaking one too", () => {
    const twoLegs = clone();
    twoLegs.itineraries = twoLegs.itineraries.slice(0, 2);
    const longLayover = connect(clone(), 2, [6]);
    const r = itineraryFlightsFromOffers([twoLegs, longLayover, clone()], 3, 2, CARRIERS);
    expect(r.flights).toHaveLength(1);
    expect(r.failed).toBe(0);
  });

  it("no offers -> nothing", () => {
    expect(itineraryFlightsFromOffers([], 3, 2)).toEqual({ flights: [], failed: 0, firstError: undefined });
  });
});

describe("Amadeus error tests", () => {
  const withErrors = (errors: unknown, statusCode?: number) => ({
    response: { statusCode, result: { errors } },
  });

  it("system error: 500 / 141 / SYSTEM ERROR HAS OCCURRED only", () => {
    const sys = { status: 500, code: 141, title: "SYSTEM ERROR HAS OCCURRED" };
    expect(isAmadeusSystemError(withErrors([sys], 500))).toBe(true);
    expect(isAmadeusSystemError(withErrors([{ status: 400 }, sys]))).toBe(true);
    expect(isAmadeusSystemError(withErrors([{ ...sys, code: 38189 }]))).toBe(false);
    expect(isAmadeusSystemError(withErrors([{ ...sys, status: 400 }]))).toBe(false);
    expect(isAmadeusSystemError(withErrors([{ ...sys, title: "INVALID DATE" }]))).toBe(false);
  });

  it("rate limit: HTTP 429, or a 429 inside the errors", () => {
    expect(isAmadeusRateLimited(withErrors(undefined, 429))).toBe(true);
    expect(isAmadeusRateLimited(withErrors([{ status: 429, code: 38194 }], 429))).toBe(true);
    expect(isAmadeusRateLimited(withErrors([{ status: 429 }]))).toBe(true);
    expect(isAmadeusRateLimited(withErrors([{ status: 500 }], 500))).toBe(false);
  });

  it("anything that is not an Amadeus error is neither", () => {
    for (const e of [null, undefined, "boom", new Error("x"), {}, withErrors("nope"), withErrors(null)]) {
      expect(isAmadeusSystemError(e)).toBe(false);
      expect(isAmadeusRateLimited(e)).toBe(false);
    }
  });
});
