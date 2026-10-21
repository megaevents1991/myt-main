import { describe, expect, it } from "vitest";
import type { Event, FlightSegment, ItineraryFlight, OrderHotel, OrderTicket } from "../app.types";
import { defaultTripDates, stays } from "../itinerary/dates";
import { markupDiscount, tierMarkups } from "../itinerary/price";
import {
  SUMMARY_HOLD_SECONDS,
  canContinue,
  hotelPerTraveller,
  livePerTraveller,
  livePrice,
} from "../itinerary/progress";
import { DEFAULT_ITINERARY_SETTINGS as S } from "../itinerary/settings";
import { INITIAL_ITINERARY_STATE, itineraryReducer, type ItineraryState } from "../itinerary/state";

type City = { latitude: number; longitude: number; name: string; city_iata: string };

const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז, צרפת", city_iata: "PAR" };
const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון, בריטניה", city_iata: "LON" };

/**
 * A partial event: what the dates, stays and prices read. The markup is set through
 * `markup_ticket` (composed pricing), so the test never depends on NEXT_PUBLIC_MARKUP.
 * Its own package: 4 nights (01/01 -> 05/01) at a base of $400 = $100 a night.
 */
const ev = (id: number, name: string, date: string, city: City, markup: number) =>
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
  }) as unknown as Event;

const celine = ev(618, "סלין דיון", "2027-05-12", PARIS, 175);
const chelsea = ev(702, "צ'לסי - אברטון", "2027-05-15", LONDON, 250);
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
});

// TLV -> CDG lands 11/05 09:55, CDG -> LHR leaves 13/05, LHR -> TLV leaves 16/05:
// the Paris stay is 11/05-13/05 (2 nights), the London stay 13/05-16/05 (3 nights).
const legs = [
  seg("TLV", "CDG", "2027-05-11T05:40:00", "2027-05-11T09:55:00"),
  seg("CDG", "LHR", "2027-05-13T13:05:00", "2027-05-13T13:25:00"),
  seg("LHR", "TLV", "2027-05-16T22:40:00", "2027-05-17T05:20:00"),
];
/** $1,300 for the party of two (the offer's grandTotal + any surcharge), as the flights step keeps it. */
const flight = {
  id: "offer-1",
  airline: "LY",
  price: 1300,
  numOfTravelers: 2,
  outbound: legs[0],
  inbound: legs[2],
  legs,
  trainLegs: [],
} as unknown as ItineraryFlight;

const ticket = (id: string, price: number, quantity = 2) =>
  ({ id, category: `cat ${id}`, price, quantity }) as unknown as OrderTicket;

const hotel = (id: string, price: string, checkin: string, checkout: string, adults = 2) =>
  ({
    id,
    name: `Hotel ${id}`,
    address: "1 Rue",
    price,
    rate: { match_hash: id },
    guests: [{ adults, children: [] }],
    checkin,
    checkout,
    hotelInformation: { hotelName: `Hotel ${id}`, roomName: "Double", stars: 4, amenities: [], distance: 1 },
  }) as unknown as OrderHotel;

const [parisStay, londonStay] = stays(route, dates);
// Paris: $900 for two = $450 a guest, far off the stay's base ($100 x 2 nights = $200).
const parisHotel = hotel("p", "900", "2027-05-11", "2027-05-13");
// London: $602 for two = $301 a guest, within $4 of the stay's base ($100 x 3 = $300): the base.
const londonHotel = hotel("l", "602", "2027-05-13", "2027-05-16");

const base: ItineraryState = { ...INITIAL_ITINERARY_STATE, route, dates, pax: 2 };
const withTickets: ItineraryState = {
  ...base,
  tickets: { 618: ticket("t618", 210), 702: ticket("t702", 150) },
};
const withFlight: ItineraryState = { ...withTickets, flight };
const full: ItineraryState = {
  ...withFlight,
  hotels: { [parisStay.key]: parisHotel, [londonStay.key]: londonHotel },
};

