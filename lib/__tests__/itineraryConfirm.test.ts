import { describe, expect, it, vi } from "vitest";
import type { Event, FlightSegment, ItineraryFlight, OrderHotel, OrderTicket } from "../app.types";
import {
  PAYMENTS_LIVE,
  UUID_V4_RE,
  buildGroupRows,
  checkDates,
  checkTickets,
  eventDateIso,
  UNCHECKED_PRICE_FLOOR,
  escalatePriceChange,
  holdAttempt,
  holdSignature,
  isHeldAnswer,
  PRICE_STILL_CHANGING,
  withRowEids,
  tripKey,
  notePriceAnswer,
  NO_PRICE_CHANGES,
  checkPieces,
  checkRoute,
  confirmFailureAction,
  eventOrderInfo,
  eventParts,
  newGroupId,
  parseSubmission,
  serverPerTraveller,
  serverPrice,
  splitTotal,
  submissionFromState,
  toSingleEventOrderData,
  totalsMatch,
  tripState,
  type TripSubmission,
} from "../itinerary/confirm";
import { defaultTripDates, stays } from "../itinerary/dates";
import { tripHoldMail, tripOpsMail, tripMailInput } from "../itinerary/emails";
import { findGroup, insertGroup, type GroupDb } from "../itinerary/insertGroup";
import { pickFreshTripEvents } from "../itinerary/adapter";
import { confirmTrip, type ConfirmDeps } from "../itinerary/confirmFlow";
import type { BlockRow } from "../itinerary/offlineHold";
import { trustedMinTicket, validateItineraryPriceFloor } from "../itinerary/priceFloor";
import { livePrice } from "../itinerary/progress";
import { DEFAULT_ITINERARY_SETTINGS as S } from "../itinerary/settings";
import { INITIAL_ITINERARY_STATE, type ItineraryState } from "../itinerary/state";
import type { TravellersInput } from "../itinerary/travellers";

type City = { latitude: number; longitude: number; name: string; city_iata: string };

const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז, צרפת", city_iata: "PAR" };
const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון, בריטניה", city_iata: "LON" };
const TODAY = "2026-10-21";
const NOW = new Date("2026-10-21T10:00:00Z");
const GROUP = "3f2b8c1e-9d4a-4e6b-8a1c-2d3e4f5a6b7c";
const RATE = 3.71;

/**
 * The progress test's events: markups set through `markup_ticket` (composed pricing, so nothing
 * depends on NEXT_PUBLIC_MARKUP), a 4-night package at a base of $400 = $100 a night, and one
 * ticket on sale (the price floor's trusted cheapest ticket).
 */
const ev = (id: number, name: string, date: string, city: City, markup: number, cheapest: number) =>
  ({
    id,
    name,
    date: `${date}T20:00:00`,
    type: "music_event",
    location: { ...city, country_code: "XX" },
    def_date_depart: "2027-01-01",
    def_date_return: "2027-01-05",
    base_flight_price: 500,
    base_hotel_price: 400,
    markup_ticket: markup,
    tickets_and_rates: [
      { id: `t${id}`, category: `cat t${id}`, price: cheapest, available: true, description: "", colorOnTheMap: "" },
      { id: `x${id}`, category: "gone", price: 1, available: false, description: "", colorOnTheMap: "" },
    ],
  }) as unknown as Event;

const celine = ev(618, "סלין דיון", "2027-05-12", PARIS, 175, 210);
const chelsea = ev(702, "צ'לסי - אברטון", "2027-05-15", LONDON, 250, 150);
const coldplay = ev(703, "Coldplay <b>", "2027-05-17", LONDON, 175, 150);
const route = [celine, chelsea];
const dates = defaultTripDates(route);

const seg = (from: string, to: string, departureTime: string, arrivalTime: string): FlightSegment => ({
  departureTime,
  arrivalTime,
  departureAirport: from,
  arrivalAirport: to,
  stops: [],
  duration: "PT3H",
  checkBagsIncluded: true,
  cabinBagsIncluded: true,
  flightNumber: `LY${from}`,
});

// The Paris stay is 11/05-13/05 (2 nights), the London stay 13/05-16/05 (3 nights).
const legs = [
  seg("TLV", "CDG", "2027-05-11T05:40:00", "2027-05-11T09:55:00"),
  seg("CDG", "LHR", "2027-05-13T13:05:00", "2027-05-13T13:25:00"),
  seg("LHR", "TLV", "2027-05-16T22:40:00", "2027-05-17T05:20:00"),
];
const flight = {
  id: "offer-1",
  airline: "LY",
  price: 1300,
  numOfTravelers: 2,
  metadata: { name: "El Al" },
  outbound: legs[0],
  inbound: legs[2],
  legs,
  trainLegs: [],
} as unknown as ItineraryFlight;

const ticket = (id: string, price: number, quantity = 2) =>
  ({ id, category: `cat ${id}`, price, quantity, supplier: "static", zoneLabel: `zone ${id}` }) as unknown as OrderTicket;

/** A free-cancellation rate: sellable however far the stay is. */
const REFUNDABLE = {
  match_hash: "m",
  room_name: "Double",
  payment_options: { payment_types: [{ cancellation_penalties: { free_cancellation_before: "2027-05-01T00:00:00" } }] },
};

const hotel = (id: string, price: string, checkin: string, checkout: string, adults = 2, rate: unknown = REFUNDABLE) =>
  ({
    id,
    name: `Hotel ${id}`,
    address: "1 Rue",
    price,
    rate,
    guests: [{ adults, children: [] }],
    checkin,
    checkout,
    breakfast_offer: { rate: {}, delta_usd: 9 },
    hotelInformation: { hotelName: `Hotel ${id}`, roomName: "Double", stars: 4, amenities: [], distance: 1 },
  }) as unknown as OrderHotel;

const [parisStay, londonStay] = stays(route, dates);
// Paris: $900 for two = $450 a guest (off the base); London: $602 = within $4 of its $300 base.
const parisHotel = hotel("p", "900", "2027-05-11", "2027-05-13");
const londonHotel = hotel("l", "602", "2027-05-13", "2027-05-16");

const full: ItineraryState = {
  ...INITIAL_ITINERARY_STATE,
  step: "summary",
  route,
  dates,
  pax: 2,
  tickets: { 618: ticket("t618", 210), 702: ticket("t702", 150) },
  flight,
  hotels: { [parisStay.key]: parisHotel, [londonStay.key]: londonHotel },
};

const travellers: TravellersInput = {
  contact: { firstName: "Dana", lastName: "Levi", phone: "050-123-4567", email: "dana@example.com" },
  others: [{ firstName: "", lastName: "" }],
};

const priceOf = (s: ItineraryState) => {
  const p = livePrice(s, S);
  if (!p) throw new Error("fixture is not complete");
  return p;
};

/**
 * What the browser sends for `state`, through JSON like the real request. A state the summary
 * could not price (a broken fixture) sends the complete trip's price - the server must refuse it
 * on its own.
 */
const wire = (s: ItineraryState, extra: Partial<TripSubmission> = {}): Record<string, unknown> =>
  JSON.parse(
    JSON.stringify({
      ...submissionFromState(s, travellers, GROUP, livePrice(s, S) ?? priceOf(full), { utmSource: "google" }),
      ...extra,
    }),
  );

const parsed = (raw: unknown): TripSubmission => {
  const r = parseSubmission(raw, S.maxEvents);
  if (!r.ok) throw new Error(`refused: ${r.reason}`);
  return r.sub;
};

// One stay: Chelsea and a London concert two days later share the London hotel.
const oneCity = [chelsea, coldplay];
const oneCityDates = defaultTripDates(oneCity); // 14/05 -> 18/05
const oneCityLegs = [
  seg("TLV", "LHR", "2027-05-14T09:00:00", "2027-05-14T12:30:00"),
  seg("LHR", "TLV", "2027-05-18T22:40:00", "2027-05-19T05:20:00"),
];
const oneCityFlight = { ...flight, price: 1000, legs: oneCityLegs, outbound: oneCityLegs[0], inbound: oneCityLegs[1] } as ItineraryFlight;
const oneCityState: ItineraryState = {
  ...full,
  route: oneCity,
  dates: oneCityDates,
  tickets: { 702: ticket("t702", 150), 703: ticket("t703", 150) },
  flight: oneCityFlight,
  hotels: { [String(chelsea.id)]: hotel("l", "1200", "2027-05-14", "2027-05-18") },
};

describe("group id - the idempotency key", () => {
  it("is a uuid v4, made fresh each time", () => {
    const a = newGroupId();
    const b = newGroupId();
    expect(a).toMatch(UUID_V4_RE);
    expect(b).toMatch(UUID_V4_RE);
    expect(a).not.toBe(b);
  });
});

