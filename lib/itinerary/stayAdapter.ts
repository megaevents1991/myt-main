/**
 * "Build Your Euro Trip" - the hotels step's side of the live hotel step. Pure: no I/O, no clock.
 *
 * The trip renders the order flow's own `HotelSelection` (app/order/HotelSelection.tsx,
 * unchanged) once per stay, inside its own `HotelFetchProvider` and an `OrderContext.Provider`
 * whose value the trip builds (components/euro-trip/build/orderContextAdapter.ts). The step
 * takes its dates from the order's flight with the live rule (`getDefaultDateRange`: check-in =
 * the day the outbound lands, the evening before when it lands before 08:00; check-out = the
 * day the inbound leaves) - so each stay hands it a Flight whose outbound is the way INTO that
 * city and whose inbound is the way OUT of it. These are those values, and the one rule for
 * "this stay has its hotel" (`stayHotelReady`) that the step, the flow and the summary share.
 */
import dayjs from "dayjs";
import type { Event, Flight, FlightSegment, ItineraryFlight, OrderHotel } from "@/lib/app.types";
import type { LodgingCity } from "@/lib/events/lodging";
import { getDefaultDateRange, trustedArrival } from "@/lib/getDefaultDateRange";
import type { Guest } from "@/lib/hotel.type";
import { moves, stays, tripLegs } from "./dates";
import { dayDiff } from "./geo";
import { nightlyHotelBase } from "./price";
import type { TripDates } from "./types";

/** Check-in / check-out of one stay, `YYYY-MM-DD`. */
export type StayRange = [string, string];

/**
 * The event as the stay's hotel step sees it: lodging in the stay's city alone. Only that
 * city is offered and there is no split, so the step's "איפה ישנים?" line renders nothing
 * (a split inside a stay is not in phase 1) and its search runs around the stay point.
 */
export function stayEvent(e: Event, city: LodgingCity): Event {
  return { ...e, lodging_mode: city === "event" ? "event_city_only" : "flight_city", lodging_default: city };
}

/**
 * The stay event with its package hotel base for the nights the step prices. The live step
 * prints every rate against `event.base_hotel_price` ("כלול במחיר" / "+$X לאורח" / "חסכון"),
 * the base of the event's OWN package nights; a stay has its own nights, so the base is
 * prorated: the package's nightly base (`nightlyHotelBase`) times the stay's nights.
 */
export function withStayBase(e: Event, range: StayRange): Event {
  const nights = Math.max(0, dayDiff(range[0], range[1]) || 0);
  return { ...e, base_hotel_price: Math.round(nightlyHotelBase(e) * nights * 100) / 100 };
}

/**
 * A segment the hotel step reads as "the stay changes on this day": noon, so the early-landing
 * rule never moves it. For a move made on the ground - by train, or between two stays under one
 * flight city (a Manchester match slept in Manchester next to a London event) - and for a move
 * flight's arrival (`moveCheckinDay`).
 */
