import { describe, expect, it } from "vitest";
import type { Event, FlightSegment, ItineraryFlight, OrderHotel } from "../app.types";
import { MAIN_PART, composeFlight, flightPartsOf, partDone, pickFits } from "../itinerary/flightParts";
import { checkPieces, eventParts, submissionFromState } from "../itinerary/confirm";
import { canContinue, livePrice, progressivePrice } from "../itinerary/progress";
import { DEFAULT_ITINERARY_SETTINGS } from "../itinerary/settings";
import { INITIAL_ITINERARY_STATE, itineraryReducer, type ItineraryState } from "../itinerary/state";
import { skippedStayPerTraveller } from "../itinerary/stayAdapter";
import { stays } from "../itinerary/dates";

type City = { latitude: number; longitude: number; name: string; city_iata: string };
const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז, צרפת", city_iata: "PAR" };
const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון, בריטניה", city_iata: "LON" };

const ev = (id: number, name: string, date: string, city: City, over: Record<string, unknown> = {}) =>
  ({
    id,
    name,
    date: `${date}T20:00:00`,
    type: "music_event",
    location: { ...city, country_code: "XX" },
    def_date_depart: "2027-05-10",
    def_date_return: "2027-05-14",
    base_hotel_price: 400,
    base_flight_price: 600,
    tickets_and_rates: [{ id: "t", category: "A", price: 200, available: true, description: "", colorOnTheMap: "" }],
    ...over,
  }) as unknown as Event;

const celine = ev(618, "סלין דיון", "2027-05-12", PARIS);
const chelsea = ev(702, "צ'לסי - אברטון", "2027-05-15", LONDON);
const S = DEFAULT_ITINERARY_SETTINGS;

const seg = (from: string, to: string, day: string, hour = "09:00"): FlightSegment => ({
  departureAirport: from,
  arrivalAirport: to,
  departureTime: `${day}T${hour}:00`,
  arrivalTime: `${day}T14:00:00`,
  duration: "PT4H",
  stops: [],
  checkBagsIncluded: false,
  cabinBagsIncluded: false,
});

const offer = (id: string, price: number, legs: FlightSegment[], pax = 2): ItineraryFlight =>
  ({
    id,
    price,
    numOfTravelers: pax,
    airline: "LY",
    legs,
    outbound: legs[0],
    inbound: legs[legs.length - 1],
    trainLegs: [],
    metadata: { name: "EL AL", iata: "LY", country: "", logo: "" },
  }) as unknown as ItineraryFlight;

const reduce = (s: ItineraryState, a: Parameters<typeof itineraryReducer>[1]) => itineraryReducer(s, a);
const load = (route: Event[]): ItineraryState => reduce(INITIAL_ITINERARY_STATE, { type: "load", route, mode: "custom" });

const trip = () => load([celine, chelsea]);
const main = () => offer("m1", 1000, [seg("TLV", "PAR", "2027-05-11"), seg("LON", "TLV", "2027-05-16")]);
const mid = () => offer("x1", 300, [seg("PAR", "LON", "2027-05-13")]);

describe("flightPartsOf", () => {
  it("cuts a trip into the way there and back and one part per move", () => {
    const s = trip();
    expect(flightPartsOf(s.route, s.dates, new Set())).toEqual([
      {
        key: MAIN_PART,
        kind: "main",
        byTrain: false,
        legs: [
          { from: "TLV", to: "PAR", date: "2027-05-11" },
          { from: "LON", to: "TLV", date: "2027-05-16" },
        ],
      },
      { key: "618>702", kind: "move", byTrain: false, legs: [{ from: "PAR", to: "LON", date: "2027-05-13" }] },
    ]);
  });

  it("has no move part under one flight city", () => {
    const manchester = ev(704, "אואזיס", "2027-05-17", LONDON, {
      event_location: { latitude: 53.48, longitude: -2.24, name: "מנצ'סטר" },
      lodging_mode: "event_city_only",
    });
    const s = load([chelsea, manchester]);
    expect(flightPartsOf(s.route, s.dates, new Set()).map((p) => p.key)).toEqual([MAIN_PART]);
  });

  it("a move made alone stays a part, marked, and is done with no flight", () => {
    const s = trip();
    const [, move] = flightPartsOf(s.route, s.dates, new Set(["618>702"]));
    expect(move.byTrain).toBe(true);
    expect(partDone(move, {}, 2)).toBe(true);
  });
});