describe("parseSubmission - the request's shape", () => {
  it("takes what the summary sends", () => {
    const sub = parsed(wire(full));
    expect(sub.group).toBe(GROUP);
    expect(sub.route).toEqual([618, 702]);
    expect(sub.pax).toBe(2);
    expect(sub.clientTotal).toBe(4265);
    expect(sub.clientPerTraveller).toBe(2133);
    expect(sub.utmSource).toBe("google");
    expect(sub.payNow).toBe(false);
    expect(Object.keys(sub.tickets).map(Number)).toEqual([618, 702]);
  });

  it("refuses a group that is not a uuid v4", () => {
    for (const group of ["", "abc", "3f2b8c1e-9d4a-1e6b-8a1c-2d3e4f5a6b7c", `${GROUP}x`, 7]) {
      expect(parseSubmission(wire(full, { group: group as string }), 3).ok).toBe(false);
    }
  });

  it("refuses one event, a duplicate, more than the settings allow, and ids that are not ids", () => {
    expect(parseSubmission(wire(full, { route: [618] }), 3).ok).toBe(false);
    expect(parseSubmission(wire(full, { route: [618, 618] }), 3).ok).toBe(false);
    expect(parseSubmission(wire(full, { route: [618, 702, 703] }), 2).ok).toBe(false);
    expect(parseSubmission(wire(full, { route: [618, -1] }), 3).ok).toBe(false);
    expect(parseSubmission(wire(full, { route: [618, 1.5] }), 3).ok).toBe(false);
  });

  it("refuses a party of 0 or 10 (the ticket step's cap is 9)", () => {
    expect(parseSubmission(wire(full, { pax: 0 }), 3).ok).toBe(false);
    expect(parseSubmission(wire(full, { pax: 10 }), 3).ok).toBe(false);
  });

  it("refuses a ticket missing or bought for another party", () => {
    const raw = wire(full);
    expect(parseSubmission({ ...raw, tickets: { 618: (raw.tickets as Record<string, unknown>)["618"] } }, 3).ok).toBe(false);
    const three = wire({ ...full, tickets: { ...full.tickets, 702: ticket("t702", 150, 3) } });
    expect(parseSubmission(three, 3).ok).toBe(false);
  });

  it("refuses a flight for another party, without legs, or from our own stock", () => {
    expect(parseSubmission(wire({ ...full, flight: { ...flight, numOfTravelers: 3 } as ItineraryFlight }), 3).ok).toBe(false);
    expect(parseSubmission(wire({ ...full, flight: { ...flight, legs: [] } as ItineraryFlight }), 3).ok).toBe(false);
    expect(parseSubmission(wire({ ...full, flight: { ...flight, isOffline: true, offlineId: 4 } as ItineraryFlight }), 3).ok).toBe(false);
  });

  it("refuses a hold without the main contact (another traveller may stay blank)", () => {
    const raw = wire(full);
    const noPhone = { ...travellers, contact: { ...travellers.contact, phone: "" } };
    expect(parseSubmission({ ...raw, travellers: noPhone }, 3).ok).toBe(false);
  });

  it("m1 - until payments are live (phase 3) a request that asks to pay is parsed as a hold", () => {
    expect(PAYMENTS_LIVE).toBe(false);
    // To pay every traveller's name would be required; while paying is not live the request is a
    // hold - the hold's rules (the main contact) - and never carries payNow on.
    const sub = parsed({ ...wire(full), payNow: true });
    expect(sub.payNow).toBe(false);
  });

  it("refuses a missing or broken client total, bad dates, a body that is not an object", () => {
    expect(parseSubmission({ ...wire(full), clientTotal: undefined }, 3).ok).toBe(false);
    expect(parseSubmission({ ...wire(full), clientTotal: -5 }, 3).ok).toBe(false);
    expect(parseSubmission({ ...wire(full), dates: { depart: "12/05/2027", ret: dates.ret, moves: {} } }, 3).ok).toBe(false);
    expect(parseSubmission(null, 3).ok).toBe(false);
    expect(parseSubmission("x", 3).ok).toBe(false);
  });

  it("keeps a long utm source short and drops one that is not text", () => {
    expect(parsed({ ...wire(full), utmSource: "a".repeat(300) }).utmSource).toHaveLength(100);
    expect(parsed({ ...wire(full), utmSource: { x: 1 } }).utmSource).toBe("");
  });
});

describe("checkRoute - the route as it is on the server now", () => {
  it("passes the trip's events, in date order", () => {
    const r = checkRoute([702, 618], [chelsea, celine], S, TODAY);
    expect(r.ok && r.route.map((e) => e.id)).toEqual([618, 702]);
  });

  it("an event gone, no longer eligible, or that no longer fits: the route changed", () => {
    const gone = checkRoute([618, 702], [celine, undefined], S, TODAY);
    expect(!gone.ok && gone.failure).toMatchObject({ code: "ROUTE_CHANGED", status: 400, step: "build", eventId: 702 });
    const sold = { ...chelsea, tags: "Sold" } as Event;
    expect(checkRoute([618, 702], [celine, sold], S, TODAY)).toMatchObject({ ok: false, failure: { code: "ROUTE_CHANGED", eventId: 702 } });
    const us = { ...chelsea, location: { ...chelsea.location, country_code: "US" } } as Event;
    expect(checkRoute([618, 702], [celine, us], S, TODAY).ok).toBe(false);
    // Staff cut the distance: London is 343 km from Paris.
    expect(checkRoute([618, 702], [celine, chelsea], { ...S, maxKm: 100 }, TODAY).ok).toBe(false);
    // Staff cut the trip to two events.
    expect(checkRoute([618, 702, 703], [celine, chelsea, coldplay], { ...S, maxEvents: 2 }, TODAY).ok).toBe(false);
  });
});

describe("checkDates - the dates are the route's own", () => {
  it("passes dates clampTripDates would keep, and refuses any other", () => {
    expect(checkDates(route, parsed(wire(full)))).toBeNull();
    const early = parsed({ ...wire(full), dates: { ...dates, depart: "2027-05-01" } });
    expect(checkDates(route, early)).toMatchObject({ code: "ROUTE_CHANGED" });
    const extraMove = parsed({ ...wire(full), dates: { ...dates, moves: { ...dates.moves, "1>2": "2027-05-13" } } });
    expect(checkDates(route, extraMove)).toMatchObject({ code: "ROUTE_CHANGED" });
  });

  it("refuses a train move the route does not have", () => {
    expect(checkDates(route, parsed({ ...wire(full), train: ["1>2"] }))).toMatchObject({ code: "ROUTE_CHANGED" });
  });
});

describe("checkPieces - every piece is ready for the party", () => {
  const sub = parsed(wire(full));

  it("a complete trip passes", () => {
    expect(checkPieces(tripState(sub, route), NOW)).toBeNull();
  });

  it("a stay without its hotel, or one booked for other nights or another party: back to that city", () => {
    const noLondon = tripState({ ...sub, hotels: { [parisStay.key]: parisHotel } }, route);
    expect(checkPieces(noLondon, NOW)).toMatchObject({ code: "HOTEL_CHANGED", status: 400, step: "hotels", stayKey: londonStay.key });
    const moved = tripState({ ...sub, hotels: { ...sub.hotels, [londonStay.key]: hotel("l", "602", "2027-05-13", "2027-05-17") } }, route);
    expect(checkPieces(moved, NOW)).toMatchObject({ code: "HOTEL_CHANGED", stayKey: londonStay.key });
  });

  it("our own hotel stock is taken like live (its block is checked and held by the route)", () => {
    const own = { ...londonHotel, isOffline: true, offlineId: 9, offlineIds: [9, 9], offlineRawPrice: 410 } as OrderHotel;
    const s = tripState({ ...sub, hotels: { ...sub.hotels, [londonStay.key]: own } }, route);
    expect(checkPieces(s, NOW)).toBeNull();
  });

  it("a non-refundable rate more than a week out is refused (lib/hotelRateTerms.ts)", () => {
    const nonRef = hotel("p", "900", "2027-05-11", "2027-05-13", 2, { match_hash: "n" });
    const s = tripState({ ...sub, hotels: { ...sub.hotels, [parisStay.key]: nonRef } }, route);
    expect(checkPieces(s, NOW)).toMatchObject({ code: "HOTEL_NOT_REFUNDABLE", status: 400, stayKey: parisStay.key });
  });

  it("a flight whose legs are not the trip's flown legs: back to the flights", () => {
    const short = { ...flight, legs: legs.slice(0, 2) } as ItineraryFlight;
    expect(checkPieces(tripState({ ...sub, flight: short }, route), NOW)).toMatchObject({ code: "FLIGHT_CHANGED", step: "flights" });
    // The Paris -> London move by train: two flown legs, not three.
    const train = parsed({ ...wire(full), train: [`${celine.id}>${chelsea.id}`] });
    expect(checkPieces(tripState(train, route), NOW)).toMatchObject({ code: "FLIGHT_CHANGED" });
  });
});

