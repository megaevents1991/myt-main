/**
 * "Build Your Euro Trip" - trip dates, stays and legs. Pure: no I/O, no clock.
 * Days are `YYYY-MM-DD` strings (they compare as text) and the day math is UTC,
 * so a DST change never moves one.
 *
 * The shape of a trip (spec §5), on the route sorted by event day:
 *  - consecutive events in the same city (`sameCity`) share one stay and have no move;
 *  - every other consecutive pair is a MOVE, keyed `${a.id}>${b.id}`, with its own day;
 *  - stays run back to back: depart -> move 1 -> move 2 -> ... -> return.
 * Whatever `clampTripDates` returns keeps every stay at least one night.
 */
import type { Event } from "@/lib/app.types";
import { shortPlace } from "@/lib/events/lodging";
import { eventDay, eventPoint, haversineKm, sameCity, stayPoint } from "./geo";
import { sortRoute } from "./rules";
import type { Stay, TrainLeg, TripDates, TripLeg } from "./types";

/** Where every trip starts and ends. */
const HOME_IATA = "TLV";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `day + n` days, `YYYY-MM-DD`. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** `v` when it is a `YYYY-MM-DD` day, else `fallback` (a draft that has no date yet). */
const dayOr = (v: string | undefined, fallback: string): string =>
  v !== undefined && DAY_RE.test(v) ? v : fallback;

const clampDay = (v: string, [lo, hi]: [string, string]): string => (v < lo ? lo : v > hi ? hi : v);

/** A move between two stays: the last event of one and the first of the next. */
export type TripMove = { key: string; a: Event; b: Event };

/**
 * The route cut into stays (`runs`, consecutive events in one city) and the moves between
 * them (`moves[i]` leaves `runs[i]` and arrives at `runs[i + 1]`). Stays and moves come from
 * this one pass, so they can never disagree.
 */
function layout(route: Event[]) {
  const runs: Event[][] = [];
  for (const e of sortRoute(route)) {
    const run = runs[runs.length - 1];
    if (run && sameCity(run[run.length - 1], e)) run.push(e);
    else runs.push([e]);
  }
  const moves: TripMove[] = runs.slice(1).map((next, i) => {
    const a = runs[i][runs[i].length - 1];
    const b = next[0];
    return { key: `${a.id}>${b.id}`, a, b };
  });
  return { runs, moves };
}

/** The day a move leaves: the one in the dates, else the day after event A. */
const moveDay = (d: TripDates, m: TripMove): string => dayOr(d.moves[m.key], addDays(eventDay(m.a), 1));

/** Consecutive events, in trip order, that are not in the same city: the trip's moves. */
export function moves(route: Event[]): TripMove[] {
  return layout(route).moves;
}

/** depart = first event - 1, return = last event + 1, each move = the day after event A. */
export function defaultTripDates(route: Event[]): TripDates {
  const { runs, moves: ms } = layout(route);
  if (runs.length === 0) return { depart: "", ret: "", moves: {} };
  const first = runs[0][0];
  const lastRun = runs[runs.length - 1];
  const last = lastRun[lastRun.length - 1];
  return {
    depart: addDays(eventDay(first), -1),
    ret: addDays(eventDay(last), 1),
    moves: Object.fromEntries(ms.map((m) => [m.key, addDays(eventDay(m.a), 1)])),
  };
}

/**
 * The range each date may take: depart [first - 3, first], return [last + 1, last + 3],
 * a move [A + 1, B]. They depend on the route alone (`_d` is accepted so the call reads like
 * `clampTripDates`). Inside these ranges every stay has at least one night.
 */
