/**
 * "Build Your Euro Trip" - the flights step, pure parts: the sort tabs, the price badge, the
 * train copy, the rows of a card, the search request / answer and the priced flight. No I/O,
 * no clock (the caller passes today).
 *
 * Client-side: only TYPES come from `./flightOffers` (it loads `aircodes`, ~2 MB of airline
 * data the browser never needs). `canSearch` repeats that file's `validateFlightRequest` rules
 * so the step never sends a search the route would refuse; a test keeps the two in step.
 */
import type { FlightSegment, ItineraryFlight } from "@/lib/app.types";
import { dayMonth } from "./builder";
import type { FlightLeg } from "./flightOffers";
import type { TrainLeg, TripLeg } from "./types";

/** Cards rendered before "הצג עוד" (a search can bring ~250 offers). */
export const FLIGHTS_PAGE = 20;
/** Under this many km between two stays the step suggests the train. */
export const TRAIN_HINT_KM = 600;
/** Within this many USD a traveller of the base, a flight is "included" (the live FlightTicketCard's band). */
export const INCLUDED_BAND_USD = 4;
/** The "ישראלי" tab: El Al, Arkia, Israir. */
export const ISRAELI_CARRIERS: ReadonlySet<string> = new Set(["LY", "IZ", "6H"]);

export type FlightSort = "best" | "cheapest" | "israeli";

// ---------------------------------------------------------------------------------------------
// Train copy
// ---------------------------------------------------------------------------------------------

/** An honest city-centre to city-centre time: km / 170 + half an hour, one decimal. */
export const trainHours = (km: number): string => (km / 170 + 0.5).toFixed(1);

const kmText = (km: number): string => km.toLocaleString("en-US");

/** "אגיע ברכבת (343 ק״מ)" - the switch under a between-cities flight. */
export const trainToggleLabel = (km: number): string => `אגיע ברכבת (${kmText(km)} ק״מ)`;

/** The row a move by train shows in place of its flight. */
export function trainRowText(t: TrainLeg): { title: string; detail: string } {
  return {
    title: `${t.fromName} ← ${t.toName} ברכבת`,
    detail: `${dayMonth(t.date)} · כ-${trainHours(t.km)} שעות · בכוחות עצמכם, לא כלול`,
  };
}

/** A move between two stays: their names and the km between them. */
export type TrainHop = Pick<TrainLeg, "fromName" | "toName" | "km">;

/**
 * The callout over the list when a flown move is short enough for a train (under
 * `TRAIN_HINT_KM`): every such hop named, null when there is none.
 */
export function trainCallout(hops: TrainHop[]): { lead: string; text: string } | null {
  const short = hops.filter((h) => h.km < TRAIN_HINT_KM);
  if (!short.length) return null;
  const lines = short.map(
    (h) =>
      `${h.fromName}–${h.toName} זה ${kmText(h.km)} ק״מ - ברכבת כ-${trainHours(h.km)} שעות ממרכז העיר למרכז העיר.`,
  );
  return { lead: "טיסה אחת לכל המסלול.", text: [...lines, "מעדיפים רכבת? כבו את קטע הביניים."].join(" ") };
}

// ---------------------------------------------------------------------------------------------
// Sort tabs
// ---------------------------------------------------------------------------------------------

type OfferShape = {
  validatingAirlineCodes?: string[];
  itineraries?: { segments?: { carrierCode?: string; operating?: { carrierCode?: string } }[] }[];
};

/**
 * Every carrier on the ticket is Israeli: the validating carrier and whoever operates each
 * segment of every itinerary (Amadeus leaves `operating` out when it is the marketing carrier).
 * An offer with no itineraries to read falls back to the flight's airline.
 */
export function isIsraeliFlight(f: ItineraryFlight): boolean {
  const offer = (f.offer ?? {}) as OfferShape;
  const codes = [offer.validatingAirlineCodes?.[0] ?? f.airline];
  for (const it of offer.itineraries ?? []) {
    for (const s of it.segments ?? []) codes.push(s.operating?.carrierCode ?? s.carrierCode ?? "");
  }
  return codes.every((c) => ISRAELI_CARRIERS.has(c));
}