describe("the server's price - the summary's own livePrice on the trusted state", () => {
  it("equals the client's livePrice for the same trip", () => {
    const sub = parsed(wire(full));
    expect(serverPrice(sub, route, S)).toEqual(livePrice(full, S));
    expect(serverPrice(parsed(wire(oneCityState)), oneCity, S)).toEqual(livePrice(oneCityState, S));
  });

  it("serverPerTraveller = the hand sum: tickets 360 + flight 650 + hotels 750 + markups 372.5 -> ceil(4265 / 2)", () => {
    expect(serverPerTraveller(parsed(wire(full)), route, S)).toBe(2133);
    expect(serverPrice(parsed(wire(full)), route, S)?.total).toBe(4265);
  });

  it("prices the server's events: a markup raised on the server moves the total", () => {
    const dearer = { ...chelsea, markup_ticket: 300 } as Event;
    // 300 in full instead of 250: +50 a traveller -> 4365.
    expect(serverPrice(parsed(wire(full)), [celine, dearer], S)?.total).toBe(4365);
  });

  it("totalsMatch: within a dollar of the party total", () => {
    expect(totalsMatch(1000, 1000.9)).toBe(true);
    expect(totalsMatch(1000, 1001)).toBe(true);
    expect(totalsMatch(1000, 999)).toBe(true);
    expect(totalsMatch(1000, 1002)).toBe(false);
    expect(totalsMatch(1000, Number.NaN)).toBe(false);
  });
});

describe("eventParts / splitTotal - each row's share", () => {
  it("each event's part: its tickets and tiered markup for the party, its stay's hotel, the flight on the first", () => {
    // Céline: 210x2 + 122.5x2 + Paris 450x2 + flight 1300 = 2865; Chelsea: 150x2 + 250x2 + London 300x2 = 1400.
    expect(eventParts(full, S)).toEqual([2865, 1400]);
    expect(Math.ceil(eventParts(full, S).reduce((a, b) => a + b, 0))).toBe(livePrice(full, S)?.total);
  });

  it("the parts add up to the live total before its one rounding (an uneven flight)", () => {
    const three: ItineraryState = {
      ...full,
      pax: 3,
      tickets: { 618: ticket("t618", 100.33, 3), 702: ticket("t702", 99.99, 3) },
      flight: { ...flight, price: 1000.01, numOfTravelers: 3 } as ItineraryFlight,
      hotels: {
        [parisStay.key]: hotel("p", "900", "2027-05-11", "2027-05-13", 3),
        [londonStay.key]: hotel("l", "1200", "2027-05-13", "2027-05-16", 3),
      },
    };
    const parts = eventParts(three, S);
    const total = livePrice(three, S)?.total ?? 0;
    expect(Math.ceil(Math.round(parts.reduce((a, b) => a + b, 0) * 100) / 100)).toBe(total);
  });

  it("Σ ILS shares = ceil(total x rate) exactly (the live rounding), Σ USD shares = the total; the remainder on seq 1", () => {
    for (const rate of [3.71, 3.0, 3.6543, 2.99, 3.33]) {
      for (const s of [full, oneCityState]) {
        const total = livePrice(s, S)?.total ?? 0;
        const split = splitTotal(eventParts(s, S), total, rate);
        expect(split.totalIls).toBe(Math.ceil(total * rate));
        expect(split.ils.reduce((a, b) => a + b, 0)).toBe(split.totalIls);
        expect(split.usd.reduce((a, b) => a + b, 0)).toBe(total);
        expect(split.ils.every(Number.isInteger)).toBe(true);
      }
    }
    // 1400 x 3.71 = 5194 on Chelsea; Céline takes the rest of ceil(4265 x 3.71 = 15823.15) = 15824.
    expect(splitTotal([2865, 1400], 4265, 3.71)).toEqual({ usd: [2865, 1400], ils: [10630, 5194], totalIls: 15824 });
    // The live order's own figure for the same USD total and rate (app/order/hooks.tsx).
    expect(splitTotal([2865, 1400], 4265, 3.71).totalIls).toBe(Math.ceil(4265 * 3.71));
  });
});

describe("buildGroupRows", () => {
  const ctx = { group: GROUP, rateIls: RATE, settings: S, status: "24Save" as const, gtmIdnts: null };

  it("[Céline, Chelsea]: two rows, seq 1/2 of 2, the flight on seq 1 only, each city's hotel on its event", () => {
    const sub = parsed(wire(full));
    const rows = buildGroupRows(sub, route, ctx);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => [r.event_id, r.itinerary_seq, r.itinerary_of])).toEqual([
      [618, 1, 2],
      [702, 2, 2],
    ]);
    expect(rows[0].flight_order_info).toEqual(sub.flight);
    expect(rows[1].flight_order_info).toEqual({});
    expect(rows[0].hotel_order_info).toMatchObject({ id: "p", name: "Hotel p" });
    expect(rows[1].hotel_order_info).toMatchObject({ id: "l", name: "Hotel l" });
    // The in-session breakfast offer never reaches the reservation (persistableHotel).
    expect(rows[1].hotel_order_info).not.toHaveProperty("breakfast_offer");
    expect(rows.reduce((a, r) => a + r.final_purchase_price_ils, 0)).toBe(Math.ceil(4265 * RATE));
    expect(rows.reduce((a, r) => a + r.user_shown_price, 0)).toBe(4265);
    // Live hotels: confirm-order's own-stock columns are null.
    for (const r of rows) expect(r).toMatchObject({ offline_hotel_id: null, offline_hotel_ids: null, offline_hotel_cost: null });
    for (const r of rows) {
      expect(r).toMatchObject({
        itinerary_group: GROUP,
        status: "24Save",
        payment_info: null,
        exchange_rate_usd_ils_100: 371,
        aff_partner_tracking_code: "google",
        main_contact_first_name: "Dana",
        main_contact_email: "dana@example.com",
        more_pax_info: [{ first_name: "", last_name: "" }],
      });
    }
  });

  it("each row's event_order_info is that event's ticket in the single-event shape", () => {
    const rows = buildGroupRows(parsed(wire(full)), route, ctx);
    expect(rows[1].event_order_info).toMatchObject({
      event_id: 702,
      name: "צ'לסי - אברטון",
      date: "2027-05-15T17:00:00.000Z",
      number_of_ticket: 2,
      id: "t702",
      category: "cat t702",
      zone_label: "zone t702",
      supplier: "static",
      price_per_ticket: 150,
      total_tickets_price: 300,
      location_name: "לונדון, בריטניה",
    });
  });

  it("[Chelsea, a London concert]: one stay - one hotel, on the first event of the city", () => {
    const rows = buildGroupRows(parsed(wire(oneCityState)), oneCity, ctx);
    expect(rows.map((r) => Object.keys(r.hotel_order_info).length > 0)).toEqual([true, false]);
    expect(rows.map((r) => Object.keys(r.flight_order_info).length > 0)).toEqual([true, false]);
    const total = livePrice(oneCityState, S)?.total ?? 0;
    expect(rows.reduce((a, r) => a + r.final_purchase_price_ils, 0)).toBe(Math.ceil(total * RATE));
  });

  it("an own-stock hotel puts confirm-order's columns on the row that carries it, and only there", () => {
    const own = { ...londonHotel, isOffline: true, offlineId: 9, offlineIds: [9, 9, 12], offlineRawPrice: 410 } as OrderHotel;
    const sub = parsed(wire({ ...full, hotels: { ...full.hotels, [londonStay.key]: own } }));
    const rows = buildGroupRows(sub, route, ctx);
    expect(rows[0]).toMatchObject({ offline_hotel_id: null, offline_hotel_ids: null, offline_hotel_cost: null });
    expect(rows[1]).toMatchObject({ offline_hotel_id: 9, offline_hotel_ids: [9, 9, 12], offline_hotel_cost: 410 });
    expect(rows[1].hotel_order_info).toMatchObject({ isOffline: true, offlineIds: [9, 9, 12] });
  });

  it("uses the validated ticket info when it is handed in (the validators' flags)", () => {
    const sub = parsed(wire(full));
    const info = { ...eventOrderInfo(chelsea, sub.tickets[702], 2), own_stock: true };
    const rows = buildGroupRows(sub, route, { ...ctx, infos: new Map([[702, info]]) });
    expect(rows[1].event_order_info).toMatchObject({ own_stock: true, date: "2027-05-15T17:00:00.000Z" });
  });
});

describe("toSingleEventOrderData - what the live per-event validators read", () => {
  it("one event, its ticket for the party, never an agent booking", () => {
    const sub = parsed(wire(full));
    const data = toSingleEventOrderData(sub, chelsea);
    expect(data.event_id).toBe(702);
    expect(data.is_agent_booking).toBe(false);
    expect(data.event_order_info).toMatchObject({
      event_id: 702,
      id: "t702",
      number_of_ticket: 2,
      price_per_ticket: 150,
      supplier: "static",
    });
  });
});

