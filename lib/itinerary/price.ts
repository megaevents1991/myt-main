/**
 * "Build Your Euro Trip" - tiered markup and the trip's price estimate. Pure: no I/O, no clock.
 *
 * All money is USD per traveller. The trip is one package: the markup of the dearest event is
 * charged in full, the next one's is cut by `tier2Pct`, the third's by `tier3Pct`.
 * The estimate is a PRICE-FROM figure for the builder's summary - the real flight and hotel
 * prices come from the order flow's own searches; this only has the events' package bases.
 */
import type { Event } from "@/lib/app.types";
import {
  cheapestAvailableTicketPrice,
  computePackagePrice,
  getTotalMarkup,
} from "@/lib/events/price";
import { stays } from "./dates";
import { dayDiff, eventDay } from "./geo";
import type { ItinerarySettings } from "./settings";
import type { TripDates } from "./types";

/**
 * Without a flight quote the trip's flight is estimated as this share of the events' own
 * package flights (each package prices its own flight).
 *
 * Measured 24.10.2026: 13 hub trips searched on Amadeus as the flights step searches them
 * (multi-city, default dates, 2 adults). The flight the step puts first ("הטוב ביותר",
 * `pickBestFlight`) cost a median 0.62 of Σ base_flight_price per traveller (12 of 13 between
 * 0.29 and 0.84; one 1.93, the only all-nonstop offer); the cheapest, a median 0.50. Pairs ran
 * higher than triples (~0.71 vs ~0.55: a triple's two same-city events add a base, not a leg).
 * The hub card says "מחיר ממוצע", so the share follows the first flight, not the cheapest.
 */
const FLIGHT_FALLBACK_SHARE = 0.6;

/** The saving is told to the customer only from this many dollars up. */
const MIN_SAVING_USD = 50;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const cents = (n: number): number => Math.round(n * 100) / 100;

/** A price field as a number: a missing / broken value counts as 0. */
const usd = (v: number | null | undefined): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** An event's markup after its rank's discount (0 = the dearest, full). */
function tiered(markup: number, rank: number, s: ItinerarySettings): number {
  if (rank <= 0) return markup;
  const pct = rank === 1 ? s.tier2Pct : s.tier3Pct; // a 4th event would pay the last tier
  return (markup * (100 - pct)) / 100; // not markup * (1 - pct / 100): no float error on a fractional pct
}

/**
 * Each event's markup in the trip, keyed by event id. Ranked by markup, dearest first (a tie:
 * the earlier date first), so a cheap first event never lowers the discount of the dear ones.
 * Cents.
 */
export function tierMarkups(route: Event[], s: ItinerarySettings): Map<number, number> {
  const ranked = route
    .map((e) => ({ e, markup: getTotalMarkup(e) }))
    .sort(
      (x, y) =>
        y.markup - x.markup ||
        eventDay(x.e).localeCompare(eventDay(y.e)) ||
        x.e.id - y.e.id,
    );
  return new Map(ranked.map(({ e, markup }, rank) => [e.id, cents(tiered(markup, rank, s))]));
}

/** What the trip saves on markups against buying every event on its own: Σ full − Σ tiered. */
export function markupDiscount(route: Event[], s: ItinerarySettings): number {
  const full = route.reduce((sum, e) => sum + getTotalMarkup(e), 0);
  const tiered = [...tierMarkups(route, s).values()].reduce((sum, m) => sum + m, 0);
  return cents(full - tiered);
}

/** Nights of the stay the event's own package assumes (`def_date_depart` -> `def_date_return`), at least 1. */
function packageNights(e: Event): number {
  const from = e.def_date_depart?.slice(0, 10);
  const to = e.def_date_return?.slice(0, 10);
  if (!from || !to || !DAY_RE.test(from) || !DAY_RE.test(to)) return 1;
  return Math.max(1, dayDiff(from, to));
}

/**
 * The event's package hotel, per traveller per night: its base hotel price over the nights its
 * own package assumes. What the estimate prices a stay with, and what the hotels step's
 * "included" line is measured against for the nights it searches (lib/itinerary/stayAdapter.ts).
 */
export function nightlyHotelBase(e: Event): number {
  return usd(e.base_hotel_price) / packageNights(e);
}

/**
 * The estimate's pieces, per traveller, USD - what `estimateItinerary` sums, and what the
 * builder's running price (`progressivePrice`, lib/itinerary/progress.ts) falls back to for a
 * piece the customer has not picked yet:
 * - tickets: each event's cheapest ticket on sale, in route order;
 * - flight: `estFlightUsd` when the page has a (finite) quote, else 60% of the events' package flights;
 * - stays: per stay (`stays(route, d)` order), the nightly rate of its FIRST event's package (its
 *   base hotel price over the nights that package assumes) times the stay's nights in this trip;
 * - markup: Σ tiered markups (`tierMarkups`).
 */
export type EstimateParts = { tickets: number[]; flight: number; stays: number[]; markup: number };

export function estimateParts(route: Event[], d: TripDates, s: ItinerarySettings, estFlightUsd: number | null): EstimateParts {
  const tickets = route.map((e) => usd(cheapestAvailableTicketPrice(e.tickets_and_rates)));

  // A quote that is not a finite number (NaN / Infinity) is no quote: the fallback prices the flight.
  const quote = estFlightUsd !== null && Number.isFinite(estFlightUsd) ? estFlightUsd : null;
  const flight = quote ?? FLIGHT_FALLBACK_SHARE * route.reduce((sum, e) => sum + usd(e.base_flight_price), 0);

  const stayPrices = stays(route, d).map((stay) => {
    const nightly = nightlyHotelBase(stay.events[0]);
    const nights = dayDiff(stay.from, stay.to); // NaN for a draft without dates: no hotel yet
    return Number.isFinite(nights) ? nightly * Math.max(0, nights) : 0;
  });

  const markup = [...tierMarkups(route, s).values()].reduce((sum, m) => sum + m, 0);
  return { tickets, flight, stays: stayPrices, markup };
}

/**
 * The trip's price per traveller, in whole dollars, and what buying the same events one by one
 * would cost (`separate`).
 *
 * - tickets: each event's cheapest ticket on sale;
 * - flight: `estFlightUsd` when the page has a (finite) quote, else 60% of the events' package flights;
 * - hotel: per stay, the nightly rate of the stay's FIRST event's package (its base hotel price
 *   over the nights that package assumes) times the stay's nights in this trip;
 * - markup: tiered (`tierMarkups`).
 *
 * `saving` = separate - perTraveller, only for a trip of two events or more and when it is at
 * least $50 (else null: no savings line).
 */
export function estimateItinerary(
  route: Event[],
  d: TripDates,
  s: ItinerarySettings,
  estFlightUsd: number | null,
): { perTraveller: number; separate: number; saving: number | null } {
  const parts = estimateParts(route, d, s, estFlightUsd);
  const tickets = parts.tickets.reduce((sum, t) => sum + t, 0);
  const { flight, markup } = parts;
  const hotel = parts.stays.reduce((sum, h) => sum + h, 0);

  const perTraveller = Math.round(tickets + flight + hotel + markup);
  const separate = Math.round(route.reduce((sum, e) => sum + usd(computePackagePrice(e)), 0));
  const diff = separate - perTraveller;
  // Nothing is saved on one event: its "saving" would only be the estimate's own error.
  const saving = route.length >= 2 && diff >= MIN_SAVING_USD ? diff : null;
  return { perTraveller, separate, saving };
}
