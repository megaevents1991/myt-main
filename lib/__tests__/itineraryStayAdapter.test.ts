import { describe, expect, it } from "vitest";
import dayjs from "dayjs";
import type { Event, FlightSegment, ItineraryFlight, OrderHotel } from "../app.types";
import { defaultCity, lodgingLocation, offeredCities, splitOffered } from "../events/lodging";
import { getDefaultDateRange } from "../getDefaultDateRange";
import { defaultTripDates, stays } from "../itinerary/dates";
import {
  hotelOnStayDates,
  sameHotel,
  stayAdapterFields,
  stayEvent,
  stayFlight,
  stayHotelRange,
} from "../itinerary/stayAdapter";

type City = { latitude: number; longitude: number; name: string; city_iata: string };

const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז, צרפת", city_iata: "PAR" };
const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון, בריטניה", city_iata: "LON" };
const AMSTERDAM: City = { latitude: 52.37, longitude: 4.9, name: "אמסטרדם, הולנד", city_iata: "AMS" };
/** Another London venue (Wembley), ~12 km from LONDON: the same city. */
const WEMBLEY: City = { latitude: 51.556, longitude: -0.28, name: "לונדון, בריטניה", city_iata: "LON" };

const ev = (id: number, name: string, date: string, city: City, type = "music_event") =>
  ({
    id,
    name,
    date: `${date}T20:00:00`,
    type,
    // The event's stored defaults - never what a stay reads while it has a flight.
    def_date_depart: "2027-01-01",
    def_date_return: "2027-01-05",
    location: { ...city, country_code: "XX" },
  }) as unknown as Event;

/** Sold as a flight to London, played in Manchester. */
const manchesterMatch = (id: number, date: string, over: Record<string, unknown> = {}) =>
  ({
    id,
    name: "מנצ'סטר יונייטד - ליברפול",
    date: `${date}T17:30:00`,
    type: "sports_event",
    def_date_depart: "2027-01-01",
    def_date_return: "2027-01-05",
    location: { ...LONDON, country_code: "GB" },
    event_location: { latitude: 53.48, longitude: -2.24, name: "מנצ'סטר", city_iata: "MAN", country_code: "GB" },
    ...over,
  }) as unknown as Event;

const celine = ev(618, "סלין דיון", "2027-05-12", PARIS);
const chelsea = ev(702, "צ'לסי - אברטון", "2027-05-15", LONDON, "sports_event");
const ajax = ev(810, "אייאקס - פיינורד", "2027-05-20", AMSTERDAM, "sports_event");
const wembley = ev(703, "קונצרט בוומבלי", "2027-05-17", WEMBLEY);

const none: ReadonlySet<string> = new Set();

const seg = (from: string, to: string, departureTime: string, arrivalTime: string): FlightSegment => ({
  departureTime,
  arrivalTime,
  departureAirport: from,
  arrivalAirport: to,
  stops: [],
  duration: "PT3H",
  checkBagsIncluded: true,
  cabinBagsIncluded: true,
});

/** An offer as the flights step keeps it: one segment per flown leg, in trip order. */
const tripFlight = (legs: FlightSegment[]) =>
  ({
    id: "offer-1",
    airline: "LY",
    price: 900,
    duration: "",
    stops: 0,
    numOfTravelers: 2,
    outbound: legs[0],
    inbound: legs[legs.length - 1],
    legs,
    trainLegs: [],
  }) as unknown as ItineraryFlight;

// The task's fixture: TLV -> CDG lands 11/05 09:55, CDG -> LHR leaves 13/05 13:05, LHR -> TLV leaves 16/05 22:40.
const OUT = seg("TLV", "CDG", "2027-05-11T05:40:00", "2027-05-11T09:55:00");
const PAR_LON = seg("CDG", "LHR", "2027-05-13T13:05:00", "2027-05-13T13:25:00");
const RET = seg("LHR", "TLV", "2027-05-16T22:40:00", "2027-05-17T05:20:00");

/** The range the live hotel step opens on, as it formats it (HotelSelection's checkinStr / checkoutStr). */
const opens = (e: Event, f: ReturnType<typeof stayFlight>) =>
  getDefaultDateRange(e, f).map((d) => dayjs(d).format("YYYY-MM-DD"));

