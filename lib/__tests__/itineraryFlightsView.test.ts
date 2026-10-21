import { describe, expect, it } from "vitest";
import type { FlightSegment, ItineraryFlight } from "../app.types";
import type { TrainLeg, TripLeg } from "../itinerary/types";
import { validateFlightRequest, type FlightLeg } from "../itinerary/flightOffers";
import {
  FLIGHTS_PAGE,
  INCLUDED_BAND_USD,
  TRAIN_HINT_KM,
  basePerTraveller,
  canSearch,
  cardRows,
  cheapestFlight,
  isIsraeliFlight,
  pickBestFlight,
  priceBadge,
  pricedFlight,
  searchKey,
  searchOutcome,
  searchView,
  sortFlights,
  trainCallout,
  trainHours,
  trainRowText,
  trainToggleLabel,
} from "../itinerary/flightsView";

/** One leg as the flights API returns it: `stops` has one entry per segment. */
const seg = (from: string, to: string, over: Partial<FlightSegment> = {}): FlightSegment => ({
  departureTime: "2027-05-11T06:00:00",
  arrivalTime: "2027-05-11T09:30:00",
  departureAirport: from,
  arrivalAirport: to,
  stops: [{ iataCode: to, duration: null }],
  duration: "PT4H30M",
  checkBagsIncluded: true,
  cabinBagsIncluded: true,
  ...over,
});

/** A stop: two segments, the first with a layover. */
const oneStop = (via: string, to: string) => [
  { iataCode: via, duration: 2 },
  { iataCode: to, duration: null },
];

type Carriers = { validating: string; operating: string[][] };

/** A flight with the carriers its offer names: one inner array per itinerary, one code per segment. */
const flight = (
  id: string,
  price: number,
  legs: FlightSegment[],
  carriers: Carriers = { validating: "AF", operating: legs.map(() => ["AF"]) },
): ItineraryFlight =>
  ({
    id,
    price,
    airline: carriers.validating,
    legs,
    outbound: legs[0],
    inbound: legs[legs.length - 1],
    trainLegs: [],
    numOfTravelers: 2,
    stops: legs[0].stops.length - 1,
    duration: legs[0].duration,
    metadata: { iata: carriers.validating, name: carriers.validating, logo: "", country: "" },
    offer: {
      validatingAirlineCodes: [carriers.validating],
      itineraries: carriers.operating.map((codes) => ({
        segments: codes.map((code, i) => ({
          id: `${id}-${i}`,
          carrierCode: code,
          // Amadeus leaves `operating` out when it is the marketing carrier.
          ...(i % 2 === 1 ? { operating: { carrierCode: code } } : {}),
        })),
      })),
    },
  }) as unknown as ItineraryFlight;

const three = [seg("TLV", "CDG"), seg("CDG", "LHR"), seg("LHR", "TLV")];

describe("constants", () => {
  it("are the brief's numbers", () => {
    expect(FLIGHTS_PAGE).toBe(20);
    expect(TRAIN_HINT_KM).toBe(600);
    expect(INCLUDED_BAND_USD).toBe(4);
  });
});

describe("train copy", () => {
  it("hours = km / 170 + 0.5, one decimal", () => {
    expect(trainHours(343)).toBe("2.5");
    expect(trainHours(357)).toBe("2.6");
    expect(trainHours(0)).toBe("0.5");
  });

  it("the toggle names the distance", () => {
    expect(trainToggleLabel(343)).toBe("אגיע ברכבת (343 ק״מ)");
    expect(trainToggleLabel(1000)).toBe("אגיע ברכבת (1,000 ק״מ)");
  });

  it("the train row: A ← B ברכבת, then day, hours and that it is not included", () => {
    const t: TrainLeg = { key: "618>702", fromName: "פריז", toName: "לונדון", date: "2027-05-13", km: 343 };
    expect(trainRowText(t)).toEqual({
      title: "פריז ← לונדון ברכבת",
      detail: "13/05 · כ-2.5 שעות · בכוחות עצמכם, לא כלול",
    });
  });
});

