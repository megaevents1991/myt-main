/**
 * "Build Your Euro Trip" - "טיסות ישירות בלבד" on the way there and back (Alon 09.11: "לבדוק באמדאוס
 * אם 2 כיוונים יאפשרו לנו להציע טיסות ישירות בשני הכיוונים"; Dor 09.11: "בוא נגדיר כן טיסות ישירות
 * בלבד").
 *
 * Amadeus filters a search to non-stop flights, but one search only answers what ONE ticket can
 * hold. Measured 09.11 (2 travellers): out to Düsseldorf and home from London it found no direct
 * flight at all, while each way searched alone had them ($237 + $333 a traveller); out to Madrid and
 * home from Barcelona one ticket was $567 a traveller, two one-ways $450. So the filter runs three
 * non-stop searches - the round trip, the way out, the way home - and lists both: the one-ticket
 * flights and pairs of one-way flights, each pair two tickets (`ItineraryFlight.oneWays`).
 *
 * Pure: no I/O. Browser-safe (types only from the app).
 */
import type { Flight, FlightSegment, ItineraryFlight } from "@/lib/app.types";
import type { SearchOutcome } from "./flightsView";

/** The cheapest flights of each way that are paired (12 x 12 = 144 cards at most). */
export const PAIR_SIDE_MAX = 12;

const cents = (n: number): number => Math.round(n * 100) / 100;

const isDirect = (f: ItineraryFlight): boolean => f.legs.every((l) => (l.stops?.length ?? 1) <= 1);

/** The flight a card stands for: its legs' flight numbers and departures. */
const flightKey = (legs: FlightSegment[]): string =>
  legs.map((l) => `${l.flightNumber ?? ""}@${String(l.departureTime).slice(0, 16)}`).join("|");

const cheapestFirst = (flights: ItineraryFlight[]): ItineraryFlight[] => [...flights].sort((a, b) => a.price - b.price);

/** A one-way flight as it rides inside a pair: its own offer and price, no trip fields. */
function ticketOf(f: ItineraryFlight): Flight {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the trip fields are dropped, the rest is the ticket
  const { legs, trainLegs, moveFlights, oneWays, ...ticket } = f;
  return ticket;
}

/** Two one-way flights as one round trip: out's card fields, home's leg as the inbound, both offers kept. */
export function pairFlight(out: ItineraryFlight, home: ItineraryFlight): ItineraryFlight {
  const outLeg = out.legs[0];
  const homeLeg = home.legs[0];
  return {
    ...ticketOf(out),
    id: `ow:${out.id}+${home.id}`,
    price: cents(Number(out.price) + Number(home.price)),
    stops: 0,
    outbound: outLeg,
    inbound: homeLeg,
    legs: [outLeg, homeLeg],
    trainLegs: [],
    oneWays: [ticketOf(out), ticketOf(home)],
  };
}

/**
 * Every pair of a direct way out and a direct way home, cheapest `PAIR_SIDE_MAX` of each way. Only
 * one-leg answers for the same party; ids say which search each half came from.
 */
export function pairOneWays(outs: ItineraryFlight[], homes: ItineraryFlight[], pax: number): ItineraryFlight[] {
  const side = (list: ItineraryFlight[]) =>
    cheapestFirst(list.filter((f) => f.legs?.length === 1 && f.numOfTravelers === pax && isDirect(f))).slice(0, PAIR_SIDE_MAX);
  const a = side(outs);
  const b = side(homes);
  return a.flatMap((o) => b.map((h) => pairFlight(o, h)));
}

/**
 * The direct-only list: the round trip's own non-stop flights, then every pair of one-ways that is
 * not the same two flights at the same price or more (one ticket wins a tie - a missed connection
 * between two tickets is the traveller's risk). Nothing with a stop gets in.
 */
export function directOnlyFlights(
  roundTrip: ItineraryFlight[],
  outs: ItineraryFlight[],
  homes: ItineraryFlight[],
  pax: number,
): ItineraryFlight[] {
  const one = roundTrip.filter((f) => f.legs?.length === 2 && isDirect(f));
  const best = new Map<string, number>();
  for (const f of one) {
    const k = flightKey(f.legs);
    best.set(k, Math.min(best.get(k) ?? Infinity, Number(f.price)));
  }
  const pairs = pairOneWays(outs, homes, pax).filter((p) => !(Number(p.price) >= (best.get(flightKey(p.legs)) ?? Infinity)));
  return [...one, ...pairs];
}

/**
 * The three non-stop searches' answers as one: the cards of `directOnlyFlights`. Throttled anywhere
 * = busy (the step retries the three once). No card: a refused search is "invalid", a failed one
 * "error" (it may have held the only direct flight), else "empty" - there is no direct flight.
 */
export function directOutcome(
  roundTrip: SearchOutcome,
  out: SearchOutcome,
  home: SearchOutcome,
  pax: number,
): SearchOutcome {
  const all = [roundTrip, out, home];
  if (all.some((o) => o.kind === "busy")) return { kind: "busy" };
  const list = (o: SearchOutcome) => (o.kind === "ok" ? o.flights : []);
  const flights = directOnlyFlights(list(roundTrip), list(out), list(home), pax);
  if (flights.length) return { kind: "ok", flights };
  if (all.some((o) => o.kind === "invalid")) return { kind: "invalid" };
  if (all.some((o) => o.kind === "error")) return { kind: "error" };
  return { kind: "empty" };
}

/** The airline of every leg of the trip's flight, in leg order: a pair's halves and the moves' own. */
export function legAirlines(f: ItineraryFlight): string[] {
  const name = (x: Flight): string => x.metadata?.name || x.airline || "";
  const [out, home] = f.oneWays ?? [f, f];
  const mids = f.moveFlights ?? [];
  return (f.legs ?? []).map((_, i, all) => name(i === 0 ? out : i === all.length - 1 ? home : (mids[i - 1] ?? f)));
}

/** The airline(s) a part's flight is shown under: "El Al", or "Arkia · Wizz Air" for a pair. */
export function airlineLabel(f: Flight & { oneWays?: [Flight, Flight] }): string {
  const name = (x: Flight): string => x.metadata?.name || x.airline || "";
  const names = (f.oneWays ?? [f]).map(name).filter(Boolean);
  return [...new Set(names)].join(" · ");
}