/** Stops over every leg of the trip. */
const totalStops = (f: ItineraryFlight): number =>
  f.legs.reduce((n, leg) => n + Math.max(0, leg.stops.length - 1), 0);

/** "PT4H30M" -> 270. Unreadable = 0. */
const minutesOf = (iso: string): number => {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(iso ?? "");
  return m ? Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) : 0;
};

/** Time in the air (and layovers) over every leg. */
const totalMinutes = (f: ItineraryFlight): number => f.legs.reduce((n, leg) => n + minutesOf(leg.duration), 0);

/**
 * The "★ הטוב ביותר" flight - the live step's rule (FlightSelection `pickBestFlight`, no offline
 * flights here) over the whole trip: fewest stops, then cheapest, then shortest.
 */
export function pickBestFlight(flights: ItineraryFlight[]): ItineraryFlight | undefined {
  if (!flights.length) return undefined;
  return flights.reduce((best, f) => {
    const stops = totalStops(f) - totalStops(best);
    if (stops !== 0) return stops < 0 ? f : best;
    if (f.price !== best.price) return f.price < best.price ? f : best;
    return totalMinutes(f) < totalMinutes(best) ? f : best;
  });
}

/** The "↓ הזול ביותר" flight. */
export function cheapestFlight(flights: ItineraryFlight[]): ItineraryFlight | undefined {
  if (!flights.length) return undefined;
  return flights.reduce((min, f) => (f.price < min.price ? f : min));
}

const byPrice = (flights: ItineraryFlight[]): ItineraryFlight[] => [...flights].sort((a, b) => a.price - b.price);

/**
 * The list under a tab, as the live step orders it: הטוב ביותר = the best flight first and the
 * rest cheapest first; הזול ביותר = cheapest first; ישראלי = the Israeli flights, cheapest first.
 * Never reorders the list it is given.
 */
export function sortFlights(flights: ItineraryFlight[], sort: FlightSort): ItineraryFlight[] {
  if (sort === "cheapest") return byPrice(flights);
  if (sort === "israeli") return byPrice(flights.filter(isIsraeliFlight));
  const best = pickBestFlight(flights);
  return best ? [best, ...byPrice(flights.filter((f) => f !== best))] : [];
}

/** What every badge is measured against: the first offer of the default tab, per traveller. */
export function basePerTraveller(flights: ItineraryFlight[], pax: number): number | null {
  const first = sortFlights(flights, "best")[0];
  return first ? first.price / pax : null;
}

// ---------------------------------------------------------------------------------------------
// Price badge
// ---------------------------------------------------------------------------------------------

export type PriceBadge = { kind: "included" } | { kind: "less" | "more"; usd: number };

/**
 * A flight against the base, per traveller, rounded up like the live card: within
 * `INCLUDED_BAND_USD` it is included in the package, else a saving or a supplement.
 */
export function priceBadge(price: number, pax: number, base: number): PriceBadge {
  const delta = Math.ceil(price / pax) - Math.ceil(base);
  if (Math.abs(delta) <= INCLUDED_BAND_USD) return { kind: "included" };
  return delta < 0 ? { kind: "less", usd: -delta } : { kind: "more", usd: delta };
}

// ---------------------------------------------------------------------------------------------
// The rows of a card
// ---------------------------------------------------------------------------------------------

export type CardRow = { kind: "flight"; leg: FlightSegment; trip?: TripLeg } | { kind: "train"; key: string };

/**
 * A card's rows in trip order: every leg of the trip (`all` = `tripLegs` with nothing by train),
 * a move by train as a train row, every other leg as the flight's next leg. A flight whose legs
 * do not match the trip's (it cannot come from this search) is shown as it is.
 */
export function cardRows(all: TripLeg[], flown: FlightSegment[], train: ReadonlySet<string>): CardRow[] {
  const byTrain = (l: TripLeg) => l.kind === "mid" && !!l.key && train.has(l.key);
  if (all.filter((l) => !byTrain(l)).length !== flown.length) return flown.map((leg) => ({ kind: "flight", leg }));
  let next = 0;
  return all.map((trip): CardRow => (byTrain(trip) ? { kind: "train", key: trip.key ?? "" } : { kind: "flight", leg: flown[next++], trip }));
}