describe("canContinue - each stage of the flow", () => {
  it("an empty builder can go nowhere", () => {
    expect(canContinue(INITIAL_ITINERARY_STATE)).toEqual({ build: false, tickets: false, flights: false, hotels: false });
  });

  it("build: two events or more", () => {
    expect(canContinue({ ...base, route: [celine], dates: defaultTripDates([celine]) }).build).toBe(false);
    expect(canContinue(base).build).toBe(true);
  });

  it("tickets: every event has a ticket with an id, for the whole party", () => {
    expect(canContinue(base).tickets).toBe(false);
    expect(canContinue({ ...base, tickets: { 618: ticket("t618", 210) } }).tickets).toBe(false);
    expect(canContinue(withTickets).tickets).toBe(true);
    // A quantity changed in one tab: the other event is not ready for the new party.
    expect(canContinue({ ...withTickets, pax: 3 }).tickets).toBe(false);
    expect(canContinue({ ...withTickets, tickets: { ...withTickets.tickets, 702: ticket("", 150) } }).tickets).toBe(false);
  });

  it("flights: a flight is set, searched for the trip's party", () => {
    expect(canContinue(withTickets).flights).toBe(false);
    expect(canContinue(withFlight).flights).toBe(true);
    // An offer priced for three is not the price of a party of two.
    const forThree = { ...flight, numOfTravelers: 3 } as ItineraryFlight;
    expect(canContinue({ ...withFlight, flight: forThree }).flights).toBe(false);
  });

  it("hotels: every stay passes the hotels step's own rule (its nights under the flight, the party)", () => {
    expect(canContinue(withFlight).hotels).toBe(false);
    expect(canContinue({ ...withFlight, hotels: { [parisStay.key]: parisHotel } }).hotels).toBe(false);
    expect(canContinue(full).hotels).toBe(true);
    // Moved to other nights in the step's date picker.
    const moved = hotel("l", "602", "2027-05-13", "2027-05-17");
    expect(canContinue({ ...full, hotels: { ...full.hotels, [londonStay.key]: moved } }).hotels).toBe(false);
    // Sized for another party in the step's rooms popover.
    const three = hotel("l", "602", "2027-05-13", "2027-05-16", 3);
    expect(canContinue({ ...full, hotels: { ...full.hotels, [londonStay.key]: three } }).hotels).toBe(false);
    // No flight, no hotel dates: nothing is ready.
    expect(canContinue({ ...full, flight: null }).hotels).toBe(false);
  });
});

describe("hotelPerTraveller - the regular summary's rule (useOrderVars' hotelPriceAddition + base)", () => {
  it("off the stay's base by more than $4 a guest: the hotel's own price per guest", () => {
    expect(hotelPerTraveller(parisHotel, celine, ["2027-05-11", "2027-05-13"])).toBe(450);
  });

  it("within $4 of the stay's base (the package nights' base prorated to the stay): the base", () => {
    expect(hotelPerTraveller(londonHotel, chelsea, ["2027-05-13", "2027-05-16"])).toBe(300);
    expect(hotelPerTraveller(hotel("l", "608", "2027-05-13", "2027-05-16"), chelsea, ["2027-05-13", "2027-05-16"])).toBe(300);
    expect(hotelPerTraveller(hotel("l", "610", "2027-05-13", "2027-05-16"), chelsea, ["2027-05-13", "2027-05-16"])).toBe(305);
  });

  it("divides by the hotel's guests (children have a bed too)", () => {
    const four = { ...parisHotel, price: "1600", guests: [{ adults: 2, children: [5, 7] }] } as unknown as OrderHotel;
    expect(hotelPerTraveller(four, celine, ["2027-05-11", "2027-05-13"])).toBe(400);
  });
});