export function tripDateBounds(
  route: Event[],
  _d: TripDates,
): { depart: [string, string]; ret: [string, string]; moves: Record<string, [string, string]> } {
  const { runs, moves: ms } = layout(route);
  if (runs.length === 0) return { depart: ["", ""], ret: ["", ""], moves: {} };
  const first = eventDay(runs[0][0]);
  const lastRun = runs[runs.length - 1];
  const last = eventDay(lastRun[lastRun.length - 1]);
  return {
    depart: [addDays(first, -3), first],
    ret: [addDays(last, 1), addDays(last, 3)],
    moves: Object.fromEntries(
      ms.map((m): [string, [string, string]] => {
        const lo = addDays(eventDay(m.a), 1);
        const hi = eventDay(m.b);
        // Two events on one day cannot join a route (compatibility), but a range must never invert.
        return [m.key, [lo, hi < lo ? lo : hi]];
      }),
    ),
  };
}

/**
 * `d` with every date inside its range for this route. A move that is not one of the route's
 * moves is dropped; a move without a date (or any date that is not a day, e.g. the "" of a
 * draft with no route yet) takes its default.
 */
export function clampTripDates(route: Event[], d: TripDates): TripDates {
  const bounds = tripDateBounds(route, d);
  const def = defaultTripDates(route);
  return {
    depart: clampDay(dayOr(d.depart, def.depart), bounds.depart),
    ret: clampDay(dayOr(d.ret, def.ret), bounds.ret),
    moves: Object.fromEntries(
      Object.entries(bounds.moves).map(([key, range]) => [key, clampDay(dayOr(d.moves[key], def.moves[key]), range)]),
    ),
  };
}

/**
 * One stay per run of same-city events. `key` = the first event's id; the stay point is that
 * event's default lodging city. Check-in / check-out are the trip's depart, move days and return.
 */
export function stays(route: Event[], d: TripDates): Stay[] {
  const { runs, moves: ms } = layout(route);
  return runs.map((events, i) => {
    const { point, city } = stayPoint(events[0]);
    return {
      key: String(events[0].id),
      point,
      city,
      events,
      from: i === 0 ? d.depart : moveDay(d, ms[i - 1]),
      to: i === runs.length - 1 ? d.ret : moveDay(d, ms[i]),
    };
  });
}

/**
 * The flights of the trip: TLV -> the first event's flight city, a leg per move between two
 * different flight cities (`location.city_iata`) unless that move is by train, and the last
 * flight city -> TLV. A Manchester match sold as a flight to London, next to a London event, is
 * two stays but no leg. The km of a leg are measured between the events' own cities.
 */
export function tripLegs(route: Event[], d: TripDates, train: ReadonlySet<string>): TripLeg[] {
  const { runs, moves: ms } = layout(route);
  if (runs.length === 0) return [];
  const first = runs[0][0];
  const lastRun = runs[runs.length - 1];
  const last = lastRun[lastRun.length - 1];
  const legs: TripLeg[] = [{ kind: "out", from: HOME_IATA, to: first.location.city_iata, date: d.depart }];
  for (const m of ms) {
    if (m.a.location.city_iata === m.b.location.city_iata || train.has(m.key)) continue;
    legs.push({
      kind: "mid",
      from: m.a.location.city_iata,
      to: m.b.location.city_iata,
      date: moveDay(d, m),
      key: m.key,
      km: haversineKm(eventPoint(m.a), eventPoint(m.b)),
    });
  }
  legs.push({ kind: "ret", from: last.location.city_iata, to: HOME_IATA, date: d.ret });
  return legs;
}

/**
 * The moves made by train: the customer's own way, not included. Named after the stays they
 * leave and reach ("City, Country" -> "City"); `km` is the same number the flight leg it replaces
 * shows, so toggling the train never changes the distance on screen.
 */
export function trainLegs(route: Event[], d: TripDates, train: ReadonlySet<string>): TrainLeg[] {
  const { runs, moves: ms } = layout(route);
  return ms.flatMap((m, i) =>
    train.has(m.key)
      ? [
          {
            key: m.key,
            fromName: shortPlace(stayPoint(runs[i][0]).point.name),
            toName: shortPlace(stayPoint(runs[i + 1][0]).point.name),
            date: moveDay(d, m),
            km: haversineKm(eventPoint(m.a), eventPoint(m.b)),
          },
        ]
      : [],
  );
}
