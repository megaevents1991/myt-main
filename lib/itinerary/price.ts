/**
 * "Build Your Euro Trip" - tiered markup and the trip's price estimate. Pure: no I/O, no clock.
 *
 * All money is USD per traveller. The trip is one package: the markup of the dearest event is
 * charged in full, the next one's is cut by `tier2Pct`, the third's by `tier3Pct` (spec §6).
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
 * Without an Amadeus quote the trip's flight is estimated from the events' own package flights:
 * one open-jaw trip is cheaper than the sum of the round trips each package assumes.
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

/** The share of its markup an event pays, by its rank in the trip (0 = the dearest). */
function tierFactor(rank: number, s: ItinerarySettings): number {
  if (rank <= 0) return 1;
  const pct = rank === 1 ? s.tier2Pct : s.tier3Pct; // a 4th event would pay the last tier
  return 1 - pct / 100;
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
  return new Map(ranked.map(({ e, markup }, rank) => [e.id, cents(markup * tierFactor(rank, s))]));
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
 * The trip's price per traveller, in whole dollars, and what buying the same events one by one
 * would cost (`separate`).
 *
 * - tickets: each event's cheapest ticket on sale;
 * - flight: `estFlightUsd` when the page has a quote, else 60% of the events' package flights;
 * - hotel: per stay, the nightly rate of the stay's FIRST event's package (its base hotel price
 *   over the nights that package assumes) times the stay's nights in this trip;
 * - markup: tiered (`tierMarkups`).
 *
 * `saving` = separate - perTraveller, only when it is at least $50 (else null: no savings line).
 */
export function estimateItinerary(
  route: Event[],
  d: TripDates,
  s: ItinerarySettings,
  estFlightUsd: number | null,
): { perTraveller: number; separate: number; saving: number | null } {
  const tickets = route.reduce((sum, e) => sum + usd(cheapestAvailableTicketPrice(e.tickets_and_rates)), 0);

  const flight =
    estFlightUsd ?? FLIGHT_FALLBACK_SHARE * route.reduce((sum, e) => sum + usd(e.base_flight_price), 0);

  const hotel = stays(route, d).reduce((sum, stay) => {
    const first = stay.events[0];
    const nightly = usd(first.base_hotel_price) / packageNights(first);
    const nights = dayDiff(stay.from, stay.to); // NaN for a draft without dates: no hotel yet
    return sum + (Number.isFinite(nights) ? nightly * Math.max(0, nights) : 0);
  }, 0);

  const markup = [...tierMarkups(route, s).values()].reduce((sum, m) => sum + m, 0);

  const perTraveller = Math.round(tickets + flight + hotel + markup);
  const separate = Math.round(route.reduce((sum, e) => sum + usd(computePackagePrice(e)), 0));
  const diff = separate - perTraveller;
  return { perTraveller, separate, saving: diff >= MIN_SAVING_USD ? diff : null };
}