describe("livePerTraveller", () => {
  it("is null until every ticket, the flight and every hotel are in", () => {
    expect(livePerTraveller(base, S)).toBeNull();
    expect(livePerTraveller(withTickets, S)).toBeNull();
    expect(livePerTraveller(withFlight, S)).toBeNull();
    // One hotel missing.
    expect(livePerTraveller({ ...withFlight, hotels: { [parisStay.key]: parisHotel } }, S)).toBeNull();
    // A ticket bought for another party size.
    expect(livePerTraveller({ ...full, tickets: { ...full.tickets, 702: ticket("t702", 150, 3) } }, S)).toBeNull();
    // A flight priced for another party size.
    expect(livePerTraveller({ ...full, flight: { ...flight, numOfTravelers: 3 } as ItineraryFlight }, S)).toBeNull();
  });

  it("the live summary's rounding: the party's total up once, then the price per traveller up", () => {
    // tickets 210 + 150 = 360; flight 1300 / 2 = 650; hotels 450 + 300 = 750;
    // markups: 250 in full (the dearest) + 175 x 70% = 122.5 -> 372.5. Exact: 2132.5 a traveller,
    // 4265 for the party (no rounding needed) -> $4,265; per traveller ceil(4265 / 2) = $2,133.
    expect([...tierMarkups(route, S).values()].reduce((a, b) => a + b, 0)).toBe(372.5);
    expect(livePrice(full, S)?.total).toBe(4265);
    expect(livePerTraveller(full, S)).toBe(2133);
  });

  it("an uneven flight share is never rounded before the party's total", () => {
    // A party of three: the $1,000.01 flight is charged once, not as 3 x 333.34.
    const three: ItineraryState = {
      ...full,
      pax: 3,
      tickets: { 618: ticket("t618", 100, 3), 702: ticket("t702", 100, 3) },
      flight: { ...flight, price: 1000.01, numOfTravelers: 3 } as ItineraryFlight,
      hotels: {
        [parisStay.key]: hotel("p", "900", "2027-05-11", "2027-05-13", 3),
        [londonStay.key]: hotel("l", "1200", "2027-05-13", "2027-05-16", 3),
      },
    };
    // (200 tickets + 300 + 400 hotels + 372.5 markups) x 3 = 3817.5, + 1000.01 = 4817.51 -> 4818;
    // per traveller ceil(4818 / 3) = 1606.
    expect(livePrice(three, S)).toMatchObject({ total: 4818, perTraveller: 1606 });
  });

  it("the price box's lines: the service is the full markups, the trip's discount is markupDiscount", () => {
    const p = livePrice(full, S);
    expect(p).toEqual({
      tickets: 360,
      flight: 650,
      hotels: 750,
      service: 425,
      discount: markupDiscount(route, S),
      perTraveller: 2133,
      total: 4265,
    });
    expect(p?.discount).toBe(52.5);
    expect(p ? p.tickets + p.flight + p.hotels + p.service - p.discount : 0).toBe(2132.5);
  });

  it("follows the settings' tiers", () => {
    // 175 x 50% = 87.5 instead of 122.5: 35 less a traveller -> 4195 for two -> 2097.5 -> 2098.
    expect(livePrice(full, { ...S, tier2Pct: 50 })).toMatchObject({ total: 4195, perTraveller: 2098 });
  });

  it("a ticket or a hotel whose price is not a number prices nothing", () => {
    const broken = { ...full, tickets: { ...full.tickets, 618: ticket("t618", Number.NaN) } };
    expect(livePerTraveller(broken, S)).toBeNull();
    const noPrice = { ...full, hotels: { ...full.hotels, [parisStay.key]: { ...parisHotel, price: "" } } };
    expect(livePerTraveller(noPrice as ItineraryState, S)).toBeNull();
  });
});

describe("the summary's 15-minute hold", () => {
  it("lasts the regular summary's 15 minutes", () => {
    expect(SUMMARY_HOLD_SECONDS).toBe(15 * 60);
  });

  it("running out releases every priced piece and keeps the trip's shape", () => {
    const held = { ...full, step: "summary" as const, train: [] };
    const out = itineraryReducer(held, { type: "releaseHold" });
    expect(out.tickets).toEqual({});
    expect(out.flight).toBeNull();
    expect(out.hotels).toEqual({});
    expect(out).toMatchObject({ route, dates, pax: 2, step: "summary", mode: held.mode });
    expect(livePerTraveller(out, S)).toBeNull();
    expect(canContinue(out)).toEqual({ build: true, tickets: false, flights: false, hotels: false });
  });

  it("nothing left to release: the same state back", () => {
    expect(itineraryReducer(base, { type: "releaseHold" })).toBe(base);
  });
});