describe("trainCallout", () => {
  const paris = { fromName: "פריז", toName: "לונדון", km: 343 };

  it("suggests the train on a hop under 600 km, verbatim", () => {
    expect(trainCallout([paris])).toEqual({
      lead: "טיסה אחת לכל המסלול.",
      text: "פריז–לונדון זה 343 ק״מ - ברכבת כ-2.5 שעות ממרכז העיר למרכז העיר. מעדיפים רכבת? כבו את קטע הביניים.",
    });
  });

  it("says nothing at 600 km or more, or with no hop", () => {
    expect(trainCallout([{ ...paris, km: 600 }])).toBeNull();
    expect(trainCallout([{ ...paris, km: 950 }])).toBeNull();
    expect(trainCallout([])).toBeNull();
  });

  it("names every short hop, and only those", () => {
    const callout = trainCallout([
      paris,
      { fromName: "לונדון", toName: "מדריד", km: 1260 },
      { fromName: "מדריד", toName: "ברצלונה", km: 505 },
    ]);
    expect(callout?.text).toBe(
      "פריז–לונדון זה 343 ק״מ - ברכבת כ-2.5 שעות ממרכז העיר למרכז העיר. " +
        "מדריד–ברצלונה זה 505 ק״מ - ברכבת כ-3.5 שעות ממרכז העיר למרכז העיר. " +
        "מעדיפים רכבת? כבו את קטע הביניים.",
    );
  });
});

describe("isIsraeliFlight", () => {
  it("is true when every carrier, validating and operating, is LY / IZ / 6H", () => {
    expect(isIsraeliFlight(flight("1", 900, three, { validating: "LY", operating: [["LY"], ["LY"], ["LY"]] }))).toBe(true);
    expect(isIsraeliFlight(flight("2", 900, three, { validating: "IZ", operating: [["IZ"], ["6H", "6H"], ["IZ"]] }))).toBe(true);
  });

  it("is false when one segment is flown by someone else (a codeshare)", () => {
    expect(isIsraeliFlight(flight("1", 900, three, { validating: "LY", operating: [["LY"], ["AF"], ["LY"]] }))).toBe(false);
    expect(isIsraeliFlight(flight("2", 900, three, { validating: "LY", operating: [["LY"], ["LY", "BA"], ["LY"]] }))).toBe(false);
  });

  it("is false when the ticket is not Israeli even on Israeli metal", () => {
    expect(isIsraeliFlight(flight("1", 900, three, { validating: "AF", operating: [["LY"], ["LY"], ["LY"]] }))).toBe(false);
    expect(isIsraeliFlight(flight("2", 900, three, { validating: "HR", operating: [["BZ"], ["BZ"], ["BZ"]] }))).toBe(false);
  });

  it("falls back to the airline when the offer has no itineraries", () => {
    const f = { ...flight("1", 900, three, { validating: "LY", operating: [] }), offer: {} } as unknown as ItineraryFlight;
    expect(isIsraeliFlight(f)).toBe(true);
    expect(isIsraeliFlight({ ...f, airline: "AF" })).toBe(false);
  });
});

describe("best, cheapest, sort", () => {
  const direct = flight("d", 1200, three);
  const cheapStop = flight("s", 900, [seg("TLV", "CDG", { stops: oneStop("ATH", "CDG") }), three[1], three[2]]);
  const directLong = flight("dl", 1200, [seg("TLV", "CDG", { duration: "PT6H" }), three[1], three[2]]);
  const israeli = flight("ly", 1500, three, { validating: "LY", operating: [["LY"], ["LY"], ["LY"]] });
  const list = [cheapStop, directLong, israeli, direct];

  it("best = fewest stops over all legs, then cheapest, then shortest", () => {
    expect(pickBestFlight(list)?.id).toBe("d");
    expect(pickBestFlight([cheapStop])?.id).toBe("s");
    expect(pickBestFlight([])).toBeUndefined();
  });

  it("cheapest = the lowest price", () => {
    expect(cheapestFlight(list)?.id).toBe("s");
    expect(cheapestFlight([])).toBeUndefined();
  });

  it("הטוב ביותר: the best first, the rest cheapest first", () => {
    expect(sortFlights(list, "best").map((f) => f.id)).toEqual(["d", "s", "dl", "ly"]);
  });

  it("הזול ביותר: cheapest first", () => {
    expect(sortFlights(list, "cheapest").map((f) => f.id)).toEqual(["s", "dl", "d", "ly"]);
  });

  it("ישראלי: only the Israeli flights, cheapest first", () => {
    const ly2 = flight("ly2", 1300, three, { validating: "6H", operating: [["6H"], ["6H"], ["6H"]] });
    expect(sortFlights([...list, ly2], "israeli").map((f) => f.id)).toEqual(["ly2", "ly"]);
    expect(sortFlights([cheapStop, direct], "israeli")).toEqual([]);
  });

  it("never reorders the list it is given", () => {
    const input = [...list];
    sortFlights(input, "cheapest");
    sortFlights(input, "best");
    expect(input).toEqual(list);
  });

  it("the base price is the default sort's first offer, per traveller", () => {
    expect(basePerTraveller(list, 2)).toBe(600);
    expect(basePerTraveller([], 2)).toBeNull();
  });
});

