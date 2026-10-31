/**
 * "Build Your Euro Trip" - the summary's row figures ("+$X" / "-$X" / "כלול במחיר"), the live
 * summary's `eventTicketPriceAddition` / `flightPriceAddition` / `hotelPriceAddition` for a trip.
 * Pure: no I/O, no clock.
 *
 * The trip's estimate + the rows = the live price. Each row is per traveller, 0 inside the live
 * band (`PACK_BOUNDARY_USD`, ±$4 a traveller) - "כלול במחיר":
 * - a ticket: its price against its estimate in `progressivePrice` (`pieceEstimates`);
 * - a hotel: the hotels step's own figure - the hotel per guest (`hotelPerTraveller`) against its
 *   stay's base for the nights it books under the flight (`withStayBase` over `stayRanges`), so
 *   the summary and the hotels step (SegmentsList) never disagree on the same hotel;
 * - the flight: its price per traveller against its estimate, plus the night shift the flight's
 *   times make - each stay's base under the flight against the estimate's stay (an outbound that
 *   lands before 08:00 books the evening before: a night more than the trip's stay).
 */
import { stays } from "./dates";
import { PACK_BOUNDARY_USD, hotelPerTraveller, livePrice, pieceEstimates } from "./progress";
import type { ItinerarySettings } from "./settings";
import type { ItineraryState } from "./state";
import { stayRanges, withStayBase } from "./stayAdapter";

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
  let nightShift = 0;
  stays(route, dates).forEach((stay, i) => {
    const h = state.hotels[stay.key];
    const range = ranges[i];
    if (!h || !range || state.skippedStays.includes(stay.key)) {
      hotels[stay.key] = 0;
      return;
    }
    const base = Number(withStayBase(stay.events[0], range).base_hotel_price) || 0;
    hotels[stay.key] = outsideBand(hotelPerTraveller(h, stay.events[0], range) - base);
    nightShift += base - (est.stays[i] ?? 0);
  });

  return { tickets, flight: outsideBand(Number(flight.price) / pax - est.flight + nightShift), hotels };
}
