/**
 * "Build Your Euro Trip" - the routes the hub suggests on its own: pairs and triples of
 * events that fit together by the compatibility rules, best first.
 * Pure: no I/O, no clock (`todayIso` is a parameter), no randomness - the same events
 * give the same list, whatever order they arrive in.
 */
import type { Event } from "@/lib/app.types";
import { isItineraryEligible } from "./eligibility";
import { dayDiff, eventDay, eventKind, eventPoint, haversineKm, sameCity } from "./geo";
import { compatibility, sortRoute } from "./rules";
import type { ItinerarySettings } from "./settings";
import type { Compat } from "./types";

export type RecommendedRoute = {
  /** The events in trip order (by day, then id). */
  ids: number[];
  /** Lower is better. Within the list it ranks routes of one tier only (see `recommendRoutes`). */
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

/** Σ day gaps + Σ km / 200 - 2 when music and football are both in - 1 for three events. */
const routeScore = (gaps: number, km: number, bothKinds: boolean, size: 2 | 3): number =>
  gaps + km / KM_PER_SCORE_POINT - (bothKinds ? BOTH_KINDS_BONUS : 0) - (size === 3 ? TRIPLE_BONUS : 0);

/** A way to reach a later event from an earlier one in a clean pair. */
type Link = { to: number; gap: number; km: number; sameCity: boolean };

/**
 * A route as indexes into the pool (a smaller index is an earlier event); `c` is -1 for a pair.
 * `single`: every link of the route stays in one city - it never moves the traveller between cities.
 */
type Candidate = { a: number; b: number; c: number; score: number; single: boolean };

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Up to `limit` suggested routes of two or three events, in two tiers: the routes that move between
 * cities first, the single-city ones (every link between events in the same city) after them - the
 * trip builder is about travelling, so a night in London after a night in London never leads. Inside a
 * tier the best (lowest score) comes first. The cap and the limit run over that order, so a single-city
 * route only takes a slot the multi-city routes leave.
 *  - only eligible events, never two with the same name in one route;
 *  - a pair is `a` then `b` with `compatibility([a], b)` best / same / ok;
 *  - a triple is a pair plus a third event that is best / same / ok against that pair
 *    (placed by date: before, between or after), the same event set kept once;
 *  - an event is in at most 2 routes of each size - pairs and triples count apart, or every
 *    triple would lose to its own cheaper pairs.
 * Ties on the score go to the earlier first day, then to the lower ids (compared as text).
 * "Same city" is `sameCity` (stay points within 30 km) between consecutive events.
 */
export function recommendRoutes(
  events: Event[],
  s: ItinerarySettings,
  todayIso: string,
  limit: number = s.maxAutoRoutes,
): RecommendedRoute[] {
  if (limit <= 0) return [];

  // In trip order, so the result does not depend on the order the events arrive in. From here
  // on an event is its index in the pool.
  const pool = sortRoute(events.filter((e) => isItineraryEligible(e, todayIso)));
  const names = pool.map((e) => e.name.trim());
  const kinds = pool.map(eventKind);
  // Whole days from today: the pair scan and the tie-break on the first day need no strings.
  const days = pool.map((e) => dayDiff(todayIso, eventDay(e)));
  // A gap over `okGapDays` is a `warn` (or already blocked over `maxGapDays`): never a clean fit.
  const maxPairGap = Math.min(s.okGapDays, s.maxGapDays);

  const candidates: Candidate[] = [];
  const links: Link[][] = pool.map(() => []); // links[i]: the later events that pair cleanly with i

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      // The pool is sorted: from here on every event is further than a clean pair may be.
      if (days[j] - days[i] > maxPairGap) break;
      if (names[i] === names[j]) continue;
      if (!recommendable(compatibility([pool[i]], pool[j], s))) continue;
      const gap = days[j] - days[i];
      const km = haversineKm(eventPoint(pool[i]), eventPoint(pool[j]));
      const same = sameCity(pool[i], pool[j]);
      links[i].push({ to: j, gap, km, sameCity: same });
      candidates.push({ a: i, b: j, c: -1, score: routeScore(gap, km, kinds[i] !== kinds[j], 2), single: same });
    }
  }

  // Triples. `compatibility` looks at the third event's neighbours by date only, so a set of three
  // fits exactly when each of its two neighbouring links is a clean pair and the trip as a whole
  // fits (span, one event a day). Every such set is therefore found once - as its first two events
  // plus the last - and the other ways to build it (the last two plus the first; the outer two plus
  // the one between, which needs one more clean link) add nothing. So the triples are the chains of
  // two links: no sorting, no dedupe, and a set reached by three routes is still one candidate.
  // Here they are only scored; `compatibility` has the last word when one is about to be taken.
  if (s.maxEvents >= 3) {
    for (let i = 0; i < pool.length; i++) {
      for (const first of links[i]) {
        for (const second of links[first.to]) {
          const j = first.to;
          const k = second.to;
          if (names[k] === names[i]) continue; // names[k] differs from names[j]: (j, k) is a pair
          const bothKinds = kinds[i] !== kinds[j] || kinds[j] !== kinds[k];
          const score = routeScore(first.gap + second.gap, first.km + second.km, bothKinds, 3);
          candidates.push({ a: i, b: j, c: k, score, single: first.sameCity && second.sameCity });
        }
      }
    }
  }

  const idText = pool.map((e) => String(e.id));
  const byId = (x: Candidate, y: Candidate): number =>
    cmp(idText[x.a], idText[y.a]) ||
    cmp(idText[x.b], idText[y.b]) ||
    (x.c < 0 || y.c < 0 ? Number(x.c >= 0) - Number(y.c >= 0) : cmp(idText[x.c], idText[y.c]));
  candidates.sort(
    (x, y) => Number(x.single) - Number(y.single) || x.score - y.score || days[x.a] - days[y.a] || byId(x, y),
  );

  const used = new Map<string, number>(); // `${size}:${eventId}` -> routes taken so far
  const picked: RecommendedRoute[] = [];
  for (const cand of candidates) {
    if (picked.length >= limit) break;
    const at = cand.c < 0 ? [cand.a, cand.b] : [cand.a, cand.b, cand.c];
    const ids = at.map((index) => pool[index].id);
    const slots = ids.map((id) => `${ids.length}:${id}`);
    if (slots.some((slot) => (used.get(slot) ?? 0) >= MAX_ROUTES_PER_EVENT)) continue;
    if (cand.c >= 0 && !recommendable(compatibility([pool[cand.a], pool[cand.b]], pool[cand.c], s))) continue;
    for (const slot of slots) used.set(slot, (used.get(slot) ?? 0) + 1);
    picked.push({ ids, score: cand.score });
  }
  return picked;
}