describe("stayEvent", () => {
  it("a flight-city stay offers one city and no split, and searches around the flight city", () => {
    const e = stayEvent(manchesterMatch(901, "2027-05-15", { lodging_mode: "choice_split" }), "flight");
    expect(offeredCities(e)).toEqual(["flight"]);
    expect(splitOffered(e)).toBe(false);
    expect(defaultCity(e)).toBe("flight");
    expect(lodgingLocation(e, "flight").name).toBe("לונדון, בריטניה");
  });

  it("an event-city stay offers that city alone (Manchester), with no split", () => {
    const e = stayEvent(manchesterMatch(901, "2027-05-15", { lodging_mode: "choice_split" }), "event");
    expect(offeredCities(e)).toEqual(["event"]);
    expect(splitOffered(e)).toBe(false);
    expect(defaultCity(e)).toBe("event");
    expect(lodgingLocation(e, "event").name).toBe("מנצ'סטר");
  });

  it("keeps the rest of the event as it is, and never changes the event it was given", () => {
    const e = stayEvent(celine, "flight");
    expect(e).toMatchObject({ id: 618, name: "סלין דיון", date: celine.date, location: celine.location });
    expect(e.lodging_mode).toBe("flight_city");
    expect(e.lodging_default).toBe("flight");
    expect(celine.lodging_mode).toBeUndefined();
  });
});

describe("stayFlight - the live date rule yields each stay's check-in / check-out", () => {
  const route = [celine, chelsea];
  const d = defaultTripDates(route);

  it("Paris -> London by air: each stay runs from the leg that lands in it to the leg that leaves it", () => {
    const flight = tripFlight([OUT, PAR_LON, RET]);
    const paris = stayFlight(0, flight, route, d, none);
    const london = stayFlight(1, flight, route, d, none);
    expect(paris.outbound).toBe(OUT);
    expect(paris.inbound).toBe(PAR_LON);
    expect(london.outbound).toBe(PAR_LON);
    expect(london.inbound).toBe(RET);
    expect(opens(stayEvent(celine, "flight"), paris)).toEqual(["2027-05-11", "2027-05-13"]);
    expect(opens(stayEvent(chelsea, "flight"), london)).toEqual(["2027-05-13", "2027-05-16"]);
  });

  it("the same move by train on 13/05: the same dates, from a ground segment at noon", () => {
    const train: ReadonlySet<string> = new Set(["618>702"]);
    const flight = tripFlight([OUT, RET]);
    const paris = stayFlight(0, flight, route, d, train);
    const london = stayFlight(1, flight, route, d, train);
    expect(paris.inbound).toEqual({
      departureTime: "2027-05-13T12:00:00",
      arrivalTime: "2027-05-13T12:00:00",
      departureAirport: "PAR",
      arrivalAirport: "LON",
      stops: [],
      duration: "0",
      checkBagsIncluded: false,
      cabinBagsIncluded: false,
    });
    expect(london.outbound).toEqual(paris.inbound);
    expect(london.inbound).toBe(RET);
    expect(opens(stayEvent(celine, "flight"), paris)).toEqual(["2027-05-11", "2027-05-13"]);
    expect(opens(stayEvent(chelsea, "flight"), london)).toEqual(["2027-05-13", "2027-05-16"]);
  });

  it("an outbound that lands at 06:30 checks in the evening before (the live early-landing rule)", () => {
    const early = seg("TLV", "CDG", "2027-05-11T01:00:00", "2027-05-11T06:30:00");
    const flight = tripFlight([early, PAR_LON, RET]);
    expect(opens(stayEvent(celine, "flight"), stayFlight(0, flight, route, d, none))).toEqual([
      "2027-05-10",
      "2027-05-13",
    ]);
  });

  it("hands the step a plain Flight: the trip's legs stay out of it", () => {
    const f = stayFlight(0, tripFlight([OUT, PAR_LON, RET]), route, d, none);
    expect("legs" in f).toBe(false);
    expect("trainLegs" in f).toBe(false);
    expect(f.id).toBe("offer-1");
  });

  it("a flight whose legs do not line up with the trip: the moves fall back to the trip's own days", () => {
    // Two legs for a trip that flies three - never hand a stay another move's flight.
    const flight = tripFlight([OUT, RET]);
    const paris = stayFlight(0, flight, route, d, none);
    const london = stayFlight(1, flight, route, d, none);
    expect(paris.inbound.departureTime).toBe("2027-05-13T12:00:00");
    expect(london.outbound.arrivalTime).toBe("2027-05-13T12:00:00");
    expect(opens(stayEvent(celine, "flight"), paris)).toEqual(["2027-05-11", "2027-05-13"]);
    expect(opens(stayEvent(chelsea, "flight"), london)).toEqual(["2027-05-13", "2027-05-16"]);
  });
});

