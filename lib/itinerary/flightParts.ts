/**
 * "Build Your Euro Trip" - the trip's flights, cut into parts (Dor 31.10: "כמו שפירקנו את
 * הכרטיסים"): the way there and back - `הלוך חזור`, TLV -> first city + last city -> TLV - and one
 * part per move between two flight cities (`מעבר 1`, `מעבר 2`). Each part is searched and picked on
 * its own, in the regular flow's look; together they are the trip's ONE flight (`composeFlight`).
 * A move the customer makes alone (`train`) has no search and no pick. Pure: no I/O, no clock.
 *
 * Types only from `./flightOffers` (it loads `aircodes`, ~2 MB the browser never needs).
 */
import type { Event, ItineraryFlight } from "@/lib/app.types";
import { trainLegs, tripLegs } from "./dates";
import type { FlightLeg } from "./flightOffers";
import type { TripLeg } from "./types";
import type { TripDates } from "./types";

/** The part that flies out and home. */
export const MAIN_PART = "main";

export type FlightPart = {
  /** `MAIN_PART`, or the move's key (`TripDates.moves`). */
  key: string;
  kind: "main" | "move";
  /** What one search of this part asks for: two legs, or the move's one. */
  legs: FlightLeg[];
  /** The customer makes this move alone: no flight to search or pick. */
  byTrain: boolean;
};

const legOf = ({ from, to, date }: TripLeg): FlightLeg => ({ from, to, date });

/** The trip's parts, in trip order: `הלוך חזור`, then every move between two flight cities. */
export function flightPartsOf(route: Event[], dates: TripDates, train: ReadonlySet<string>): FlightPart[] {
  const all = tripLegs(route, dates, new Set());
  if (all.length < 2) return [];
  const main: FlightPart = { key: MAIN_PART, kind: "main", legs: [legOf(all[0]), legOf(all[all.length - 1])], byTrain: false };
  const mids = all.flatMap((l): FlightPart[] =>
    l.kind === "mid" && l.key ? [{ key: l.key, kind: "move", legs: [legOf(l)], byTrain: train.has(l.key) }] : [],
  );
  return [main, ...mids];
}

/** This pick still answers this part: for the party, a flight per leg, each on its leg's day. */
export function pickFits(part: FlightPart, flight: ItineraryFlight | undefined, pax: number): flight is ItineraryFlight {
  if (!flight || flight.numOfTravelers !== pax || flight.legs?.length !== part.legs.length) return false;
  return part.legs.every((l, i) => String(flight.legs[i].departureTime).slice(0, 10) === l.date);
}

/** The part needs nothing more from the customer: it has its flight, or is made alone. */
export function partDone(part: FlightPart, picks: Record<string, ItineraryFlight | undefined>, pax: number): boolean {
  return part.byTrain || pickFits(part, picks[part.key], pax);
}

/** The picks that still answer their part on these dates (the others are searched again). */
export function fittingPicks(
  parts: FlightPart[],
  picks: Record<string, ItineraryFlight | undefined>,
  pax: number,
): Record<string, ItineraryFlight | undefined> {
  const out: Record<string, ItineraryFlight | undefined> = {};
  for (const p of parts) if (pickFits(p, picks[p.key], pax)) out[p.key] = picks[p.key];
  return out;
}

/**
 * The trip's one flight, or null until every part it flies has its pick: `legs` = one per FLOWN leg
 * in trip order (`tripLegs` - the hotels' nights and the server's check hang on that), the price =
 * the parts' prices for the whole party, the moves' own offers kept for sales (`moveFlights`).
 */
export function composeFlight(
  route: Event[],
  dates: TripDates,
  train: ReadonlySet<string>,
  pax: number,
  picks: Record<string, ItineraryFlight | undefined>,
): ItineraryFlight | null {
  const parts = flightPartsOf(route, dates, train);
  if (!parts.length || !parts.every((p) => partDone(p, picks, pax))) return null;
  const main = picks[MAIN_PART];
  if (!main) return null;
  const mids = parts.flatMap((p) => {
    const f = p.kind === "move" && !p.byTrain ? picks[p.key] : undefined;
    return f ? [f] : [];
  });
  const legs = [main.legs[0], ...mids.map((f) => f.legs[0]), main.legs[1]];
  const price = [main, ...mids].reduce((sum, f) => sum + Number(f.price), 0);
  return {
    ...main,
    id: [main, ...mids].map((f) => f.id).join("+"),
    price: Math.round(price * 100) / 100,
    outbound: legs[0],
    inbound: legs[legs.length - 1],
    legs,
    trainLegs: trainLegs(route, dates, train).map((t) => ({ from: t.fromName, to: t.toName, date: t.date })),
    ...(mids.length ? { moveFlights: mids } : {}),
  };
}