describe("validateItineraryPriceFloor - trusted cheapest ticket + tiered markup, 40% slack", () => {
  it("the trusted cheapest ticket is the cheapest AVAILABLE one (confirm-order utils.ts:214-219)", () => {
    expect(trustedMinTicket(chelsea)).toBe(150);
    expect(trustedMinTicket({ ...chelsea, tickets_and_rates: [] } as Event)).toBe(0);
  });

  it("a real trip passes", () => {
    const rows = buildGroupRows(parsed(wire(full)), route, { group: GROUP, rateIls: RATE, settings: S, status: "24Save", gtmIdnts: null });
    expect(validateItineraryPriceFloor(route, rows.map((r) => r.final_purchase_price_ils), 2, S, RATE)).toBeNull();
  });

  it("a ticket priced at $1 on a row with nothing else to hide it behind is refused", () => {
    const tampered: ItineraryState = { ...oneCityState, tickets: { ...oneCityState.tickets, 703: ticket("t703", 1) } };
    const rows = buildGroupRows(parsed(wire(tampered)), oneCity, { group: GROUP, rateIls: RATE, settings: S, status: "24Save", gtmIdnts: null });
    const reason = validateItineraryPriceFloor(oneCity, rows.map((r) => r.final_purchase_price_ils), 2, S, RATE);
    expect(reason).toMatch(/703/);
  });

  it("fails open without a rate, like the live floor", () => {
    expect(validateItineraryPriceFloor(route, [1, 1], 2, S, Number.NaN)).toBeNull();
  });
});

describe("insertGroup / findGroup - one bulk insert, idempotent on the group", () => {
  const rows = [{ itinerary_seq: 1 }, { itinerary_seq: 2 }];
  const db = (over: Partial<GroupDb>): GroupDb => ({
    insert: async () => ({ data: null, error: { code: "XX", message: "not used" } }),
    find: async () => ({ data: [], error: null }),
    ...over,
  });

  it("answers the ids in seq order", async () => {
    const out = await insertGroup(
      rows,
      db({ insert: async () => ({ data: [{ id: 12, itinerary_seq: 2 }, { id: 11, itinerary_seq: 1 }], error: null }) }),
    );
    expect(out).toEqual({ ids: [11, 12], duplicate: false });
  });

  it("a unique violation on (group, seq) is the same request twice: the group already written", async () => {
    let finds = 0;
    const out = await insertGroup(
      rows,
      db({
        insert: async () => ({ data: null, error: { code: "23505", message: "duplicate key" } }),
        find: async () => {
          finds++;
          return { data: [{ id: 21, itinerary_seq: 1 }, { id: 22, itinerary_seq: 2 }], error: null };
        },
      }),
      GROUP,
    );
    expect(out).toEqual({ ids: [21, 22], duplicate: true });
    expect(finds).toBe(1);
  });

  it("any other error - the columns missing today - is an error, never a partial answer", async () => {
    const out = await insertGroup(
      rows,
      db({ insert: async () => ({ data: null, error: { code: "PGRST204", message: "Could not find the 'itinerary_group' column" } }) }),
      GROUP,
    );
    expect(out).toMatchObject({ error: expect.stringContaining("itinerary_group") });
    // A unique violation whose group cannot be read back is an error too.
    const lost = await insertGroup(
      rows,
      db({ insert: async () => ({ data: null, error: { code: "23505" } }), find: async () => ({ data: [], error: null }) }),
      GROUP,
    );
    expect(lost).toHaveProperty("error");
    // Fewer rows back than sent, WITHOUT an error: the one statement succeeded - the group is
    // written, read back, never "nothing written".
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const short = await insertGroup(
      rows,
      db({
        insert: async () => ({ data: [{ id: 1, itinerary_seq: 1 }], error: null }),
        find: async () => ({ data: [{ id: 2, itinerary_seq: 2 }, { id: 1, itinerary_seq: 1 }], error: null }),
      }),
      GROUP,
    );
    expect(short).toEqual({ ids: [1, 2], duplicate: false });
    // The read-back failing too: still written - the ids the insert gave.
    const shortNoFind = await insertGroup(
      rows,
      db({ insert: async () => ({ data: [{ id: 1, itinerary_seq: 1 }], error: null }), find: async () => ({ data: null, error: { code: "x" } }) }),
      GROUP,
    );
    expect(shortNoFind).toEqual({ ids: [1], duplicate: false });
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });

  it("findGroup: the rows of a group, or 'cannot check' when the read fails", async () => {
    expect(await findGroup(GROUP, db({ find: async () => ({ data: [{ id: 5, itinerary_seq: 2 }, { id: 4, itinerary_seq: 1 }], error: null }) }))).toEqual({
      rows: [
        { id: 4, itinerary_seq: 1 },
        { id: 5, itinerary_seq: 2 },
      ],
    });
    expect(await findGroup(GROUP, db({ find: async () => ({ data: null, error: { code: "42703", message: "column does not exist" } }) }))).toEqual({
      unavailable: { code: "42703", message: "column does not exist" },
    });
  });
});