describe("stayFlight - three stays, one move by train", () => {
  const route = [celine, chelsea, ajax];
  const d = defaultTripDates(route); // depart 11/05, moves 13/05 and 16/05, return 21/05
  const OUT_AMS = seg("AMS", "TLV", "2027-05-21T11:00:00", "2027-05-21T16:00:00");

  it("Paris -> London by train, London -> Amsterdam flown: the flown leg is the trip's SECOND, not stay 1's index", () => {
    const LON_AMS = seg("LHR", "AMS", "2027-05-16T09:10:00", "2027-05-16T11:30:00");
    const flight = tripFlight([OUT, LON_AMS, OUT_AMS]);
    const train: ReadonlySet<string> = new Set(["618>702"]);
    const [paris, london, amsterdam] = [0, 1, 2].map((i) => stayFlight(i, flight, route, d, train));
    expect(paris.inbound.departureTime).toBe("2027-05-13T12:00:00");
    expect(london.outbound.arrivalTime).toBe("2027-05-13T12:00:00");
    expect(london.inbound).toBe(LON_AMS);
    expect(amsterdam.outbound).toBe(LON_AMS);
    expect(amsterdam.inbound).toBe(OUT_AMS);
    expect(opens(stayEvent(celine, "flight"), paris)).toEqual(["2027-05-11", "2027-05-13"]);
    expect(opens(stayEvent(chelsea, "flight"), london)).toEqual(["2027-05-13", "2027-05-16"]);
    expect(opens(stayEvent(ajax, "flight"), amsterdam)).toEqual(["2027-05-16", "2027-05-21"]);
  });

  it("Paris -> London flown, London -> Amsterdam by train", () => {
    const flight = tripFlight([OUT, PAR_LON, OUT_AMS]);
    const train: ReadonlySet<string> = new Set(["702>810"]);
    const [paris, london, amsterdam] = [0, 1, 2].map((i) => stayFlight(i, flight, route, d, train));
    expect(paris.inbound).toBe(PAR_LON);
    expect(london.outbound).toBe(PAR_LON);
    expect(london.inbound).toMatchObject({ departureTime: "2027-05-16T12:00:00", departureAirport: "LON", arrivalAirport: "AMS" });
    expect(amsterdam.outbound).toEqual(london.inbound);
    expect(opens(stayEvent(chelsea, "flight"), london)).toEqual(["2027-05-13", "2027-05-16"]);
    expect(opens(stayEvent(ajax, "flight"), amsterdam)).toEqual(["2027-05-16", "2027-05-21"]);
  });
});

describe("stayFlight - two stays under one flight city (a Manchester match slept in Manchester + London)", () => {
  const match = manchesterMatch(901, "2027-05-15", { lodging_mode: "event_city_only" });
  const route = [match, wembley];
  const d = defaultTripDates(route); // depart 14/05, move 16/05, return 18/05

  it("no leg and no train between them: the move is a ground segment on its day", () => {
    const list = stays(route, d);
    expect(list.map((s) => [s.key, s.city])).toEqual([
      ["901", "event"],
      ["703", "flight"],
    ]);
    const flight = tripFlight([
      seg("TLV", "LTN", "2027-05-14T10:00:00", "2027-05-14T14:00:00"),
      seg("LTN", "TLV", "2027-05-18T10:00:00", "2027-05-18T17:00:00"),
    ]);
    const manchester = stayFlight(0, flight, route, d, none);
    const london = stayFlight(1, flight, route, d, none);
    expect(manchester.inbound).toMatchObject({ departureTime: "2027-05-16T12:00:00", departureAirport: "LON", arrivalAirport: "LON" });
    const manchesterEvent = stayEvent(match, list[0].city);
    expect(lodgingLocation(manchesterEvent, list[0].city).name).toBe("מנצ'סטר");
    expect(opens(manchesterEvent, manchester)).toEqual(["2027-05-14", "2027-05-16"]);
    expect(opens(stayEvent(wembley, list[1].city), london)).toEqual(["2027-05-16", "2027-05-18"]);
  });
});