describe("priceBadge", () => {
  it("is included within $4 a traveller of the base", () => {
    expect(priceBadge(1200, 2, 600)).toEqual({ kind: "included" });
    expect(priceBadge(1208, 2, 600)).toEqual({ kind: "included" });
    expect(priceBadge(1192, 2, 600)).toEqual({ kind: "included" });
  });

  it("is a saving a traveller below the base", () => {
    expect(priceBadge(900, 2, 600)).toEqual({ kind: "less", usd: 150 });
  });

  it("is a supplement a traveller above the base, rounded up per traveller", () => {
    expect(priceBadge(1500, 2, 600)).toEqual({ kind: "more", usd: 150 });
    expect(priceBadge(1265, 2, 600)).toEqual({ kind: "more", usd: 33 });
  });
});

describe("cardRows", () => {
  const all: TripLeg[] = [
    { kind: "out", from: "TLV", to: "PAR", date: "2027-05-11" },
    { kind: "mid", from: "PAR", to: "LON", date: "2027-05-13", key: "618>702", km: 343 },
    { kind: "ret", from: "LON", to: "TLV", date: "2027-05-16" },
  ];

  it("every leg flown: one flight row per leg, in order, with its leg of the trip", () => {
    const rows = cardRows(all, three, new Set());
    expect(rows.map((r) => r.kind)).toEqual(["flight", "flight", "flight"]);
    expect(rows[1]).toEqual({ kind: "flight", leg: three[1], trip: all[1] });
  });

  it("a move by train: the train row takes the flight's place, the flights stay in order", () => {
    const openJaw = [three[0], three[2]];
    const rows = cardRows(all, openJaw, new Set(["618>702"]));
    expect(rows).toEqual([
      { kind: "flight", leg: three[0], trip: all[0] },
      { kind: "train", key: "618>702" },
      { kind: "flight", leg: three[2], trip: all[2] },
    ]);
  });

  it("a flight that does not match the trip's legs is shown as it is, without trip legs", () => {
    const rows = cardRows(all, [three[0], three[2]], new Set());
    expect(rows).toEqual([
      { kind: "flight", leg: three[0] },
      { kind: "flight", leg: three[2] },
    ]);
  });
});

describe("canSearch", () => {
  const today = "2027-05-01";
  const legs: FlightLeg[] = [
    { from: "TLV", to: "PAR", date: "2027-05-11" },
    { from: "PAR", to: "LON", date: "2027-05-13" },
    { from: "LON", to: "TLV", date: "2027-05-16" },
  ];

  const cases: { name: string; legs: FlightLeg[]; adults: number }[] = [
    { name: "a valid trip", legs, adults: 2 },
    { name: "an open jaw", legs: [legs[0], legs[2]], adults: 9 },
    { name: "one leg", legs: [legs[0]], adults: 2 },
    { name: "five legs", legs: [...legs, legs[2], legs[2]], adults: 2 },
    { name: "no adults", legs, adults: 0 },
    { name: "ten adults", legs, adults: 10 },
    { name: "a date that is not a day", legs: [{ ...legs[0], date: "" }, legs[1], legs[2]], adults: 2 },
    { name: "an impossible day", legs: [{ ...legs[0], date: "2027-02-30" }, legs[1], legs[2]], adults: 2 },
    { name: "today", legs: [{ ...legs[0], date: today }, legs[1], legs[2]], adults: 2 },
    { name: "tomorrow", legs: [{ ...legs[0], date: "2027-05-02" }, legs[1], legs[2]], adults: 2 },
    { name: "going back in time", legs: [legs[0], { ...legs[1], date: "2027-05-10" }, legs[2]], adults: 2 },
    { name: "a code that is not IATA", legs: [{ ...legs[0], to: "Paris" }, legs[1], legs[2]], adults: 2 },
    { name: "a leg to itself", legs: [legs[0], { ...legs[1], to: "PAR" }, legs[2]], adults: 2 },
  ];

  it.each(cases)("agrees with the API's own validation: $name", ({ legs: l, adults }) => {
    expect(canSearch(l, adults, today)).toBe(validateFlightRequest({ legs: l, adults }, today).ok);
  });

  it("accepts a trip and refuses a past day", () => {
    expect(canSearch(legs, 2, today)).toBe(true);
    expect(canSearch([{ ...legs[0], date: today }, legs[1], legs[2]], 2, today)).toBe(false);
  });
});

