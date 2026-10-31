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
 *
 * Server-safe (no window, no JSX): the itinerary's confirm route (Task A15) rebuilds the trip's
 * state from what was submitted and calls the SAME `livePrice` - its `total` is the party's
 * charge in USD.
 */
import type { Event, OrderHotel } from "@/lib/app.types";
import { getTotalMarkup } from "@/lib/events/price";
import { allTicketsReady, ticketReady } from "./adapter";
import { stays } from "./dates";
import { estimateParts, markupDiscount, tierMarkups, type EstimateParts } from "./price";
import type { ItinerarySettings } from "./settings";
import { MIN_TRIP_EVENTS, type ItineraryState } from "./state";
import { hotelGuests, skippedStayPerTraveller, stayHotelReady, stayRanges, withStayBase, type StayRange } from "./stayAdapter";

export type ItineraryProgress = { build: boolean; tickets: boolean; flights: boolean; hotels: boolean };

/**
 * May the flow leave each step?
 * - build: two events or more;
 * - tickets: every event has a ticket (an id) bought for the whole party;
 * - flights: a flight is set (the flights step sets it only once priced), searched for the
 *   trip's party (`numOfTravelers === pax` - the offer's price is for that many);
 * - hotels: every stay passes `stayHotelReady` - the hotels step's own rule (its nights under
 *   the trip's flight, booked for the party) - or needs no hotel ("לא צריך מלון"). No flight = no
 *   hotel dates = not ready.
 */
export function canContinue(state: ItineraryState): ItineraryProgress {
  const { route, dates, pax, flight } = state;
  const list = route.length ? stays(route, dates) : [];
  const ranges = stayRanges(route, dates, flight, new Set(state.train));
  return {
    build: route.length >= MIN_TRIP_EVENTS,
    tickets: allTicketsReady(route, state.tickets, pax),
    flights: !!flight && flight.numOfTravelers === pax,
    hotels:
      !!flight &&
      list.length > 0 &&
      list.every((stay, i) => state.skippedStays.includes(stay.key) || stayHotelReady(state.hotels[stay.key], ranges[i], pax)),
  };
}

/**
 * Tolerance of the "included in the package" band, per guest - the live summary's
 * `priceOutsidePackBoundaries` (app/order/order-review.utils.ts), same env and default.
 */
export const PACK_BOUNDARY_USD = Number(process.env.NEXT_PUBLIC_BOUNDRIES || "4");

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

/** How long the summary holds the trip: the regular summary's `TIMEOUT` (app/order/utils.ts), 15 minutes. */
export const SUMMARY_HOLD_SECONDS = 15 * 60;

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
  /** `total` / the party, rounded UP - the live summary's "(לאדם)" (`getPrices`, app/order/utils.ts). */
  perTraveller: number;
  /**
   * The party's charge: (tickets + hotels + tiered markups) × the party + the flight's price,
   * rounded UP once - the live `calculateBaseTotal` (app/order/hooks.tsx). The box's
   * "סה״כ ל-N נוסעים".
   */
  total: number;
};

/**
 * The trip's live price, or null until every ticket, the flight (for the party) and every hotel
 * are in (and each has a price that is a number). Rounding is the regular summary's: the
 * party's total is rounded UP once (`Math.ceil` in `calculateBaseTotal`), and the price per
 * traveller is that total over the party, rounded UP (`getPrices`).
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
    if (state.skippedStays.includes(stay.key)) {
      hotels += skippedStayPerTraveller(stay.events[0], ranges[i]);
      return;
    }
    const h = state.hotels[stay.key];
    hotels += h ? hotelPerTraveller(h, stay.events[0], ranges[i]) : Number.NaN;
  });

  const service = route.reduce((sum, e) => sum + getTotalMarkup(e), 0);
  const tiered = [...tierMarkups(route, s).values()].reduce((sum, m) => sum + m, 0);
  if (![tickets, flight, hotels, service, tiered].every(Number.isFinite)) return null;

  // The party's sum from the pieces as charged: the flight's own price (not its share × pax).
  const total = Math.ceil(cents((tickets + hotels + tiered) * pax + Number(state.flight.price)));
  return {
    tickets: cents(tickets),
    flight: cents(flight),
    hotels: cents(hotels),
    service: cents(service),
    discount: markupDiscount(route, s),
    perTraveller: Math.ceil(total / pax),
    total,
  };
}

/** The trip's price per traveller, whole dollars - null until every piece is picked. */
export function livePerTraveller(state: ItineraryState, s: ItinerarySettings): number | null {
  return livePrice(state, s)?.perTraveller ?? null;
}