describe("the emails", () => {
  const sub = parsed(wire(full));
  const rows = buildGroupRows(sub, route, { group: GROUP, rateIls: RATE, settings: S, status: "24Save", gtmIdnts: null });
  const input = tripMailInput({
    sub,
    route,
    rows,
    ids: [101, 102],
    references: ["ME21101", "ME21102"],
    price: priceOf(full),
    rateIls: RATE,
  });

  it("the customer's hold email: the promise, every event, no pay or resume link", () => {
    const { subject, html } = tripHoldMail(input);
    expect(subject).toContain("24");
    expect(html).toContain("קיבלנו את הבקשה. נציג יחזור אליכם תוך 24 שעות.");
    expect(html).toContain("סלין דיון");
    expect(html).toContain("צ&#39;לסי - אברטון");
    expect(html).toContain("ME21101");
    expect(html).toContain("Hotel p");
    expect(html).toContain("Hotel l");
    expect(html).not.toMatch(/orderId=|\/order\/|\/payment/);
    expect(html).not.toMatch(/href="https?:/);
  });

  it("a move the customer makes alone reads הגעה עצמאית, with the day and that it is not included", () => {
    const own = { key: "618>702", fromName: "פריז", toName: "לונדון", date: "2027-05-13", km: 343 };
    const { html } = tripHoldMail({ ...input, trainLegs: [own] });
    expect(html).toContain("הגעה עצמאית: פריז ← לונדון · 13/05 · בכוחות עצמכם, לא כלול במחיר");
    expect(html).not.toContain("ברכבת");
  });

  it("escapes what comes from outside (event names, hotels, the customer)", () => {
    const evil = tripMailInput({
      sub: { ...sub, travellers: { ...sub.travellers, contact: { ...sub.travellers.contact, firstName: "<script>" } } },
      route: [{ ...celine, name: "<img src=x>" } as Event, chelsea],
      rows,
      ids: [1, 2],
      references: [null, null],
      price: priceOf(full),
      rateIls: RATE,
    });
    const { html } = tripHoldMail(evil);
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;img src=x&gt;");
  });

  it("the ops email: the group, every reservation with its share, the legs and the hotels", () => {
    const { subject, text } = tripOpsMail(input);
    expect(subject).toContain("Euro Trip");
    expect(text).toContain(GROUP);
    expect(text).toContain("101");
    expect(text).toContain("102");
    expect(text).toContain("24Save");
    expect(text).toContain("10630");
    expect(text).not.toContain("OUR STOCK - no purchase, rooms held");
    expect(text).toContain("5194");
    expect(text).toContain("LYTLV");
    expect(text).toContain("Hotel l");
    expect(text).toMatch(/no payment link/i);
  });
});

describe("the ops email - our own hotel stock", () => {
  it("says the rooms come from our blocks, which ones, at what cost", () => {
    const own = { ...londonHotel, isOffline: true, offlineId: 9, offlineIds: [9, 12], offlineRawPrice: 410 } as OrderHotel;
    const sub = parsed(wire({ ...full, hotels: { ...full.hotels, [londonStay.key]: own } }));
    const rows = buildGroupRows(sub, route, { group: GROUP, rateIls: RATE, settings: S, status: "24Save", gtmIdnts: null });
    const { text } = tripOpsMail(
      tripMailInput({ sub, route, rows, ids: [101, 102], references: [null, null], price: priceOf(full), rateIls: RATE }),
    );
    expect(text).toContain("OUR STOCK - no purchase, rooms held from offline_hotels block(s) 9, 12 (cost $410)");
  });
});

describe("confirmFailureAction - what the summary does with a refusal", () => {
  it("409 price changed: back to the tickets, the rows read again", () => {
    const a = confirmFailureAction(409, { error: "PRICE_CHANGED" }, full);
    expect(a).toMatchObject({ kind: "go", step: "tickets", reloadRows: true });
    expect(a.message).toContain("המחיר עודכן");
  });

  it("400 route changed: back to the route with the notice", () => {
    const a = confirmFailureAction(400, { error: "ROUTE_CHANGED", eventId: 702 }, full);
    expect(a).toMatchObject({ kind: "go", step: "build" });
    expect(a.message).toContain("המסלול השתנה");
  });

  it("a ticket that changed opens its event's tab; a hotel its city's tab", () => {
    expect(confirmFailureAction(409, { error: "TICKET_CHANGED", eventId: 702 }, full)).toMatchObject({
      kind: "go",
      step: "tickets",
      eventIndex: 1,
      reloadRows: true,
    });
    const h = confirmFailureAction(400, { error: "OFFLINE_HOTEL_DATE_MISMATCH", stayKey: londonStay.key }, full);
    expect(h).toMatchObject({ kind: "go", step: "hotels", stayIndex: 1 });
    expect(h.message).toContain("לונדון");
  });

  it("a server error, an unknown answer or no answer: stay on the summary and say so", () => {
    expect(confirmFailureAction(500, { error: "SERVER_ERROR" }, full)).toMatchObject({ kind: "stay" });
    expect(confirmFailureAction(502, null, full)).toMatchObject({ kind: "stay" });
    expect(confirmFailureAction(400, { error: "PRICE_VALIDATION_FAILED" }, full)).toMatchObject({ kind: "stay" });
  });
});

// ---------------------------------------------------------------------------------------------
// Review fix round 1
// ---------------------------------------------------------------------------------------------

describe("I1 - listed events only (a row read by id is not filtered)", () => {
  it("a QA event, a deactivated one or a hidden one: the route changed", () => {
    const qa = { ...chelsea, is_test: true } as Event;
    const off = { ...chelsea, deactivated_reason: "tx_sold_out" } as Event;
    const hidden = { ...chelsea, is_hidden: true } as unknown as Event;
    for (const e of [qa, off, hidden]) {
      expect(checkRoute([618, 702], [celine, e], S, TODAY)).toMatchObject({ ok: false, failure: { code: "ROUTE_CHANGED", eventId: 702 } });
    }
    // No field at all (this branch's base has no is_hidden) / a null reason: listed.
    expect(checkRoute([618, 702], [celine, { ...chelsea, deactivated_reason: null } as Event], S, TODAY).ok).toBe(true);
  });

  it("I2 - the fresh rows keep only listed, eligible events, in the asked order", () => {
    const qa = { ...celine, is_test: true } as Event;
    expect(pickFreshTripEvents([chelsea, celine], [618, 702], TODAY).map((e) => e.id)).toEqual([618, 702]);
    expect(pickFreshTripEvents([qa, chelsea], [618, 702], TODAY).map((e) => e.id)).toEqual([702]);
    expect(pickFreshTripEvents([undefined, chelsea], [618, 702], TODAY).map((e) => e.id)).toEqual([702]);
  });
});

describe("I3 - checkTickets: the ticket is a row the event still sells", () => {
  const sub = parsed(wire(full));

  it("the trip's tickets pass", () => {
    expect(checkTickets(route, sub.tickets)).toBeNull();
  });

  it("an id the event does not have, or one off sale: 409 TICKET_CHANGED", () => {
    expect(checkTickets(route, { ...sub.tickets, 702: ticket("nope", 150) })).toMatchObject({ code: "TICKET_CHANGED", status: 409, eventId: 702 });
    // x702 is on the row but `available: false`.
    expect(checkTickets(route, { ...sub.tickets, 702: ticket("x702", 150) })).toMatchObject({ code: "TICKET_CHANGED", eventId: 702 });
  });

  it("a static / own ticket below its stored price is refused; above it passes", () => {
    expect(checkTickets(route, { ...sub.tickets, 702: ticket("t702", 149.99) })).toMatchObject({ code: "TICKET_CHANGED", eventId: 702 });
    expect(checkTickets(route, { ...sub.tickets, 702: ticket("t702", 180) })).toBeNull();
  });

  it("TixStock may sell below its stored price (its live price); the supplier must be the row's", () => {
    const tx = { ...chelsea, type: "tx_event" } as Event;
    const txTicket = { ...ticket("t702", 120), supplier: undefined } as unknown as OrderTicket;
    expect(checkTickets([celine, tx], { ...sub.tickets, 702: txTicket })).toBeNull();
    // The order says "static" for a TixStock row.
    expect(checkTickets([celine, tx], { ...sub.tickets, 702: ticket("t702", 150) })).toMatchObject({ code: "TICKET_CHANGED" });
  });

  it("TixStock not below 0.6 of its stored price (the live floor's slack): $90 of $150 passes, $89 does not", () => {
    const tx = { ...chelsea, type: "tx_event" } as Event;
    const tixstock = (price: number) => ({ ...ticket("t702", price), supplier: "tixstock" }) as unknown as OrderTicket;
    expect(UNCHECKED_PRICE_FLOOR).toBe(0.6);
    expect(checkTickets([celine, tx], { ...sub.tickets, 702: tixstock(90) })).toBeNull();
    expect(checkTickets([celine, tx], { ...sub.tickets, 702: tixstock(89.99) })).toMatchObject({
      code: "TICKET_CHANGED",
      status: 409,
      eventId: 702,
    });
    expect(checkTickets([celine, tx], { ...sub.tickets, 702: tixstock(1) })).toMatchObject({ code: "TICKET_CHANGED" });
  });

  it("LiveTickets has the same 0.6 floor ALWAYS (its live check answers null when it cannot run)", () => {
    const lt = { ...chelsea, tickets_and_rates: [{ id: "t702", category: "A", price: 150, supplier: "livetickets" }] } as unknown as Event;
    const ltTicket = (price: number) => ({ ...ticket("t702", price), supplier: "livetickets" }) as unknown as OrderTicket;
    expect(checkTickets([celine, lt], { ...sub.tickets, 702: ltTicket(10) })).toMatchObject({ code: "TICKET_CHANGED", status: 409, eventId: 702 });
    expect(checkTickets([celine, lt], { ...sub.tickets, 702: ltTicket(89.99) })).toMatchObject({ code: "TICKET_CHANGED" });
    expect(checkTickets([celine, lt], { ...sub.tickets, 702: ltTicket(90) })).toBeNull();
  });
});

describe("eventDateIso - the instant an Israeli browser makes of the event's date", () => {
  it("a zone-less summer date is Israel summer time (UTC+3)", () => {
    expect(eventDateIso("2027-05-15T20:00:00")).toBe("2027-05-15T17:00:00.000Z");
  });

  it("a zone-less winter date is Israel standard time (UTC+2)", () => {
    expect(eventDateIso("2027-01-10T20:00:00")).toBe("2027-01-10T18:00:00.000Z");
    expect(eventDateIso("2026-12-01 19:30")).toBe("2026-12-01T17:30:00.000Z");
  });

  it("a 22:00 show stays on its own day in Israel (read as UTC it would be 01:00 the next day)", () => {
    const iso = eventDateIso("2027-07-01T22:00:00");
    expect(iso).toBe("2027-07-01T19:00:00.000Z");
    const israelDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(iso));
    expect(israelDay).toBe("2027-07-01");
  });

  it("a date alone (production: events.date is a Postgres DATE) is UTC midnight of that day - what the live browser writes", () => {
    const iso = eventDateIso("2027-05-15");
    expect(iso).toBe("2027-05-15T00:00:00.000Z");
    expect(iso).toBe(new Date("2027-05-15").toISOString());
    expect(new Date(iso).toLocaleDateString("he-IL", { timeZone: "UTC" })).toBe(
      new Date("2027-05-15T12:00:00Z").toLocaleDateString("he-IL", { timeZone: "UTC" }),
    );
    expect(new Date(iso).toLocaleDateString("he-IL", { timeZone: "UTC" })).toBe("15.5.2027");
  });

  it("around the DST changes (Israel: last Friday of March, last Sunday of October)", () => {
    // 26/03/2027 02:00 -> 03:00 (summer time starts): 12:00 that day is already UTC+3.
    expect(eventDateIso("2027-03-26T12:00:00")).toBe("2027-03-26T09:00:00.000Z");
    expect(eventDateIso("2027-03-25T12:00:00")).toBe("2027-03-25T10:00:00.000Z");
    // 31/10/2027 02:00 -> 01:00 (summer time ends): 20:00 that day is UTC+2.
    expect(eventDateIso("2027-10-31T20:00:00")).toBe("2027-10-31T18:00:00.000Z");
  });

  it("a date that names its zone is read as is; an unreadable one comes back unchanged", () => {
    expect(eventDateIso("2027-05-15T20:00:00Z")).toBe("2027-05-15T20:00:00.000Z");
    expect(eventDateIso("2027-05-15T20:00:00+02:00")).toBe("2027-05-15T18:00:00.000Z");
    expect(eventDateIso("2027-05-15T20:00:00.000+0300")).toBe("2027-05-15T17:00:00.000Z");
    expect(eventDateIso("soon")).toBe("soon");
  });
});

