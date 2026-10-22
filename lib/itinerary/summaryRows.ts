/**
 * "Build Your Euro Trip" - the summary's row figures ("+$X" / "-$X" / "כלול במחיר"), the live
 * summary's `eventTicketPriceAddition` / `flightPriceAddition` / `hotelPriceAddition` for a trip.
 * Pure: no I/O, no clock.
 *
 * Each row is the picked piece per traveller minus THAT piece's estimate in `progressivePrice`
 * (`pieceEstimates`): the trip's estimate + the rows = the live price. Inside the live band
 * (`PACK_BOUNDARY_USD`, ±$4 a traveller) a row is 0 - "כלול במחיר". A hotel is counted by the
 * live price's own rule (`hotelPerTraveller`: within the band of its stay's base, the base).
 */
import { stays } from "./dates";
import { PACK_BOUNDARY_USD, hotelPerTraveller, livePrice, pieceEstimates } from "./progress";
import type { ItinerarySettings } from "./settings";
import type { ItineraryState } from "./state";
import { stayRanges } from "./stayAdapter";

/** Per traveller, USD: by event id, the flight, by `Stay.key`. */
export type SummaryAdditions = {
  tickets: Record<number, number>;
  flight: number;
  hotels: Record<string, number>;
};

const cents = (n: number): number => Math.round(n * 100) / 100;

/** A row's figure: 0 inside the band, else the difference (cents). */
const outsideBand = (diff: number): number => (Math.abs(diff) <= PACK_BOUNDARY_USD ? 0 : cents(diff));

/**
 * The summary's rows, or null until every piece is picked (`livePrice` is null) - before that
 * there is no picked piece to measure.
 */
export function summaryAdditions(state: ItineraryState, s: ItinerarySettings): SummaryAdditions | null {
  const { route, dates, pax, flight } = state;
  if (!flight || !livePrice(state, s)) return null;
  const est = pieceEstimates(state, s);

  const tickets: Record<number, number> = {};
  route.forEach((e, i) => {
    tickets[e.id] = outsideBand(Number(state.tickets[e.id]?.price) - est.tickets[i]);
  });

  const ranges = stayRanges(route, dates, flight, new Set(state.train));
  const hotels: Record<string, number> = {};
  stays(route, dates).forEach((stay, i) => {
    const h = state.hotels[stay.key];
    hotels[stay.key] = h ? outsideBand(hotelPerTraveller(h, stay.events[0], ranges[i]) - (est.stays[i] ?? 0)) : 0;
  });

  return { tickets, flight: outsideBand(Number(flight.price) / pax - est.flight), hotels };
}