/**
 * Each piece's estimate, per traveller - what `progressivePrice` counts for a piece the customer
 * has not picked yet (`estimateParts` with no flight quote). The summary's rows are each picked
 * piece against its own estimate here (`summaryAdditions`, lib/itinerary/summaryRows.ts).
 */
export function pieceEstimates(state: Pick<ItineraryState, "route" | "dates">, s: ItinerarySettings): EstimateParts {
  return estimateParts(state.route, state.dates, s, null);
}

/**
 * The trip's price while it is being built - the continue bar's figure and the summary's estimate
 * box until `livePrice` has every piece (then `livePrice` is THE number; on a complete trip this
 * gives exactly the same). Each piece the customer picked counts at its own price, each piece not
 * picked yet at the estimate's (`estimateParts`):
 * - a ticket picked for the party (`ticketReady`): its price, else the event's cheapest on sale;
 * - the flight, once picked for the party: its price for the whole party, else the estimate's
 *   flight per traveller × the party;
 * - a stay whose hotel is ready (`stayHotelReady`): `hotelPerTraveller`, else the stay's estimate;
 * - the tiered markups (`tierMarkups`).
 * The live rounding: the party's sum rounded UP once, the price per traveller = that total over
 * the party, rounded UP. A piece whose price is not a number counts at the estimate.
 */
export function progressivePrice(
  state: ItineraryState,
  s: ItinerarySettings,
): Pick<LivePrice, "perTraveller" | "total"> {
  const { route, dates, pax, flight } = state;
  if (!route.length || !(pax > 0)) return { perTraveller: 0, total: 0 };
  const est = pieceEstimates(state, s);

  let tickets = 0;
  route.forEach((e, i) => {
    const t = state.tickets[e.id];
    const picked = ticketReady(t, pax) ? Number(t?.price) : Number.NaN;
    tickets += Number.isFinite(picked) ? picked : est.tickets[i];
  });

  // The party's flight as charged: the offer's own price (not its share × pax), like livePrice.
  const pickedFlight = flight && flight.numOfTravelers === pax ? Number(flight.price) : Number.NaN;
  const flightParty = Number.isFinite(pickedFlight) ? pickedFlight : est.flight * pax;

  const ranges = stayRanges(route, dates, flight, new Set(state.train));
  let hotels = 0;
  stays(route, dates).forEach((stay, i) => {
    if (state.skippedStays.includes(stay.key)) {
      hotels += skippedStayPerTraveller(stay.events[0], ranges[i]);
      return;
    }
    const h = state.hotels[stay.key];
    const per = h && stayHotelReady(h, ranges[i], pax) ? hotelPerTraveller(h, stay.events[0], ranges[i]) : Number.NaN;
    hotels += Number.isFinite(per) ? per : (est.stays[i] ?? 0);
  });

  const total = Math.ceil(cents((tickets + hotels + est.markup) * pax + flightParty));
  return { perTraveller: Math.ceil(total / pax), total };
}

/**
 * The tickets step's next sub-step: the first event after the open one whose ticket is not ready
 * for the party (`ticketReady`), else the first before it. -1 = every other event has its ticket
 * (on to the flights). The open event is not counted: its own ticket is what the step's button
 * waits for.
 */
export function nextOpenEvent(state: Pick<ItineraryState, "route" | "tickets" | "pax" | "activeEvent">): number {
  const { route, tickets, pax } = state;
  if (!route.length) return -1;
  const active = Math.min(Math.max(0, state.activeEvent), route.length - 1);
  const open = (i: number) => i !== active && !ticketReady(tickets[route[i].id], pax);
  const all = route.map((_, i) => i);
  return all.find((i) => i > active && open(i)) ?? all.find(open) ?? -1;
}
