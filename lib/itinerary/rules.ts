/**
 * "Build Your Euro Trip" - compatibility rules: which event may join a route, and why not.
 * Pure: no I/O, no clock. Every threshold comes from `ItinerarySettings`.
 *
 * The checks run in a fixed order and the first that fails decides the answer
 * (see `compatibility`); the UI turns the code into Hebrew with `describeCompat`.
 */
import type { Event } from "@/lib/app.types";
import { shortPlace } from "@/lib/events/lodging";
import { dayDiff, eventDay, eventPoint, haversineKm, sameCity, stayPoint } from "./geo";
import type { ItinerarySettings } from "./settings";
import type { Compat } from "./types";

/** A gap this short (days) between two events, close enough in km, is a "best" pairing. */
const BEST_MAX_GAP_DAYS = 3;

/** The route in trip order: by calendar day, then id. Never mutates its input. */
export function sortRoute(route: Event[]): Event[] {
  return [...route].sort((a, b) => eventDay(a).localeCompare(eventDay(b)) || a.id - b.id);
}

/** The customer-facing name of the city the traveller stays in for an event ("פריז"). */
const stayCityName = (e: Event): string => shortPlace(stayPoint(e).point.name);

type Neighbour = {
  city: string;
  /** Distance between the two events, 0 when they share a city. */
  km: number;
  /** Whole days between the two events, always >= 0. */
  days: number;
  sameCity: boolean;
};

const measure = (candidate: Event, n: Event): Neighbour => {
  const same = sameCity(candidate, n);
  return {
    city: stayCityName(n),
    km: same ? 0 : haversineKm(eventPoint(candidate), eventPoint(n)),
    days: Math.abs(dayDiff(eventDay(candidate), eventDay(n))),
    sameCity: same,
  };
};

/** The one with the largest `key`; the earlier one wins a tie. */
const maxBy = (list: Neighbour[], key: (n: Neighbour) => number): Neighbour =>
  list.reduce((best, n) => (key(n) > key(best) ? n : best));

/**
 * Can `candidate` join `route`? Checks, in this order:
 *  1. the route is already full (`maxEvents`)            -> blocked `full`
 *  2. the route is empty                                 -> ok `first`
 *  3. another event falls on the same day                -> blocked `same_day`
 *  4. first-to-last event would exceed `maxSpanDays`     -> blocked `span`
 *  then, against the neighbour(s) the candidate would sit next to once inserted by date:
 *  5. farther than `maxKm` (0 within one city)           -> blocked `too_far`
 *  6. more than `maxGapDays` apart                       -> blocked `gap_too_long`
 *  7. more than `okGapDays` apart                        -> warn `long_gap`
 *  8. every neighbour in the same city                   -> same `same_city`
 *  9. farthest <= `bestKm` and every gap <= 3 days       -> best `best`
 * 10. otherwise                                          -> ok `fits`
 * `km` / `nearCity` on an addable answer describe the farthest neighbour.
 */
export function compatibility(route: Event[], candidate: Event, s: ItinerarySettings): Compat {
  if (route.length >= s.maxEvents) return { status: "blocked", reason: { code: "full" } };
  if (route.length === 0) return { status: "ok", reason: { code: "first" } };

  const clash = route.find((e) => eventDay(e) === eventDay(candidate));
  if (clash) return { status: "blocked", reason: { code: "same_day", with: clash.name } };

  const trip = sortRoute([...route, candidate]);
  const days = dayDiff(eventDay(trip[0]), eventDay(trip[trip.length - 1]));
  if (days > s.maxSpanDays) return { status: "blocked", reason: { code: "span", days } };

  // Inserted by date, the candidate has at most two neighbours: the event before and the one after.
  const at = trip.indexOf(candidate);
  const neighbours = [trip[at - 1], trip[at + 1]]
    .filter((n): n is Event => n !== undefined)
    .map((n) => measure(candidate, n));

  const farthest = maxBy(neighbours, (n) => n.km);
  if (farthest.km > s.maxKm) {
    return {
      status: "blocked",
      reason: { code: "too_far", km: farthest.km, from: farthest.city },
    };
  }

  const longest = maxBy(neighbours, (n) => n.days);
  if (longest.days > s.maxGapDays) {
    return {
      status: "blocked",
      reason: { code: "gap_too_long", days: longest.days, from: longest.city },
    };
  }

  const near = { km: farthest.km, nearCity: farthest.city };
  if (longest.days > s.okGapDays) {
    return { status: "warn", reason: { code: "long_gap", days: longest.days }, ...near };
  }
  if (neighbours.every((n) => n.sameCity)) {
    return { status: "same", reason: { code: "same_city" }, ...near };
  }
  if (farthest.km <= s.bestKm && longest.days <= BEST_MAX_GAP_DAYS) {
    return { status: "best", reason: { code: "best" }, ...near };
  }
  return { status: "ok", reason: { code: "fits" }, ...near };
}

/** The reason as the customer reads it (Hebrew). */
export function describeCompat(c: Compat): string {
  const r = c.reason;
  switch (r.code) {
    case "first":
      return "אפשר להתחיל מכאן";
    case "full":
      return "המסלול מלא - עד 3 אירועים";
    case "same_day":
      return `באותו יום כמו ${r.with}`;
    case "span":
      return `טיול של ${r.days} ימים - ארוך מדי`;
    case "too_far":
      // Explicit locale: the same text on the server and in the browser.
      return `${r.km.toLocaleString("he-IL")} ק״מ מ${r.from} - רחוק מדי`;
    case "gap_too_long":
      return `${r.days} ימים מ${r.from} - פער ארוך מדי`;
    case "long_gap":
      return `אפשרי - ${r.days} ימים בין האירועים`;
    case "same_city":
      return "באותה עיר - בלי טיסה נוספת";
    case "best":
      return "מומלץ - קרוב וזורם";
    case "fits":
      return "מתאים למסלול";
  }
}

/** Can the candidate be added at all? Everything but `blocked` can. */
export function isAddable(c: Compat): boolean {
  return c.status !== "blocked";
}