describe("pickFits", () => {
  const s = trip();
  const [mainPart, movePart] = flightPartsOf(s.route, s.dates, new Set());

  it("is for the party, a flight per leg, each on its day", () => {
    expect(pickFits(mainPart, main(), 2)).toBe(true);
    expect(pickFits(movePart, mid(), 2)).toBe(true);
    expect(pickFits(mainPart, main(), 3)).toBe(false);
    expect(pickFits(mainPart, mid(), 2)).toBe(false);
    expect(pickFits(movePart, offer("x", 300, [seg("PAR", "LON", "2027-05-14")]), 2)).toBe(false);
    expect(pickFits(movePart, undefined, 2)).toBe(false);
  });
});

describe("composeFlight", () => {
  it("is null until every flown part has its pick", () => {
    const s = trip();
    expect(composeFlight(s.route, s.dates, new Set(), 2, { [MAIN_PART]: main() })).toBeNull();
  });

  it("puts the legs in trip order, adds the prices, keeps the move's own offer", () => {
    const s = trip();
    const f = composeFlight(s.route, s.dates, new Set(), 2, { [MAIN_PART]: main(), "618>702": mid() });
    expect(f?.price).toBe(1300);
    expect(f?.legs.map((l) => l.departureAirport)).toEqual(["TLV", "PAR", "LON"]);
    expect(f?.outbound.departureAirport).toBe("TLV");
    expect(f?.inbound.departureAirport).toBe("LON");
    expect(f?.moveFlights?.map((x) => x.id)).toEqual(["x1"]);
  });

  it("leaves out a move made alone and names it as a train leg", () => {
    const s = trip();
    const f = composeFlight(s.route, s.dates, new Set(["618>702"]), 2, { [MAIN_PART]: main(), "618>702": mid() });
    expect(f?.price).toBe(1000);
    expect(f?.legs).toHaveLength(2);
    expect(f?.moveFlights).toBeUndefined();
    expect(f?.trainLegs).toEqual([{ from: "פריז", to: "לונדון", date: "2027-05-13" }]);
  });
});

describe("the reducer's parts", () => {
  it("composes the trip's flight from them", () => {
    let s = reduce(trip(), { type: "setFlightPart", key: MAIN_PART, flight: main() });
    expect(s.flight).toBeNull();
    s = reduce(s, { type: "setFlightPart", key: "618>702", flight: mid() });
    expect(s.flight?.price).toBe(1300);
    s = reduce(s, { type: "setFlightPart", key: "618>702", flight: null });
    expect(s.flight).toBeNull();
    expect(s.flightParts[MAIN_PART]?.id).toBe("m1");
  });

  it("a change of dates keeps the parts it does not touch", () => {
    let s = reduce(trip(), { type: "setFlightPart", key: MAIN_PART, flight: main() });
    s = reduce(s, { type: "setFlightPart", key: "618>702", flight: mid() });
    s = reduce(s, { type: "setDates", dates: { ...s.dates, moves: { "618>702": "2027-05-14" } } });
    expect(s.flightParts[MAIN_PART]?.id).toBe("m1");
    expect(s.flightParts["618>702"]).toBeUndefined();
    expect(s.flight).toBeNull();
  });

  it("the train switch needs no new search: the way there and back stays", () => {
    let s = reduce(trip(), { type: "setFlightPart", key: MAIN_PART, flight: main() });
    expect(s.flight).toBeNull();
    s = reduce(s, { type: "toggleTrain", key: "618>702" });
    expect(s.flight?.price).toBe(1000);
    s = reduce(s, { type: "toggleTrain", key: "618>702" });
    expect(s.flight).toBeNull();
  });

  it("a new party clears every part", () => {
    let s = reduce(trip(), { type: "setFlightPart", key: MAIN_PART, flight: main() });
    s = reduce(s, { type: "setPax", pax: 3 });
    expect(s.flightParts).toEqual({});
  });
});

