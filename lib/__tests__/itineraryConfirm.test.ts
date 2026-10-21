import { describe, expect, it } from "vitest";
import type { Event, FlightSegment, ItineraryFlight, OrderHotel, OrderTicket } from "../app.types";
import {
  UUID_V4_RE,
  buildGroupRows,
  checkDates,
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
    // To pay, every traveller's name is required.
    expect(parseSubmission({ ...raw, payNow: true }, 3).ok).toBe(false);
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
      date: "2027-05-15T20:00:00",
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
    expect(rows[1].event_order_info).toMatchObject({ own_stock: true, date: "2027-05-15T20:00:00" });
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
    // Fewer rows back than sent.
    const short = await insertGroup(rows, db({ insert: async () => ({ data: [{ id: 1, itinerary_seq: 1 }], error: null }) }));
    expect(short).toHaveProperty("error");
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