describe("M1 - the ticket's text fields are typed like the live schema", () => {
  const raw = wire(full);
  const withTicket = (over: Record<string, unknown>) => {
    const tickets = raw.tickets as Record<string, Record<string, unknown>>;
    return { ...raw, tickets: { ...tickets, "702": { ...tickets["702"], ...over } } };
  };

  it("refuses a non-text field, a non-boolean nonInstant, an unknown seating choice", () => {
    expect(parseSubmission(withTicket({ vendor: { x: 1 } }), 3).ok).toBe(false);
    expect(parseSubmission(withTicket({ zoneLabel: null }), 3).ok).toBe(false);
    expect(parseSubmission(withTicket({ nonInstant: "yes" }), 3).ok).toBe(false);
    expect(parseSubmission(withTicket({ seatingChoice: "front" }), 3).ok).toBe(false);
  });

  it("takes what yup takes: text, a number cast to text, the two seating choices", () => {
    expect(parseSubmission(withTicket({ eid: 12345, seatingChoice: "split", nonInstant: true }), 3).ok).toBe(true);
    expect(parseSubmission(withTicket({ seatingChoice: "together" }), 3).ok).toBe(true);
  });
});

describe("M5 - each flown leg leaves on the trip's day for it", () => {
  it("a leg on another day: 409 FLIGHT_CHANGED -> the flights step", () => {
    const sub = parsed(wire(full));
    const moved = { ...flight, legs: [legs[0], seg("CDG", "LHR", "2027-05-14T13:05:00", "2027-05-14T13:25:00"), legs[2]] } as ItineraryFlight;
    expect(checkPieces(tripState({ ...sub, flight: moved }, route), NOW)).toMatchObject({ code: "FLIGHT_CHANGED", status: 409, step: "flights" });
  });
});

describe("M6 - the ops email of a pay-now group", () => {
  it("claims no 24h hold and no 'no payment link'", () => {
    const sub = parsed(wire(full));
    const rows = buildGroupRows(sub, route, { group: GROUP, rateIls: RATE, settings: S, status: "Pending", gtmIdnts: null });
    const { subject, text } = tripOpsMail(
      tripMailInput({ sub, route, rows, ids: [1, 2], references: [null, null], price: priceOf(full), rateIls: RATE }),
    );
    expect(subject).toContain("pay now");
    expect(text).toContain("PAY NOW (status Pending)");
    expect(text).not.toMatch(/24h HOLD|No payment link/);
  });
});

describe("M7 - confirmTrip: the steps' order, with the database handed in", () => {
  /** London on our own stock: block 9, a Double at $602 (the hotel's price), 3 rooms, 1 taken. */
  const ownLondon = { ...londonHotel, isOffline: true, offlineId: 9, offlineIds: [9], offlineRawPrice: 602 } as OrderHotel;
  const block9: BlockRow = {
    id: 9,
    check_in: "2027-05-13",
    check_out: "2027-05-16",
    price: 602,
    room_type: "Double",
    num_rooms: 3,
    consumed_rooms: 1,
    event_ids: [702],
    is_deleted: false,
    last_cancellation_date: "2027-05-01",
  };

  const setup = (over: Partial<ConfirmDeps> = {}, blocks: BlockRow[] = [block9]) => {
    const calls: string[] = [];
    const inserted: Record<string, unknown>[][] = [];
    const deps: ConfirmDeps = {
      getSettings: async () => S,
      vercelEnv: "preview",
      now: () => NOW,
      getEvent: async (id) => {
        calls.push(`event ${id}`);
        return [celine, chelsea, coldplay].find((e) => e.id === id);
      },
      validateTicket: async () => {
        calls.push("validate");
        return null;
      },
      getRate: async () => RATE,
      groupDb: {
        insert: async (rows) => {
          calls.push(`insert ${rows.length}`);
          inserted.push(rows);
          return { data: rows.map((_, i) => ({ id: 500 + i, itinerary_seq: i + 1 })), error: null };
        },
        find: async () => {
          calls.push("find");
          return { data: [], error: null };
        },
      },
      offlineDb: {
        readBlocks: async (ids) => {
          calls.push(`blocks ${ids.join(",")}`);
          return { data: blocks.filter((b) => ids.includes(b.id)), error: null };
        },
        readConsumed: async (id) => ({ data: { consumed_rooms: blocks.find((b) => b.id === id)?.consumed_rooms ?? 0 } }),
        writeConsumed: async (id, value) => {
          calls.push(`hold ${id}=${value}`);
          return {};
        },
      },
      finishRows: async (_rows, ids) => {
        calls.push("finish");
        return ids.map((id) => `ME21${id}`);
      },
      sendEmails: async (_mail, opts) => {
        calls.push(`mail customer=${opts.customer}`);
        return { ops: true, customer: opts.customer };
      },
      markEmailed: async () => {
        calls.push("emailed");
      },
      track: async () => {
        calls.push("track");
      },
      gtmIdnts: null,
      log: { warn: () => {}, error: () => {} },
      ...over,
    };
    return { deps, calls, inserted };
  };

  it("a fresh hold: checks, ONE insert, then references, mails, analytics - in that order", async () => {
    const { deps, calls, inserted } = setup();
    const answer = await confirmTrip(wire(full), deps);
    expect(answer).toEqual({ status: 200, body: { group: GROUP, ids: [500, 501], reference: "ME21500", emailed: true } });
    expect(calls).toEqual(["find", "event 618", "event 702", "validate", "validate", "insert 2", "finish", "mail customer=true", "emailed", "track"]);
    expect(inserted[0].map((r) => r.status)).toEqual(["24Save", "24Save"]);
  });

  it("the group already written: its rows, and nothing else runs", async () => {
    const { deps, calls } = setup();
    deps.groupDb = {
      insert: async () => {
        throw new Error("must not insert");
      },
      find: async () => {
        calls.push("find");
        return { data: [{ id: 8, itinerary_seq: 1, booking_reference: "ME218" }, { id: 9, itinerary_seq: 2 }], error: null };
      },
    };
    const answer = await confirmTrip(wire(full), deps);
    expect(answer).toEqual({ status: 200, body: { group: GROUP, ids: [8, 9], reference: "ME218" } });
    expect(calls).toEqual(["find"]);
  });

  it("a concurrent copy (23505): that group's rows - no hold, no references, no mail, no analytics", async () => {
    const { deps, calls } = setup();
    let finds = 0;
    deps.groupDb = {
      insert: async () => {
        calls.push("insert");
        return { data: null, error: { code: "23505", message: "duplicate key" } };
      },
      find: async () => {
        calls.push("find");
        finds++;
        return { data: finds === 1 ? [] : [{ id: 31, itinerary_seq: 1 }, { id: 32, itinerary_seq: 2 }], error: null };
      },
    };
    const own = { ...full, hotels: { ...full.hotels, [londonStay.key]: ownLondon } };
    const answer = await confirmTrip(wire(own), deps);
    expect(answer).toMatchObject({ status: 200, body: { ids: [31, 32] } });
    expect(calls).toContain("insert");
    expect(calls.filter((c) => /^(hold|finish|mail|emailed|track)/.test(c))).toEqual([]);
  });

  it("our own hotel stock: checked before the insert, held after it, the blocks' cost stored", async () => {
    const { deps, calls, inserted } = setup();
    const own = { ...full, hotels: { ...full.hotels, [londonStay.key]: ownLondon } };
    const answer = await confirmTrip(wire(own), deps);
    expect(answer.status).toBe(200);
    expect(calls.indexOf("blocks 9")).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf("blocks 9")).toBeLessThan(calls.indexOf("insert 2"));
    expect(calls.indexOf("insert 2")).toBeLessThan(calls.indexOf("hold 9=2"));
    expect(inserted[0][1]).toMatchObject({ offline_hotel_id: 9, offline_hotel_ids: [9], offline_hotel_cost: 602 });
  });

  it("a client cost that is not the blocks': 409 HOTEL_CHANGED to that city, nothing written", async () => {
    const { deps, calls } = setup();
    const lying = { ...ownLondon, offlineRawPrice: 1 } as OrderHotel;
    const answer = await confirmTrip(wire({ ...full, hotels: { ...full.hotels, [londonStay.key]: lying } }), deps);
    expect(answer).toMatchObject({ status: 409, body: { error: "HOTEL_CHANGED", step: "hotels", stayKey: londonStay.key } });
    expect(calls.some((c) => c.startsWith("insert"))).toBe(false);
  });

  it("no rooms left in the block: 400 OFFLINE_HOTEL_SOLD_OUT, nothing written", async () => {
    const { deps, calls } = setup({}, [{ ...block9, consumed_rooms: 3 }]);
    const answer = await confirmTrip(wire({ ...full, hotels: { ...full.hotels, [londonStay.key]: ownLondon } }), deps);
    expect(answer).toMatchObject({ status: 400, body: { error: "OFFLINE_HOTEL_SOLD_OUT", stayKey: londonStay.key } });
    expect(calls.some((c) => c.startsWith("insert"))).toBe(false);
  });

  it("a failed insert: 500, nothing held, nothing mailed", async () => {
    const { deps, calls } = setup();
    deps.groupDb = {
      insert: async () => ({ data: null, error: { code: "PGRST204", message: "Could not find the 'itinerary_group' column" } }),
      find: async () => ({ data: null, error: { code: "42703", message: "column does not exist" } }),
    };
    const answer = await confirmTrip(wire({ ...full, hotels: { ...full.hotels, [londonStay.key]: ownLondon } }), deps);
    expect(answer).toMatchObject({ status: 500, body: { error: "SERVER_ERROR" } });
    expect(calls.filter((c) => /^(hold|finish|mail|track)/.test(c))).toEqual([]);
  });

  it("a total that disagrees: 409 before anything is written; the switch off: 404 before anything is read", async () => {
    const a = setup();
    expect(await confirmTrip({ ...wire(full), clientTotal: 4300 }, a.deps)).toMatchObject({ status: 409, body: { error: "PRICE_CHANGED" } });
    expect(a.calls.some((c) => c.startsWith("insert"))).toBe(false);
    const b = setup({ vercelEnv: "production" });
    expect(await confirmTrip(wire(full), b.deps)).toMatchObject({ status: 404 });
    expect(b.calls).toEqual([]);
  });

  it("m9 - the answer says whether the customer's email went out: not sent or failed = false", async () => {
    const notSent = setup({ sendEmails: async () => ({ ops: true, customer: false }) });
    expect(await confirmTrip(wire(full), notSent.deps)).toMatchObject({ status: 200, body: { emailed: false } });
    expect(notSent.calls).not.toContain("emailed");
    const failed = setup({
      sendEmails: async () => {
        throw new Error("smtp down");
      },
    });
    expect(await confirmTrip(wire(full), failed.deps)).toMatchObject({ status: 200, body: { emailed: false } });
  });

  it("m9 - a retry's answer (the group already written) cannot tell: no emailed field", async () => {
    const { deps } = setup();
    deps.groupDb = {
      insert: async () => {
        throw new Error("must not insert");
      },
      find: async () => ({ data: [{ id: 8, itinerary_seq: 1, booking_reference: "ME218" }], error: null }),
    };
    const answer = await confirmTrip(wire(full), deps);
    expect(answer.status).toBe(200);
    expect("emailed" in answer.body).toBe(false);
  });

  it("m1 - a crafted payNow with payments switched on still writes 24Save rows and sends the hold email", async () => {
    const { deps, calls, inserted } = setup({ getSettings: async () => ({ ...S, paymentsEnabled: true }) });
    const answer = await confirmTrip({ ...wire(full), payNow: true }, deps);
    expect(answer.status).toBe(200);
    expect(inserted[0].map((r) => r.status)).toEqual(["24Save", "24Save"]);
    expect(calls).toContain("mail customer=true");
  });
});