function daySegment(day: string, from: string, to: string): FlightSegment {
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

const localDay = (d: Date): string => dayjs(d).format("YYYY-MM-DD");

/**
 * The day a move flight checks the trip in to its next city: the later of its takeoff day and
 * the day the live rule gives its landing. The live "lands before 08:00 = the evening before"
 * is for the overnight flight from home; on a move the customer slept in the previous city that
 * night (its stay runs to the move day), so a dawn flight checks in on its own day - while an
 * overnight move that lands after 08:00 the next day checks in on the landing day, as live.
 */
function moveCheckinDay(seg: FlightSegment, fallback: string): string {
  const takeoff = new Date(seg.departureTime);
  const takeoffDay = Number.isNaN(takeoff.getTime()) ? fallback : localDay(takeoff);
  const arrival = trustedArrival(seg.departureTime, seg.arrivalTime);
  if (!arrival) return takeoffDay;
  const ruled = new Date(arrival);
  if (ruled.getHours() < 8) ruled.setDate(ruled.getDate() - 1);
  const ruleDay = localDay(ruled);
  return ruleDay > takeoffDay ? ruleDay : takeoffDay;
}

/**
 * The Flight the hotel step of stay `stayIndex` reads: `outbound` = the way into the stay,
 * `inbound` = the way out.
 *
 * - The first stay's outbound is the trip's first leg as it is (the live rule, early landing
 *   included); the last stay's inbound is the trip's last leg (check-out = its takeoff day).
 * - A later stay's outbound is a day segment on `moveCheckinDay` of the flight into it - or,
 *   with no flight (by train, or under one flight city), on the move's day.
 * - A stay's inbound before the last is the move flight out of it (check-out = its takeoff
 *   day), or the move's day.
 *
 * `flight.legs` holds one segment per FLOWN leg, in the order of `tripLegs(route, d, train)`;
 * a move is found there by its key. When the offer's legs do not line up with the trip's flown
 * legs (never for an offer the flights step kept for these dates and toggles), no move borrows
 * another move's flight: every move reads its own day.
 */
export function stayFlight(
  stayIndex: number,
  flight: ItineraryFlight,
  route: Event[],
  d: TripDates,
  train: ReadonlySet<string>,
): Flight {
  // A plain Flight: the trip's legs and train moves are not the step's business.
  const { legs: rawLegs, trainLegs, ...base } = flight;
  void trainLegs;
  const legs = rawLegs ?? [];
  const list = stays(route, d);
  const ms = moves(route);
  const flown = tripLegs(route, d, train);
  const aligned = legs.length === flown.length;
  const last = Math.max(0, list.length - 1);
  const k = Math.min(Math.max(0, Math.trunc(stayIndex) || 0), last);

  /** The flight of move `i` (from stay i to stay i + 1), when it is flown. */
  const flightOf = (i: number): FlightSegment | undefined => {
    const j = aligned ? flown.findIndex((l) => l.key === ms[i].key) : -1;
    return j >= 0 ? legs[j] : undefined;
  };
  const ground = (i: number) =>
    daySegment(list[i].to, ms[i].a.location?.city_iata ?? "", ms[i].b.location?.city_iata ?? "");

  const into = (i: number): FlightSegment => {
    const leg = flightOf(i);
    return leg ? daySegment(moveCheckinDay(leg, list[i].to), leg.departureAirport, leg.arrivalAirport) : ground(i);
  };
  const outOf = (i: number): FlightSegment => flightOf(i) ?? ground(i);

  return {
    ...base,
    outbound: k === 0 || !ms[k - 1] ? flight.outbound : into(k - 1),
    inbound: k === last || !ms[k] ? flight.inbound : outOf(k),
  };
}

/** The range the live step opens on for this event + flight, `YYYY-MM-DD` - formatted as the step formats it. */
export function stayHotelRange(event: Event, flight: Flight): StayRange {
  const [checkin, checkout] = getDefaultDateRange(event, flight);
  return [localDay(checkin), localDay(checkout)];
}

/**
 * Every stay's range under this flight, in the order of `stays(route, d)`; none without a
 * flight (the hotels' dates come from it).
 */
export function stayRanges(
  route: Event[],
  d: TripDates,
  flight: ItineraryFlight | null,
  train: ReadonlySet<string>,
): StayRange[] {
  if (!flight) return [];
  return stays(route, d).map((stay, i) =>
    stayHotelRange(stayEvent(stay.events[0], stay.city), stayFlight(i, flight, route, d, train)),
  );
}

/**
 * Is the hotel booked for these nights? The step's date picker lets a customer move them;
 * in a trip that leaves nights without a bed or two beds for one night. No hotel = nothing to say.
 */
export function hotelOnStayDates(hotel: OrderHotel | undefined, range: StayRange): boolean {
  if (!hotel) return true;
  return String(hotel.checkin ?? "").slice(0, 10) === range[0] && String(hotel.checkout ?? "").slice(0, 10) === range[1];
}

/**
 * How many people the hotel is booked for (children count: every traveller has a bed). The
 * live step's own sum (`getTotalPersons`, lib/price.utils.tsx) - repeated here because that
 * file holds JSX, which this pure, vitest-tested module cannot load.
 */
export function hotelGuests(hotel: OrderHotel | undefined): number {
  const rooms: Guest[] = hotel?.guests ?? [];
  return rooms.reduce((n, room) => n + (room.children?.length ?? 0) + (room.adults ?? 0), 0);
}

/**
 * The stay has its hotel: one is picked, for the stay's nights under the trip's flight
 * (`range`; none = no flight) and for the trip's party. THE rule for the tab's ✓, the step's
 * continue gate and the summary - a hotel moved to other nights or sized for another party in
 * the live step (its date picker / rooms popover) is not ready until it is put back.
 */
export function stayHotelReady(hotel: OrderHotel | undefined, range: StayRange | undefined, pax: number): boolean {
  return !!hotel && !!range && hotelOnStayDates(hotel, range) && hotelGuests(hotel) === pax;
}

/**
 * The stays' hotels under a new flight: a hotel stays only while it is still on its stay's
 * nights under that flight (an earlier or later landing can move a check-in by a day). The
 * same object back when every hotel stays.
 */
export function hotelsForFlight(
  route: Event[],
  d: TripDates,
  train: ReadonlySet<string>,
  hotels: Record<string, OrderHotel | undefined>,
  flight: ItineraryFlight,
): Record<string, OrderHotel | undefined> {
  if (!Object.keys(hotels).length) return hotels;
  const ranges = stayRanges(route, d, flight, train);
  const list = stays(route, d);
  const kept: Record<string, OrderHotel> = {};
  let dropped = false;
  for (const [key, h] of Object.entries(hotels)) {
    if (!h) continue;
    const i = list.findIndex((s) => s.key === key);
    if (i >= 0 && hotelOnStayDates(h, ranges[i])) kept[key] = h;
    else dropped = true;
  }
  return dropped ? kept : hotels;
}

/**
 * The same pick, written again? The step writes its pick from more than one place (the
 * search's auto-pick, then the selected card's commit), often with nothing new: a write that
 * changes nothing is not stored, so it does not re-render the whole trip.
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
 * link). `hotelSegments` / `splitNights` / `readyPackage` are the order layout's own "none" (null).
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
  readyPackage: null;
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
    readyPackage: null,
    personLink: undefined,
    hotelSegments: null,
    splitNights: null,
  };
}
