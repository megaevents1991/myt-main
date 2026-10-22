import { describe, expect, it } from "vitest";
import type { Event, FlightSegment, ItineraryFlight, OrderHotel, OrderTicket } from "../app.types";
import { defaultTripDates, stays } from "../itinerary/dates";
import { livePrice, progressivePrice } from "../itinerary/progress";
import { DEFAULT_ITINERARY_SETTINGS as S } from "../itinerary/settings";
import { INITIAL_ITINERARY_STATE, type ItineraryState } from "../itinerary/state";
import { summaryAdditions } from "../itinerary/summaryRows";

type City = { latitude: number; longitude: number; name: string; city_iata: string };

const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז, צרפת", city_iata: "PAR" };
const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון, בריטניה", city_iata: "LON" };

/**
 * The fixtures of itineraryProgress.test.ts: a package of 4 nights at a base of $400 ($100 a
 * night), a $500 package flight, the markup through `markup_ticket` - and a cheapest ticket on
 * sale, the ticket's estimate.
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
    tickets_and_rates: [{ id: `c${id}`, category: "A", price: cheapest, available: true }],
  }) as unknown as Event;

// Estimates: Céline's ticket from $120, Chelsea's from $90; the flight 0.6 x (500 + 500) = $600
// a traveller; the Paris stay $100 x 2 nights, the London stay $100 x 3 nights.
const celine = ev(618, "סלין דיון", "2027-05-12", PARIS, 175, 120);
const chelsea = ev(702, "צ'לסי - אברטון", "2027-05-15", LONDON, 250, 90);
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

const legs = [
  seg("TLV", "CDG", "2027-05-11T05:40:00", "2027-05-11T09:55:00"),
  seg("CDG", "LHR", "2027-05-13T13:05:00", "2027-05-13T13:25:00"),
  seg("LHR", "TLV", "2027-05-16T22:40:00", "2027-05-17T05:20:00"),
];
/** $1,300 for the party of two = $650 a traveller, $50 over the estimate. */
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
// Paris: $900 for two = $450 a guest against the stay's $200.
const parisHotel = hotel("p", "900", "2027-05-11", "2027-05-13");
// London: $602 for two = $301 a guest, within $4 of the stay's $300.
const londonHotel = hotel("l", "602", "2027-05-13", "2027-05-16");

const full: ItineraryState = {
  ...INITIAL_ITINERARY_STATE,
  route,
  dates,
  pax: 2,
  // Céline at $210 ($90 over its $120), Chelsea at $92 ($2 over its $90 - inside the band).
  tickets: { 618: ticket("t618", 210), 702: ticket("t702", 92) },
  flight,
  hotels: { [parisStay.key]: parisHotel, [londonStay.key]: londonHotel },
};

describe("summaryAdditions - the summary's rows: the picked piece against its estimate, per traveller", () => {
  it("a ticket above its estimate shows the difference per traveller", () => {
    const rows = summaryAdditions(full, S);
    expect(rows?.tickets[618]).toBe(90);
    // $2 over: within the band - "כלול במחיר".
    expect(rows?.tickets[702]).toBe(0);
    // Below its estimate by more than the band: a saving.
    const cheaper = summaryAdditions({ ...full, tickets: { ...full.tickets, 702: ticket("t702", 80) } }, S);
    expect(cheaper?.tickets[702]).toBe(-10);
  });

  it("a hotel within 4 dollars of its base shows 0", () => {
    const rows = summaryAdditions(full, S);
    expect(rows?.hotels[londonStay.key]).toBe(0);
    // $304 a guest is still the base; $306 is its own price - $6 over.
    const at304 = { ...full, hotels: { ...full.hotels, [londonStay.key]: hotel("l", "608", "2027-05-13", "2027-05-16") } };
    expect(summaryAdditions(at304, S)?.hotels[londonStay.key]).toBe(0);
    const at306 = { ...full, hotels: { ...full.hotels, [londonStay.key]: hotel("l", "612", "2027-05-13", "2027-05-16") } };
    expect(summaryAdditions(at306, S)?.hotels[londonStay.key]).toBe(6);
    // Paris: $450 a guest against $200.
    expect(rows?.hotels[parisStay.key]).toBe(250);
  });

  it("the flight: the party's price per traveller against the estimate's flight", () => {
    expect(summaryAdditions(full, S)?.flight).toBe(50);
    const near = { ...full, flight: { ...flight, price: 1206 } as ItineraryFlight };
    expect(summaryAdditions(near, S)?.flight).toBe(0);
  });

  it("null before every piece is picked", () => {
    expect(summaryAdditions({ ...full, hotels: { [parisStay.key]: parisHotel } }, S)).toBeNull();
    expect(summaryAdditions({ ...full, flight: null }, S)).toBeNull();
    expect(summaryAdditions({ ...full, tickets: { 618: ticket("t618", 210) } }, S)).toBeNull();
    expect(livePrice({ ...full, hotels: {} }, S)).toBeNull();
  });

  it("the estimate plus the rows is the live price (outside the band's rounding)", () => {
    // No piece inside the band here, so the identity is exact.
    const exact: ItineraryState = { ...full, tickets: { ...full.tickets, 702: ticket("t702", 150) } };
    const rows = summaryAdditions(exact, S);
    const live = livePrice(exact, S);
    const estimate = progressivePrice({ ...exact, tickets: {}, flight: null, hotels: {} }, S);
    expect(rows && live).toBeTruthy();
    if (!rows || !live) return;
    const perTraveller =
      Object.values(rows.tickets).reduce((a, b) => a + b, 0) +
      rows.flight +
      Object.values(rows.hotels).reduce((a, b) => a + b, 0);
    expect(estimate.total + perTraveller * exact.pax).toBe(live.total);
  });
});