describe('"לא צריך מלון"', () => {
  const hotel = (s: ItineraryState, key: string, checkin: string, checkout: string, price: number): OrderHotel =>
    ({
      id: `h${key}`,
      name: "מלון",
      price,
      guests: [{ adults: s.pax, children: [] }],
      checkin,
      checkout,
      rate: {},
    }) as unknown as OrderHotel;

  const full = (): ItineraryState => {
    let s = reduce(trip(), { type: "setFlightPart", key: MAIN_PART, flight: main() });
    s = reduce(s, { type: "setFlightPart", key: "618>702", flight: mid() });
    s = reduce(s, { type: "setTicket", eventId: 618, ticket: { id: "t", category: "A", price: 200, quantity: 2, description: "" } });
    s = reduce(s, { type: "setTicket", eventId: 702, ticket: { id: "t", category: "A", price: 200, quantity: 2, description: "" } });
    s = reduce(s, { type: "setHotel", stayKey: "618", hotel: hotel(s, "618", "2027-05-11", "2027-05-13", 1600) });
    return reduce(s, { type: "setHotel", stayKey: "702", hotel: hotel(s, "702", "2027-05-13", "2027-05-16", 1200) });
  };

  it("a stay with no hotel is settled, and the trip prices without it", () => {
    const before = livePrice(full(), S);
    const noHotel = reduce(reduce(full(), { type: "setHotel", stayKey: "702", hotel: undefined }), {
      type: "skipStay",
      stayKey: "702",
      skipped: true,
    });
    expect(canContinue(noHotel).hotels).toBe(true);
    const after = livePrice(noHotel, S);
    expect(after).not.toBeNull();
    expect(after?.total).toBeLessThan(before?.total ?? 0);
    expect(progressivePrice(noHotel, S).total).toBe(after?.total);
  });

  it("the server's side: no hotel is asked of the stay, none is sent, and the rows add up to the total", () => {
    const s = reduce(full(), { type: "skipStay", stayKey: "702", skipped: true });
    // Within the week before check-in: this test's rate has no free cancellation, and may be sold then.
    const now = new Date("2027-05-08");
    expect(checkPieces(s, now)).toBeNull();
    const price = livePrice(s, S);
    expect(Math.ceil(eventParts(s, S).reduce((a, b) => a + b, 0))).toBe(price?.total);
    const body = submissionFromState(s, { contact: { firstName: "", lastName: "", phone: "", email: "" }, others: [] }, "g", price!);
    expect(body.skippedStays).toEqual(["702"]);
    expect(Object.keys(body.hotels)).toEqual(["618"]);
    // Without the skip the same state lacks a hotel.
    const lacking = reduce(reduce(s, { type: "skipStay", stayKey: "702", skipped: false }), { type: "setHotel", stayKey: "702", hotel: undefined });
    expect(checkPieces(lacking, now)?.code).toBe("HOTEL_CHANGED");
  });

  it("taking it back brings the hotel back", () => {
    const s = reduce(full(), { type: "skipStay", stayKey: "702", skipped: true });
    expect(s.hotels["702"]?.id).toBe("h702");
    const back = reduce(s, { type: "skipStay", stayKey: "702", skipped: false });
    expect(back.skippedStays).toEqual([]);
    expect(livePrice(back, S)?.total).toBe(livePrice(full(), S)?.total);
  });

  it("ignores a stay the trip does not have", () => {
    const s = trip();
    expect(reduce(s, { type: "skipStay", stayKey: "1", skipped: true })).toBe(s);
    expect(stays(s.route, s.dates)).toHaveLength(2);
  });

  it("the fee: legacy by the flight base, waived when the stay's package hotel costs no more", () => {
    const range: [string, string] = ["2027-05-13", "2027-05-16"];
    expect(skippedStayPerTraveller(ev(1, "a", "2027-05-15", LONDON), range)).toBe(150); // base $300 for 3 nights
    expect(skippedStayPerTraveller(ev(2, "b", "2027-05-15", LONDON, { base_flight_price: 400 }), range)).toBe(100);
    expect(skippedStayPerTraveller(ev(3, "c", "2027-05-15", LONDON, { base_hotel_price: 100 }), range)).toBe(0);
  });

  it("the fee: composed pricing swaps the hotel markup for the event's own skip fee", () => {
    const e = ev(4, "d", "2027-05-15", LONDON, { markup_hotel: 80, markup_ticket: 50, markup_flight: 40, skip_hotel_markup: 120 });
    expect(skippedStayPerTraveller(e, ["2027-05-13", "2027-05-16"])).toBe(40);
  });
});
