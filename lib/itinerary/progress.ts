/**
 * "Build Your Euro Trip" - where the flow stands and what the trip costs once every piece is
 * picked. Pure: no I/O, no clock.
 *
 * The live price is built from the pieces the live steps priced, per traveller, USD:
 * - tickets: each event's ticket price (the ticket step's live price; one ticket per traveller);
 * - flight: the offer's price for the whole party / the party (the flights step keeps the
 *   offer's grandTotal + any low-cost surcharge for every adult - lib/itinerary/flightOffers.ts);
 * - hotels: each stay's hotel per traveller by the regular summary's own rule (`hotelPerTraveller`);
 * - markups: `tierMarkups` (the dearest event in full, the next ones discounted).
 */
import type { Event, OrderHotel } from "@/lib/app.types";
import { getTotalMarkup } from "@/lib/events/price";
import { allTicketsReady } from "./adapter";
import { stays } from "./dates";
import { markupDiscount, tierMarkups } from "./price";
import type { ItinerarySettings } from "./settings";
import { MIN_TRIP_EVENTS, type ItineraryState } from "./state";
import { hotelGuests, stayHotelReady, stayRanges, withStayBase, type StayRange } from "./stayAdapter";

export type ItineraryProgress = { build: boolean; tickets: boolean; flights: boolean; hotels: boolean };

/**
 * May the flow leave each step?
 * - build: two events or more;
 * - tickets: every event has a ticket (an id) bought for the whole party;
 * - flights: a flight is set (the flights step sets it only once priced);
 * - hotels: every stay passes `stayHotelReady` - the hotels step's own rule (its nights under
 *   the trip's flight, booked for the party). No flight = no hotel dates = not ready.
 */
export function canContinue(state: ItineraryState): ItineraryProgress {
  const { route, dates, pax, flight } = state;
  const list = route.length ? stays(route, dates) : [];
  const ranges = stayRanges(route, dates, flight, new Set(state.train));
  return {
    build: route.length >= MIN_TRIP_EVENTS,
    tickets: allTicketsReady(route, state.tickets, pax),
    flights: !!flight,
    hotels: list.length > 0 && list.every((stay, i) => stayHotelReady(state.hotels[stay.key], ranges[i], pax)),
  };
}

/**
 * Tolerance of the "included in the package" band, per guest - the live summary's
 * `priceOutsidePackBoundaries` (app/order/order-review.utils.ts), same env and default.
 */
const PACK_BOUNDARY_USD = Number(process.env.NEXT_PUBLIC_BOUNDRIES || "4");

const cents = (n: number): number => Math.round(n * 100) / 100;

/**
 * One stay's hotel, per traveller - the regular summary's rule (useOrderVars in
 * app/order/hooks.tsx: `hotelPriceAddition + event.base_hotel_price`, per guest): the hotel's
 * price over its guests, unless that is within `PACK_BOUNDARY_USD` of the package base - then
 * the base. The base is the stay's own: the event's package base prorated to the stay's
 * nights (`withStayBase`, the base the hotels step prints its "כלול במחיר" against).
 * NaN when the hotel has no price or no guests.
 */
export function hotelPerTraveller(hotel: OrderHotel, event: Event, range: StayRange): number {
  const price = Number(hotel.price);
  const guests = hotelGuests(hotel);
  if (!Number.isFinite(price) || price <= 0 || guests <= 0) return Number.NaN;
  const base = Number(withStayBase(event, range).base_hotel_price) || 0;
  const perGuest = price / guests;
  return Math.abs(perGuest - base) > PACK_BOUNDARY_USD ? perGuest : base;
}

/** The summary's price box, USD. Lines per traveller (cents); the totals in whole dollars. */
export type LivePrice = {
  /** Σ ticket prices. */
  tickets: number;
  /** The flight's price / the party. */
  flight: number;
  /** Σ each stay's hotel per traveller. */
  hotels: number;
  /** Σ every event's markup in full ("שירות"). */
  service: number;
  /** What the trip takes off the markups ("הנחת מסלול") - `markupDiscount`. */
  discount: number;
  /** tickets + flight + hotels + service - discount, rounded UP like the live summary's "לאדם". */
  perTraveller: number;
  /** `perTraveller` × the party: the box's "סה״כ ל-N נוסעים". */
  total: number;
};

/**
 * The trip's live price, or null until every ticket, the flight and every hotel are in (and
 * each has a price that is a number). Rounding: the regular summary rounds its totals UP
 * (`Math.ceil` in `calculateBaseTotal` and in `getPrices`' per-person figure) - so does this,
 * once, on the per-traveller sum; the party's total is that figure times the party.
 */
export function livePrice(state: ItineraryState, s: ItinerarySettings): LivePrice | null {
  const ready = canContinue(state);
  if (!ready.build || !ready.tickets || !ready.flights || !ready.hotels || !state.flight) return null;
  const { route, dates, pax } = state;

  let tickets = 0;
  for (const e of route) tickets += Number(state.tickets[e.id]?.price);

  const flight = Number(state.flight.price) / pax;

  const ranges = stayRanges(route, dates, state.flight, new Set(state.train));
  let hotels = 0;
  stays(route, dates).forEach((stay, i) => {
    const h = state.hotels[stay.key];
    hotels += h ? hotelPerTraveller(h, stay.events[0], ranges[i]) : Number.NaN;
  });

  const service = route.reduce((sum, e) => sum + getTotalMarkup(e), 0);
  const tiered = [...tierMarkups(route, s).values()].reduce((sum, m) => sum + m, 0);
  if (![tickets, flight, hotels, service, tiered].every(Number.isFinite)) return null;

  const perTraveller = Math.ceil(cents(tickets + flight + hotels + tiered));
  return {
    tickets: cents(tickets),
    flight: cents(flight),
    hotels: cents(hotels),
    service: cents(service),
    discount: markupDiscount(route, s),
    perTraveller,
    total: perTraveller * pax,
  };
}

/** The trip's price per traveller, whole dollars - null until every piece is picked. */
export function livePerTraveller(state: ItineraryState, s: ItinerarySettings): number | null {
  return livePrice(state, s)?.perTraveller ?? null;
}