describe("searchKey", () => {
  const legs: FlightLeg[] = [
    { from: "TLV", to: "PAR", date: "2027-05-11" },
    { from: "LON", to: "TLV", date: "2027-05-16" },
  ];

  it("is the same for the same legs, party and filter, and differs otherwise", () => {
    expect(searchKey(legs, 2, false)).toBe(searchKey([...legs.map((l) => ({ ...l }))], 2, false));
    expect(searchKey(legs, 3, false)).not.toBe(searchKey(legs, 2, false));
    expect(searchKey(legs, 2, true)).not.toBe(searchKey(legs, 2, false));
    expect(searchKey([legs[0], { ...legs[1], date: "2027-05-17" }], 2, false)).not.toBe(searchKey(legs, 2, false));
  });
});

describe("searchOutcome / searchView", () => {
  const ok = flight("1", 900, three);

  it("200 with flights: ok; with none: empty", () => {
    expect(searchOutcome(200, { flights: [ok] })).toEqual({ kind: "ok", flights: [ok] });
    expect(searchOutcome(200, { flights: [] })).toEqual({ kind: "empty" });
  });

  it("drops an entry that is not a flight", () => {
    expect(searchOutcome(200, { flights: [ok, null, { id: "x" }] })).toEqual({ kind: "ok", flights: [ok] });
  });

  it("200 that cannot be read is an error", () => {
    expect(searchOutcome(200, null)).toEqual({ kind: "error" });
    expect(searchOutcome(200, { flights: "no" })).toEqual({ kind: "error" });
  });

  it("429 busy, 400 invalid, anything else an error", () => {
    expect(searchOutcome(429, { busy: true })).toEqual({ kind: "busy" });
    expect(searchOutcome(400, { error: "x" })).toEqual({ kind: "invalid" });
    expect(searchOutcome(502, { error: "x" })).toEqual({ kind: "error" });
    expect(searchOutcome(500, null)).toEqual({ kind: "error" });
    expect(searchOutcome(0, null)).toEqual({ kind: "error" });
  });

  it("busy retries once, then says busy", () => {
    expect(searchView({ kind: "busy" }, false)).toBe("retrying");
    expect(searchView({ kind: "busy" }, true)).toBe("busy");
    expect(searchView({ kind: "ok", flights: [ok] }, true)).toBe("ok");
    expect(searchView({ kind: "empty" }, false)).toBe("empty");
    expect(searchView({ kind: "invalid" }, false)).toBe("invalid");
    expect(searchView({ kind: "error" }, false)).toBe("error");
  });
});

describe("pricedFlight", () => {
  const f = flight("7", 900, [three[0], three[2]]);
  const trains: TrainLeg[] = [{ key: "618>702", fromName: "פריז", toName: "לונדון", date: "2027-05-13", km: 343 }];

  it("keeps the search's price, takes the fare's penalties and carries the train legs", () => {
    const priced = pricedFlight(f, 200, { bags: 65, penalties: "PE.PENALTIES ..." }, trains);
    expect(priced).toMatchObject({ id: "7", price: 900, penalties: "PE.PENALTIES ..." });
    expect(priced?.trainLegs).toEqual([{ from: "פריז", to: "לונדון", date: "2027-05-13" }]);
    // The bag line is a round-trip estimate - not carried onto a multi-city flight.
    expect(priced).not.toHaveProperty("bags");
  });

  it("no train legs: an empty list", () => {
    expect(pricedFlight(f, 200, { penalties: "x" }, [])?.trainLegs).toEqual([]);
  });

  it("an answer without penalties still prices", () => {
    expect(pricedFlight(f, 200, {}, [])).not.toHaveProperty("penalties");
  });

  it("a failed or unreadable answer is no price", () => {
    expect(pricedFlight(f, 500, { error: "x" }, [])).toBeNull();
    expect(pricedFlight(f, 200, null, [])).toBeNull();
    expect(pricedFlight(f, 0, null, [])).toBeNull();
  });
});