// ---------------------------------------------------------------------------------------------
// Fix round 3
// ---------------------------------------------------------------------------------------------

describe("round 3 - a ticket's long texts never refuse a hold", () => {
  const raw = wire(full);
  const withTicket = (over: Record<string, unknown>) => {
    const tickets = raw.tickets as Record<string, Record<string, unknown>>;
    return { ...raw, tickets: { ...tickets, "702": { ...tickets["702"], ...over } } };
  };

  it("description is not checked (never stored or mailed) - a long VIP text passes", () => {
    expect(parseSubmission(withTicket({ description: "VIP hospitality ".repeat(400) }), 3).ok).toBe(true);
    expect(parseSubmission(withTicket({ description: { rich: true } }), 3).ok).toBe(true);
  });

  it("stored / mailed texts take up to 1,000 characters", () => {
    expect(parseSubmission(withTicket({ zoneLabel: "z".repeat(1000), category: "c".repeat(600) }), 3).ok).toBe(true);
    expect(parseSubmission(withTicket({ zoneLabel: "z".repeat(1001) }), 3).ok).toBe(false);
  });
});

describe("round 4 - LiveTickets: the row's event id, and the stored-price floor ALWAYS", () => {
  /** Chelsea sold through LiveTickets: one row, its own LiveTickets event id. */
  const ltChelsea = (eid?: string) =>
    ({
      ...chelsea,
      tickets_and_rates: [
        { id: "t702", category: "cat t702", price: 150, available: true, supplier: "livetickets", ...(eid ? { eid } : {}) },
      ],
    }) as unknown as Event;
  const ltTicket = (price: number) =>
    ({ id: "t702", category: "cat t702", price, quantity: 2, supplier: "livetickets", eid: "CLIENT-SAYS" }) as unknown as OrderTicket;
  const ltState = (price: number): ItineraryState => ({ ...full, tickets: { ...full.tickets, 702: ltTicket(price) } });

  it("withRowEids takes the supplier's event id from the event's row, never the client's", () => {
    const out = withRowEids([celine, ltChelsea("LT-77")], { 618: full.tickets[618] as OrderTicket, 702: ltTicket(150) });
    expect(out[702].eid).toBe("LT-77");
    // A row without one: no event id at all (not the client's).
    expect(withRowEids([celine, ltChelsea()], { 702: ltTicket(150) })[702].eid).toBeUndefined();
  });

  /** The flow; the live validator answers null ("fine" - or "could not check") and records the event id. */
  const run = async (event: Event, price: number) => {
    const seen: string[] = [];
    const calls: string[] = [];
    const deps: ConfirmDeps = {
      getSettings: async () => S,
      vercelEnv: "preview",
      now: () => NOW,
      getEvent: async (id) => (id === 702 ? event : celine),
      validateTicket: async (data) => {
        if (data.event_order_info.supplier === "livetickets") seen.push(String(data.event_order_info.supplier_event_id));
        return null;
      },
      getRate: async () => RATE,
      groupDb: {
        insert: async (rows) => {
          calls.push("insert");
          return { data: rows.map((_, i) => ({ id: 700 + i, itinerary_seq: i + 1 })), error: null };
        },
        find: async () => ({ data: [], error: null }),
      },
      offlineDb: {
        readBlocks: async () => ({ data: [], error: null }),
        readConsumed: async () => ({ data: null }),
        writeConsumed: async () => ({}),
      },
      finishRows: async (_rows, ids) => ids.map(() => null),
      sendEmails: async () => ({ ops: true, customer: true }),
      markEmailed: async () => {},
      track: async () => {},
      gtmIdnts: null,
      log: { warn: () => {}, error: () => {} },
    };
    const answer = await confirmTrip(wire(ltState(price)), deps);
    return { answer, seen, calls };
  };

  it("the live validator is handed the ROW's event id", async () => {
    const { answer, seen } = await run(ltChelsea("LT-77"), 150);
    expect(answer.status).toBe(200);
    expect(seen).toEqual(["LT-77"]);
  });

  it("below 0.6 of the stored price: 409 even though the live validator said nothing - $50 of $150", async () => {
    const low = await run(ltChelsea("LT-77"), 50);
    expect(low.answer).toMatchObject({ status: 409, body: { error: "TICKET_CHANGED", eventId: 702 } });
    expect(low.calls).not.toContain("insert");
    expect(low.seen).toEqual([]); // refused at the ticket check, before the live validators
  });

  it("at 0.6 of the stored price it passes ($90 of $150), with or without an event id on the row", async () => {
    expect((await run(ltChelsea("LT-77"), 90)).answer.status).toBe(200);
    expect((await run(ltChelsea(), 90)).answer.status).toBe(200);
    expect((await run(ltChelsea(), 50)).answer).toMatchObject({ status: 409, body: { error: "TICKET_CHANGED" } });
  });
});

describe("round 4 - the ticket the server keeps is an allowlist of fields", () => {
  it("a 50 KB description and an unknown key never reach the stored row or the ops email", () => {
    const raw = wire(full);
    const tickets = raw.tickets as Record<string, Record<string, unknown>>;
    const big = "X".repeat(50_000);
    const body = {
      ...raw,
      tickets: { ...tickets, "702": { ...tickets["702"], description: big, evil: "INJECTED-KEY", colorOnTheMap: "#f00" } },
    };
    const sub = parsed(body);
    expect(Object.keys(sub.tickets[702]).sort()).toEqual(
      ["category", "description", "id", "price", "quantity", "supplier", "zoneLabel"].sort(),
    );
    expect(sub.tickets[702].description).toBe("");
    const rows = buildGroupRows(sub, route, { group: GROUP, rateIls: RATE, settings: S, status: "24Save", gtmIdnts: null });
    const stored = JSON.stringify(rows[1].event_order_info);
    expect(stored).not.toContain("INJECTED-KEY");
    expect(stored).not.toContain("XXXXXXXX");
    expect(rows[1].event_order_info).not.toHaveProperty("evil");
    expect(rows[1].event_order_info).not.toHaveProperty("description");
    const { text } = tripOpsMail(
      tripMailInput({ sub, route, rows, ids: [1, 2], references: [null, null], price: priceOf(full), rateIls: RATE }),
    );
    expect(text).not.toContain("INJECTED-KEY");
    expect(text).not.toContain("XXXXXXXX");
  });

  it("keeps every field the reservation, the email and the checks use - a number id of the supplier's event as text", () => {
    const raw = wire(full);
    const tickets = raw.tickets as Record<string, Record<string, unknown>>;
    const sub = parsed({
      ...raw,
      tickets: {
        ...tickets,
        "702": { ...tickets["702"], vendor: "v", eid: 991, supplierCategory: "Cat 1", nonInstant: true, seatingChoice: "split" },
      },
    });
    expect(sub.tickets[702]).toEqual({
      id: "t702",
      category: "cat t702",
      price: 150,
      quantity: 2,
      description: "",
      vendor: "v",
      eid: "991",
      supplier: "static",
      supplierCategory: "Cat 1",
      zoneLabel: "zone t702",
      nonInstant: true,
      seatingChoice: "split",
    });
  });
});