describe("stayHotelRange", () => {
  it("is the range the live step opens on, as YYYY-MM-DD", () => {
    const route = [celine, chelsea];
    const d = defaultTripDates(route);
    const flight = tripFlight([OUT, PAR_LON, RET]);
    expect(stayHotelRange(stayEvent(chelsea, "flight"), stayFlight(1, flight, route, d, none))).toEqual([
      "2027-05-13",
      "2027-05-16",
    ]);
  });
});

const hotel = (over: Partial<OrderHotel> = {}) =>
  ({
    id: "h1",
    name: "Hotel One",
    address: "1 Rue",
    price: "400",
    rate: { match_hash: "m1" },
    guests: [{ adults: 2, children: [] }],
    checkin: "2027-05-11",
    checkout: "2027-05-13",
    hotelInformation: { hotelName: "Hotel One" },
    ...over,
  }) as unknown as OrderHotel;

describe("hotelOnStayDates", () => {
  it("is true when the hotel is booked for the stay's own nights", () => {
    expect(hotelOnStayDates(hotel(), ["2027-05-11", "2027-05-13"])).toBe(true);
  });

  it("is false for other nights (the customer moved the dates in the step's picker)", () => {
    expect(hotelOnStayDates(hotel({ checkout: "2027-05-14" }), ["2027-05-11", "2027-05-13"])).toBe(false);
    expect(hotelOnStayDates(hotel({ checkin: "2027-05-10" }), ["2027-05-11", "2027-05-13"])).toBe(false);
  });

  it("no hotel is not a mismatch", () => {
    expect(hotelOnStayDates(undefined, ["2027-05-11", "2027-05-13"])).toBe(true);
  });
});

describe("sameHotel", () => {
  it("the same pick written again is the same hotel (the step's cards commit their rate again on a re-render)", () => {
    expect(sameHotel(hotel(), hotel())).toBe(true);
    expect(sameHotel(undefined, undefined)).toBe(true);
  });

  it("another hotel, rate, price or night is a new pick", () => {
    expect(sameHotel(hotel(), hotel({ id: "h2" }))).toBe(false);
    expect(sameHotel(hotel(), hotel({ rate: { match_hash: "m2" } } as unknown as Partial<OrderHotel>))).toBe(false);
    expect(sameHotel(hotel(), hotel({ price: "410" }))).toBe(false);
    expect(sameHotel(hotel(), hotel({ checkout: "2027-05-14" }))).toBe(false);
    expect(sameHotel(hotel(), undefined)).toBe(false);
  });
});

describe("stayAdapterFields", () => {
  it("hands the live hotel step a plain one-city visit sized for the trip: no split, no skip, no package", () => {
    const route = [celine, chelsea];
    const d = defaultTripDates(route);
    const flight = stayFlight(0, tripFlight([OUT, PAR_LON, RET]), route, d, none);
    const event = stayEvent(celine, "flight");
    const f = stayAdapterFields({ event, city: "flight", flight, hotel: undefined, pax: 3 });
    expect(f.event).toBe(event);
    expect(f.flight).toBe(flight);
    expect(f.hotel).toBeUndefined();
    expect(f.numberOfEventTickets).toBe(3);
    expect(f.planeTickets).toEqual({ adults: 3, children: 0 });
    expect(f.lodgingCity).toBe("flight");
    expect(f.flightSkipped).toBe(false);
    expect(f.returnToSummary).toBe(false);
    expect(f.packageLocked).toBe(false);
    expect(f.readyPackage).toBeUndefined();
    expect(f.personLink).toBeUndefined();
    // The order layout's own "one hotel, no split" (app/order/layout.tsx starts both at null).
    expect(f.hotelSegments).toBeNull();
    expect(f.splitNights).toBeNull();
  });

  it("passes the stay's hotel through", () => {
    const h = hotel();
    const f = stayAdapterFields({ event: celine, city: "event", flight: undefined, hotel: h, pax: 1 });
    expect(f.hotel).toBe(h);
    expect(f.lodgingCity).toBe("event");
  });
});
