/**
 * "Build Your Euro Trip" - the hotels step's side of the live hotel step. Pure: no I/O, no clock.
 *
 * The trip renders the order flow's own `HotelSelection` (app/order/HotelSelection.tsx,
 * unchanged) once per stay, inside its own `HotelFetchProvider` and an `OrderContext.Provider`
 * whose value the trip builds (components/euro-trip/build/orderContextAdapter.ts). The step
 * takes its dates from the order's flight with the live rule (`getDefaultDateRange`: check-in =
 * the day the outbound lands, the evening before when it lands before 08:00; check-out = the
 * day the inbound leaves) - so each stay hands it a Flight whose outbound is the way INTO that
 * city and whose inbound is the way OUT of it. These are those values.
 */
import dayjs from "dayjs";
import type { Event, Flight, FlightSegment, ItineraryFlight, OrderHotel } from "@/lib/app.types";
import type { LodgingCity } from "@/lib/events/lodging";
import { getDefaultDateRange } from "@/lib/getDefaultDateRange";
import { moves, stays, tripLegs } from "./dates";
import type { TripDates } from "./types";

/**
 * The event as the stay's hotel step sees it: lodging in the stay's city alone. Only that
 * city is offered and there is no split, so the step's "איפה ישנים?" line renders nothing
 * (a split inside a stay is not in phase 1) and its search runs around the stay point.
 */
export function stayEvent(e: Event, city: LodgingCity): Event {
  return { ...e, lodging_mode: city === "event" ? "event_city_only" : "flight_city", lodging_default: city };
}

/**
 * A move made on the ground - by train, or between two stays under one flight city (a
 * Manchester match slept in Manchester next to a London event): no flight lands or leaves,
 * so the stay changes on the move's day. Noon, so the early-landing rule never moves it.
 */
function groundSegment(day: string, from: string, to: string): FlightSegment {
  const at = `${day}T12:00:00`;
  return {
    departureTime: at,
    arrivalTime: at,
    departureAirport: from,
    arrivalAirport: to,
    stops: [],
    duration: "0",
    checkBagsIncluded: false,
    cabinBagsIncluded: false,
  };
}

/**
 * The Flight the hotel step of stay `stayIndex` reads: `outbound` = the way into the stay (the
 * trip's first leg for the first stay), `inbound` = the way out (the last leg for the last).
 *
 * `flight.legs` holds one segment per FLOWN leg, in the order of `tripLegs(route, d, train)`;
 * a move is found there by its key. A move with no flown leg (by train, or under one flight
 * city) is a ground segment on its day. When the offer's legs do not line up with the trip's
 * flown legs (never for an offer the flights step kept for these dates and toggles), no move
 * borrows another move's flight: every move reads its own day.
 */
export function stayFlight(
  stayIndex: number,
  flight: ItineraryFlight,
  route: Event[],
  d: TripDates,
  train: ReadonlySet<string>,
): Flight {
  // A plain Flight: the trip's legs and train moves are not the step's business.
  const { legs, trainLegs, ...base } = flight;
  void trainLegs;
  const list = stays(route, d);
  const ms = moves(route);
  const flown = tripLegs(route, d, train);
  const aligned = legs.length === flown.length;
  const last = Math.max(0, list.length - 1);
  const k = Math.min(Math.max(0, Math.trunc(stayIndex) || 0), last);

  /** Move `i` (from stay i to stay i + 1): its flown leg, else the ground on its day. */
  const across = (i: number): FlightSegment => {
    const m = ms[i];
    const j = aligned ? flown.findIndex((l) => l.key === m.key) : -1;
    if (j >= 0 && legs[j]) return legs[j];
    return groundSegment(list[i].to, m.a.location?.city_iata ?? "", m.b.location?.city_iata ?? "");
  };

  return {
    ...base,
    outbound: k === 0 || !ms[k - 1] ? flight.outbound : across(k - 1),
    inbound: k === last || !ms[k] ? flight.inbound : across(k),
  };
}

/** The range the live step opens on for this event + flight, `YYYY-MM-DD` - formatted as the step formats it. */
export function stayHotelRange(event: Event, flight: Flight): [string, string] {
  const [checkin, checkout] = getDefaultDateRange(event, flight);
  return [dayjs(checkin).format("YYYY-MM-DD"), dayjs(checkout).format("YYYY-MM-DD")];
}

/**
 * Is the hotel booked for these nights? The step's date picker lets a customer move them;
 * in a trip that leaves nights without a bed or two beds for one night. No hotel = nothing to say.
 */
export function hotelOnStayDates(hotel: OrderHotel | undefined, range: [string, string]): boolean {
  if (!hotel) return true;
  return String(hotel.checkin ?? "").slice(0, 10) === range[0] && String(hotel.checkout ?? "").slice(0, 10) === range[1];
}

/**
 * The same pick, written again? The step's selected card commits its rate whenever the
 * card's callback changes identity - every render of the provider above it - so an
 * unchanged pick must not be stored again (each store re-renders the trip, which re-renders
 * the provider: a loop).
 */
export function sameHotel(a: OrderHotel | undefined, b: OrderHotel | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * What the hotel step reads from the order's context for one stay: the stay's event, its
 * flight, its hotel, the trip's party - and a plain one-hotel visit in every other respect
 * (no split, no skipped flight, no summary edit, no ready or locked package, no person-page
 * link). `hotelSegments` / `splitNights` are the order layout's own "single hotel" (null).
 */
export function stayAdapterFields(i: {
  event: Event;
  city: LodgingCity;
  flight: Flight | undefined;
  hotel: OrderHotel | undefined;
  pax: number;
}): {
  event: Event;
  flight: Flight | undefined;
  hotel: OrderHotel | undefined;
  numberOfEventTickets: number;
  planeTickets: { adults: number; children: number };
  lodgingCity: LodgingCity;
  flightSkipped: false;
  returnToSummary: false;
  packageLocked: false;
  readyPackage: undefined;
  personLink: undefined;
  hotelSegments: null;
  splitNights: null;
} {
  return {
    event: i.event,
    flight: i.flight,
    hotel: i.hotel,
    numberOfEventTickets: i.pax,
    // The step rooms the party by the flight's travellers (getRoomParams) - the trip's party.
    planeTickets: { adults: i.pax, children: 0 },
    lodgingCity: i.city,
    flightSkipped: false,
    returnToSummary: false,
    packageLocked: false,
    readyPackage: undefined,
    personLink: undefined,
    hotelSegments: null,
    splitNights: null,
  };
}