describe("round 3 - a second 'the price changed' in a row is said on the summary", () => {
  it("the first bounces to the tickets; the second stays, with the refresh / WhatsApp words", () => {
    const first = confirmFailureAction(409, { error: "PRICE_CHANGED" }, full);
    expect(escalatePriceChange(first, 1)).toBe(first);
    expect(escalatePriceChange(first, 2)).toEqual({ kind: "stay", code: "PRICE_CHANGED", message: PRICE_STILL_CHANGING });
    expect(PRICE_STILL_CHANGING).toBe("המחיר עדיין משתנה - רעננו את הדף או דברו איתנו");
    // Any other answer is left as it is.
    const route = confirmFailureAction(400, { error: "ROUTE_CHANGED" }, full);
    expect(escalatePriceChange(route, 5)).toBe(route);
  });
});

describe("round 3 - an unreadable body answers the switch first", () => {
  const deps = (vercelEnv: string): ConfirmDeps => ({
    getSettings: async () => S,
    vercelEnv,
    now: () => NOW,
    getEvent: async () => undefined,
    validateTicket: async () => null,
    getRate: async () => RATE,
    groupDb: { insert: async () => ({ data: null, error: null }), find: async () => ({ data: [], error: null }) },
    offlineDb: { readBlocks: async () => ({ data: [], error: null }), readConsumed: async () => ({ data: null }), writeConsumed: async () => ({}) },
    finishRows: async () => [],
    sendEmails: async () => ({ ops: false, customer: false }),
    markEmailed: async () => {},
    track: async () => {},
    gtmIdnts: null,
    log: { warn: () => {}, error: () => {} },
  });

  it("switch off: 404; on: 400", async () => {
    expect(await confirmTrip(undefined, deps("production"))).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
    expect(await confirmTrip(undefined, deps("preview"))).toMatchObject({ status: 400, body: { error: "BAD_REQUEST" } });
  });
});

// ---------------------------------------------------------------------------------------------
// Fix round 5 - "the price changed" twice in a row means: for the same trip
// ---------------------------------------------------------------------------------------------

describe("round 5 - tripKey / notePriceAnswer", () => {
  const T0 = Date.parse("2026-10-22T10:00:00Z");
  const MIN = 60_000;
  const key = tripKey(full);
  const first = notePriceAnswer(NO_PRICE_CHANGES, key, true, T0);

  it("the same trip twice: the second is 'in a row' - it escalates", () => {
    expect(first.count).toBe(1);
    const second = notePriceAnswer(first, tripKey(full), true, T0 + 5 * MIN);
    expect(second.count).toBe(2);
    const action = confirmFailureAction(409, { error: "PRICE_CHANGED" }, full);
    expect(escalatePriceChange(action, second.count)).toMatchObject({ kind: "stay", message: PRICE_STILL_CHANGING });
  });

  it("the bounce's own changes are the same trip: fresh rows, another step, re-picked tickets / flight / hotels", () => {
    const bounced: ItineraryState = {
      ...full,
      step: "tickets",
      route: full.route.map((e) => ({ ...e, markup_ticket: 999 }) as Event),
      tickets: { 618: ticket("t618", 999), 702: ticket("t702", 999) },
      flight: null,
      hotels: {},
      activeEvent: 1,
    };
    expect(tripKey(bounced)).toBe(key);
  });

  it("another party: not in a row - the count starts again at 1 (no escalation)", () => {
    const next = notePriceAnswer(first, tripKey({ ...full, pax: 3 }), true, T0 + MIN);
    expect(next.count).toBe(1);
    expect(escalatePriceChange(confirmFailureAction(409, { error: "PRICE_CHANGED" }, full), next.count)).toMatchObject({
      kind: "go",
      step: "tickets",
    });
  });

  it("other dates (depart, return or a move day), another route or other train moves: not in a row", () => {
    const moveKey = Object.keys(full.dates.moves)[0];
    for (const other of [
      { ...full, dates: { ...full.dates, depart: "2027-05-10" } },
      { ...full, dates: { ...full.dates, ret: "2027-05-17" } },
      { ...full, dates: { ...full.dates, moves: { ...full.dates.moves, [moveKey]: "2027-05-14" } } },
      { ...full, route: [chelsea, celine] },
      { ...full, train: [moveKey] },
    ]) {
      expect(tripKey(other)).not.toBe(key);
      expect(notePriceAnswer(first, tripKey(other), true, T0 + MIN).count).toBe(1);
    }
    // The train moves' order does not make another trip.
    expect(tripKey({ ...full, train: ["b", "a"] })).toBe(tripKey({ ...full, train: ["a", "b"] }));
  });

  it("any other answer, a hold or no answer at all clears it; so does a gone event (the flow passes false)", () => {
    expect(notePriceAnswer(first, key, false, T0 + MIN)).toEqual(NO_PRICE_CHANGES);
    expect(notePriceAnswer(notePriceAnswer(first, key, false, T0 + MIN), key, true, T0 + 2 * MIN).count).toBe(1);
  });

  it("back after the draft's 30 minutes: the first again", () => {
    expect(notePriceAnswer(first, key, true, T0 + 30 * MIN).count).toBe(2);
    expect(notePriceAnswer(first, key, true, T0 + 31 * MIN).count).toBe(1);
  });
});

describe("m9 - isHeldAnswer reads the email status", () => {
  it("takes emailed true / false / absent, refuses anything else", () => {
    const base = { group: GROUP, ids: [1, 2], reference: "ME211" };
    expect(isHeldAnswer(base)).toBe(true);
    expect(isHeldAnswer({ ...base, emailed: true })).toBe(true);
    expect(isHeldAnswer({ ...base, emailed: false })).toBe(true);
    expect(isHeldAnswer({ ...base, emailed: "yes" })).toBe(false);
    expect(isHeldAnswer({ ...base, emailed: 1 })).toBe(false);
  });
});

describe("m6 - the hold's group id is reused only for a retry of the identical trip", () => {
  const total = priceOf(full).total;
  const sig = holdSignature(full, total);
  let n = 0;
  const makeId = () => `group-${++n}`;

  it("the first attempt gets a new group; the identical retry (double click, lost answer) the same one", () => {
    const a = holdAttempt(null, sig, makeId);
    expect(a.group).toMatch(/^group-/);
    // A copy of the same trip (another render, same picks) is the same request.
    const again = holdAttempt(a, holdSignature(JSON.parse(JSON.stringify(full)) as ItineraryState, total), makeId);
    expect(again).toBe(a);
  });

  it("an edited trip after a lost answer gets a NEW group - never the old trip's rows", () => {
    const a = holdAttempt(null, sig, makeId);
    const moveKey = Object.keys(full.dates.moves)[0];
    const edits: [string, ItineraryState, number][] = [
      ["party", { ...full, pax: 3 }, total],
      ["dates", { ...full, dates: { ...full.dates, ret: "2027-05-17" } }, total],
      ["train", { ...full, train: [moveKey] }, total],
      ["route", { ...full, route: [celine, coldplay] }, total],
      ["ticket", { ...full, tickets: { ...full.tickets, 702: ticket("vip702", 150) } }, total],
      // An offer id repeats across searches: the same id with another price or other legs is another flight.
      ["flight price", { ...full, flight: { ...flight, price: 1400 } as ItineraryFlight }, total],
      [
        "flight legs",
        { ...full, flight: { ...flight, legs: [legs[0], { ...legs[1], departureTime: "2027-05-13T18:05:00" }, legs[2]] } as ItineraryFlight },
        total,
      ],
      ["hotel", { ...full, hotels: { ...full.hotels, [londonStay.key]: hotel("l2", "602", "2027-05-13", "2027-05-16") } }, total],
      [
        "hotel rate",
        { ...full, hotels: { ...full.hotels, [londonStay.key]: hotel("l", "602", "2027-05-13", "2027-05-16", 2, { ...REFUNDABLE, match_hash: "bb" }) } },
        total,
      ],
      ["price", full, total + 40],
    ];
    for (const [what, state, t] of edits) {
      const next = holdAttempt(a, holdSignature(state, t), makeId);
      expect(next.group, what).not.toBe(a.group);
    }
  });

  it("what is not a pick stays the same request: the step, the open tab, the event rows' other fields", () => {
    const a = holdAttempt(null, sig, makeId);
    const same = { ...full, step: "tickets" as const, activeEvent: 1, activeStay: 1 };
    expect(holdAttempt(a, holdSignature(same, total), makeId)).toBe(a);
  });
});
