/**
 * "Build Your Euro Trip" - the routes the hub suggests on its own: pairs and triples of
 * events that fit together by the compatibility rules, best first.
 * Pure: no I/O, no clock (`todayIso` is a parameter), no randomness - the same events
 * give the same list, whatever order they arrive in.
 */
import type { Event } from "@/lib/app.types";
import { isItineraryEligible } from "./eligibility";
import { dayDiff, eventDay, eventKind, eventPoint, haversineKm } from "./geo";
import { compatibility, sortRoute } from "./rules";
import type { ItinerarySettings } from "./settings";
import type { Compat } from "./types";

export type RecommendedRoute = {
  /** The events in trip order (by day, then id). */
  ids: number[];
  /** Lower is better. */
  score: number;
};

/** Every 200 km between two events counts as one day of gap. */
const KM_PER_SCORE_POINT = 200;
/** A route with music and football in it is the more interesting one. */
const BOTH_KINDS_BONUS = 2;
/** Three events in one trip beat two (the bigger discount, the longer holiday). */
const TRIPLE_BONUS = 1;
/** One event is offered in at most this many routes of the same size. */
const MAX_ROUTES_PER_EVENT = 2;

/** Only a clean fit is suggested: `warn` (a long gap) and `blocked` are left to the customer. */
const recommendable = (c: Compat): boolean => c.status === "best" || c.status === "same" || c.status === "ok";

type Candidate = RecommendedRoute & {
  /** `ids` joined: the identity of the event set, and the last tie-break. */
  key: string;
  /** Day of the first event, `YYYY-MM-DD`: the tie-break after the score. */
  first: string;
};

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Σ day gaps + Σ km / 200 - 2 when music and football are both in - 1 for three events. */
function scoreRoute(route: Event[]): number {
  let gaps = 0;
  let km = 0;
  for (let i = 1; i < route.length; i++) {
    gaps += dayDiff(eventDay(route[i - 1]), eventDay(route[i]));
    km += haversineKm(eventPoint(route[i - 1]), eventPoint(route[i]));
  }
  const bothKinds = new Set(route.map(eventKind)).size === 2;
  return gaps + km / KM_PER_SCORE_POINT - (bothKinds ? BOTH_KINDS_BONUS : 0) - (route.length === 3 ? TRIPLE_BONUS : 0);
}

const candidateOf = (route: Event[]): Candidate => {
  const ids = route.map((e) => e.id);
  return { ids, score: scoreRoute(route), key: ids.join(","), first: eventDay(route[0]) };
};

/**
 * Up to `limit` suggested routes of two or three events, the best (lowest score) first.
 *  - only eligible events, never two with the same name in one route;
 *  - a pair is `a` then `b` with `compatibility([a], b)` best / same / ok;
 *  - a triple is a pair plus a third event that is best / same / ok against that pair
 *    (placed by date: before, between or after), the same event set kept once;
 *  - an event is in at most 2 routes of each size - pairs and triples count apart, or every
 *    triple would lose to its own cheaper pairs.
 */
export function recommendRoutes(
  events: Event[],
  s: ItinerarySettings,
  todayIso: string,
  limit: number = s.maxAutoRoutes,
): RecommendedRoute[] {
  if (limit <= 0) return [];

  // In trip order, so the result does not depend on the order the events arrive in.
  const pool = sortRoute(events.filter((e) => isItineraryEligible(e, todayIso)));
  const names = pool.map((e) => e.name.trim());
  // Whole days from today: a cheap integer test, so the pair scan can stop early.
  const days = pool.map((e) => dayDiff(todayIso, eventDay(e)));

  const candidates: Candidate[] = [];
  const pairs: [number, number][] = [];
  // Which events form a clean pair with each one (by index in `pool`).
  const partners: Set<number>[] = pool.map(() => new Set<number>());

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      // The pool is sorted: from here on every event is further than `maxGapDays` from `i`.
      if (days[j] - days[i] > s.maxGapDays) break;
      if (names[i] === names[j]) continue;
      if (!recommendable(compatibility([pool[i]], pool[j], s))) continue;
      pairs.push([i, j]);
      partners[i].add(j);
      partners[j].add(i);
      candidates.push(candidateOf([pool[i], pool[j]]));
    }
  }

  const seen = new Set<string>(); // triples taken so far
  for (const [i, j] of pairs) {
    // Placed by date, a third event sits next to `i`, to `j` or to both, and each link must be a
    // clean fit on its own: one that is no clean pair with either cannot be recommendable.
    // (Only a shortcut - `compatibility` below decides.)
    for (const k of new Set([...partners[i], ...partners[j]])) {
      if (k === i || k === j) continue;
      if (names[k] === names[i] || names[k] === names[j]) continue;
      const route = sortRoute([pool[i], pool[j], pool[k]]);
      const key = route.map((e) => e.id).join(",");
      if (seen.has(key)) continue; // the same three, already taken from another pair
      if (!recommendable(compatibility([pool[i], pool[j]], pool[k], s))) continue;
      seen.add(key);
      candidates.push(candidateOf(route));
    }
  }

  candidates.sort((a, b) => a.score - b.score || cmp(a.first, b.first) || cmp(a.key, b.key));

  const used = new Map<string, number>(); // `${size}:${eventId}` -> routes taken so far
  const picked: RecommendedRoute[] = [];
  for (const c of candidates) {
    if (picked.length >= limit) break;
    const slots = c.ids.map((id) => `${c.ids.length}:${id}`);
    if (slots.some((slot) => (used.get(slot) ?? 0) >= MAX_ROUTES_PER_EVENT)) continue;
    for (const slot of slots) used.set(slot, (used.get(slot) ?? 0) + 1);
    picked.push({ ids: c.ids, score: c.score });
  }
  return picked;
}