// ---------------------------------------------------------------------------------------------
// Search request and answer
// ---------------------------------------------------------------------------------------------

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const IATA_RE = /^[A-Z]{3}$/;

const isRealDay = (s: string): boolean => {
  if (!DAY_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

const tomorrowOf = (todayIso: string): string => {
  const [y, m, d] = todayIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/**
 * POST /api/itinerary/flights would take these legs (`validateFlightRequest`'s rules): 2-4
 * legs, 1-9 travellers, IATA codes, never a leg to itself, real days from tomorrow on, never
 * going back. `todayIso` = today, `YYYY-MM-DD` (UTC, as the route reads it).
 */
export function canSearch(legs: FlightLeg[], adults: number, todayIso: string): boolean {
  if (legs.length < 2 || legs.length > 4) return false;
  if (!Number.isInteger(adults) || adults < 1 || adults > 9) return false;
  const tomorrow = tomorrowOf(todayIso);
  let previous = "";
  for (const l of legs) {
    if (!IATA_RE.test(l.from) || !IATA_RE.test(l.to) || l.from === l.to) return false;
    if (!isRealDay(l.date) || l.date < tomorrow || l.date < previous) return false;
    previous = l.date;
  }
  return true;
}

/** One search per (legs, party, direct-only): the key its answer is kept under. */
export const searchKey = (legs: FlightLeg[], adults: number, nonStop: boolean): string =>
  JSON.stringify([legs.map((l) => [l.from, l.to, l.date]), adults, nonStop]);

export type SearchOutcome =
  | { kind: "ok"; flights: ItineraryFlight[] }
  | { kind: "empty" }
  | { kind: "busy" }
  | { kind: "invalid" }
  | { kind: "error" };

const isFlight = (v: unknown): v is ItineraryFlight => {
  const f = v as Partial<ItineraryFlight> | null;
  return !!f && typeof f.id === "string" && Number.isFinite(f.price) && Array.isArray(f.legs) && f.legs.length > 0;
};

/** The route's answer (status + parsed body; 0 = the request never got one). */
export function searchOutcome(status: number, body: unknown): SearchOutcome {
  if (status === 429) return { kind: "busy" };
  if (status === 400) return { kind: "invalid" };
  if (status !== 200) return { kind: "error" };
  const list = (body as { flights?: unknown } | null)?.flights;
  if (!Array.isArray(list)) return { kind: "error" };
  const flights = list.filter(isFlight);
  return flights.length ? { kind: "ok", flights } : { kind: "empty" };
}

export type SearchView = "ok" | "empty" | "retrying" | "busy" | "invalid" | "error";

/** What the step shows for an answer: a first "busy" is retried once, a second one is said. */
export function searchView(outcome: SearchOutcome, retried: boolean): SearchView {
  if (outcome.kind === "busy") return retried ? "busy" : "retrying";
  return outcome.kind;
}

// ---------------------------------------------------------------------------------------------
// The priced flight
// ---------------------------------------------------------------------------------------------

/**
 * The flight the trip keeps, from `/api/flights/pricing`'s answer (status + parsed body), or
 * null when the pricing failed. That route answers the fare's PENALTIES (and an informational
 * bag price) - not a new total: the price stays the search's. Its `bags` is a round-trip
 * figure (a fixed 65 on several paths), so it is not carried onto a multi-city flight.
 */
export function pricedFlight(
  flight: ItineraryFlight,
  status: number,
  body: unknown,
  trains: TrainLeg[],
): ItineraryFlight | null {
  if (status !== 200 || typeof body !== "object" || body === null) return null;
  const { penalties } = body as { penalties?: unknown };
  return {
    ...flight,
    ...(typeof penalties === "string" && penalties ? { penalties } : {}),
    trainLegs: trains.map((t) => ({ from: t.fromName, to: t.toName, date: t.date })),
  };
}
