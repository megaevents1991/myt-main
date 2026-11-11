/**
 * "Build Your Euro Trip" - trip dates, stays and legs. Pure: no I/O, no clock.
 * Days are `YYYY-MM-DD` strings (they compare as text) and the day math is UTC,
 * so a DST change never moves one.
 *
 * The shape of a trip (spec §5), on the route sorted by event day:
 *  - an event that sleeps where the stay before it sleeps (`shareStay`: the same city, or Liverpool
 *    after Manchester) joins that stay and has no move;
 *  - every other consecutive pair is a MOVE, keyed `${a.id}>${b.id}`, with its own day;
 *  - stays run back to back: depart -> move 1 -> move 2 -> ... -> return.
 * A Manchester match sleeps in Manchester (`tripStayCity`), so London, Manchester, London is three
 * stays and two moves by train (Dor 09.11). Whatever `clampTripDates` returns keeps every stay at
 * least one night.
 */
import type { Event } from "@/lib/app.types";
import { cityName, eventCityName, shortPlace } from "@/lib/events/lodging";
import { eventDay, eventPoint, haversineKm, SAME_CITY_KM, sameHub, shareStay, stayPoint } from "./geo";
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
 * The route cut into stays (`runs`: each event joins the stay before it when it sleeps there -
 * `shareStay` against the stay's FIRST event, whose city the stay is) and the moves between them
 * (`moves[i]` leaves `runs[i]` and arrives at `runs[i + 1]`). Stays and moves come from this one
 * pass, so they can never disagree.
 */
function layout(route: Event[]) {
  const runs: Event[][] = [];
  for (const e of sortRoute(route)) {
    const run = runs[runs.length - 1];
    if (run && shareStay(run[0], e)) run.push(e);
    else runs.push([e]);
  }
  const moves: TripMove[] = runs.slice(1).map((next, i) => {
    const a = runs[i][runs[i].length - 1];
    const b = next[0];
    return { key: `${a.id}>${b.id}`, a, b };
  });
  return { runs, moves };
}

/**
 * A move's day when the customer has not picked one: the day after event A - except the train into
 * a sub-location's own hotel under one flight city (London -> a Manchester match), which takes the
 * event's split nights, as its single-event order does (`split_default_nights`: 1 = the match's
 * night, else that and the night before), never before the day after A.
 */
function defaultMoveDay(m: TripMove): string {
  const after = addDays(eventDay(m.a), 1);
  if (!sameHub(m.a, m.b) || stayPoint(m.b).city !== "event") return after;
  const nights = Number(m.b.split_default_nights) === 1 ? 1 : 2;
  const day = addDays(eventDay(m.b), 1 - nights);
  return day > after ? day : after;
}

/** The day a move leaves: the one in the dates, else its default (`defaultMoveDay`). */
const moveDay = (d: TripDates, m: TripMove): string => dayOr(d.moves[m.key], defaultMoveDay(m));

/** Consecutive events, in trip order, that do not share a stay: the trip's moves. */
export function moves(route: Event[]): TripMove[] {
  return layout(route).moves;
}

/** depart = first event - 1, return = last event + 1, each move its default (`defaultMoveDay`). */
export function defaultTripDates(route: Event[]): TripDates {
  const { runs, moves: ms } = layout(route);
  if (runs.length === 0) return { depart: "", ret: "", moves: {} };
  const first = runs[0][0];
  const lastRun = runs[runs.length - 1];
  const last = lastRun[lastRun.length - 1];
  return {
    depart: addDays(eventDay(first), -1),
    ret: addDays(eventDay(last), 1),
    moves: Object.fromEntries(ms.map((m) => [m.key, defaultMoveDay(m)])),
  };
}

/** Each event's stay, as the stay's first event (the one whose city the stay sleeps in). */
export function stayHeads(route: Event[]): Map<number, Event> {
  return new Map(layout(route).runs.flatMap((run) => run.map((e): [number, Event] => [e.id, run[0]])));
}

/** A way on the ground the trip does not include: a train from `from` to `to`. */
export type Ground = { from: string; to: string; km: number };

/**
 * The way to each event that the customer makes alone (Dor 09.11), keyed by event id:
 *  - an event played away from the hotel it sleeps in - a Liverpool match from the Manchester stay
 *    it shares, a two-city event whose hotel stays in its flight city: from the stay's city;
 *  - the first event of a stay that sleeps away from its own airport, when a flight lands there -
 *    the trip's first stay, or a move flight: "נוחתים בלונדון", then the train to Manchester.
 * A stay reached by a train move (under one flight city, or by the customer's choice - `train`) has
 * none: the move's own row says the train. An event in its stay's city has none.
 */
export function eventGrounds(route: Event[], train: ReadonlySet<string>): Map<number, Ground> {
  const { runs, moves: ms } = layout(route);
  const out = new Map<number, Ground>();
  runs.forEach((run, i) => {
    const stay = stayPoint(run[0]).point;
    const into = i > 0 ? ms[i - 1] : undefined;
    const flownIn = !into || (!sameHub(into.a, into.b) && !train.has(into.key));
    run.forEach((e, j) => {
      const at = eventPoint(e);
      const away = haversineKm(stay, at);
      if (away > SAME_CITY_KM) {
        out.set(e.id, { from: shortPlace(stay.name), to: eventCityName(e), km: away });
        return;
      }
      const fromAirport = haversineKm(e.location, stay);
      if (j === 0 && flownIn && fromAirport > SAME_CITY_KM) {
        out.set(e.id, { from: cityName(e, "flight"), to: eventCityName(e), km: fromAirport });
      }
    });
  });
  return out;
}

/**
 * The way BACK to the airport that the customer makes alone, keyed by the flight it is made for:
 * `"ret"` (the flight home) or a flown move's key. Dor 11.11 - Manchester, London, Liverpool flew
 * home "from London" out of a Liverpool hotel and no screen said the train back; `eventGrounds`
 * only ever told the way IN. A stay that sleeps away from its own airport and is left by a flight:
 * the flight home, or a move between two flight cities the customer did not take over (`train`).
 * A stay left by train has none - that move's own row says it.
 */
export function leaveGrounds(route: Event[], train: ReadonlySet<string>): Map<string, Ground> {
  const { runs, moves: ms } = layout(route);
  const out = new Map<string, Ground>();
  runs.forEach((run, i) => {
    const move = i < ms.length ? ms[i] : undefined;
    if (move && (sameHub(move.a, move.b) || train.has(move.key))) return;
    const stay = stayPoint(run[0]).point;
    // The flight leaves the flight city of the stay's last event (`tripLegs`).
    const last = run[run.length - 1];
    const km = haversineKm(stay, last.location);
    if (km > SAME_CITY_KM) out.set(move ? move.key : "ret", { from: shortPlace(stay.name), to: cityName(last, "flight"), km });
  });
  return out;
}

/** `leaveGrounds` in trip order, each with the day its flight leaves: the move's day, or the return. */
export function leaveWays(route: Event[], d: TripDates, train: ReadonlySet<string>): (Ground & { key: string; date: string })[] {
  const ms = layout(route).moves;
  return [...leaveGrounds(route, train)].map(([key, g]) => {
    const move = ms.find((m) => m.key === key);
    return { ...g, key, date: move ? moveDay(d, move) : d.ret };
  });
}

/**
 * The range each date may take: depart [first - 3, first], return [last + 1, last + 3], a move
 * [A + 1, B - 1] - nobody changes city on the day of a show (Dor 31.10) - or [A + 1, B] within one
 * flight city (`sameHub`: the train from London to a Manchester match may be that morning's). They
 * depend on the route alone (`_d` is accepted so the call reads like `clampTripDates`). Inside these
 * ranges every stay has at least one night.
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
        const hi = sameHub(m.a, m.b) ? eventDay(m.b) : addDays(eventDay(m.b), -1);
        // Events too close for this cannot join a route (compatibility), but a range must never invert.
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
 * One stay per run of events that sleep in one place (`layout`). `key` = the first event's id; the
 * stay point is that event's trip city (`stayPoint`: a Manchester match's is Manchester). Check-in /
 * check-out are the trip's depart, move days and return.
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
 * leave and reach ("City, Country" -> "City") and measured between the same two stay points
 * (a train runs from city centre to city centre): Paris -> a Manchester match slept in London
 * is Paris -> London, 343 km - not the Paris -> Manchester of the flight leg it replaces.
 */
export function trainLegs(route: Event[], d: TripDates, train: ReadonlySet<string>): TrainLeg[] {
  const { runs, moves: ms } = layout(route);
  return ms.flatMap((m, i) => {
    if (!train.has(m.key)) return [];
    const from = stayPoint(runs[i][0]).point;
    const to = stayPoint(runs[i + 1][0]).point;
    return [
      {
        key: m.key,
        fromName: shortPlace(from.name),
        toName: shortPlace(to.name),
        date: moveDay(d, m),
        km: haversineKm(from, to),
      },
    ];
  });
}

/**
 * Every move made on the ground, in trip order: the train between two stays under one flight city
 * (London - Manchester: there is no flight to pick) and the moves the customer took over (`train`).
 * What the mails list - the summary draws the two kinds apart.
 */
export function ownTrains(route: Event[], d: TripDates, train: ReadonlySet<string>): TrainLeg[] {
  const hub = layout(route).moves.filter((m) => sameHub(m.a, m.b)).map((m) => m.key);
  return trainLegs(route, d, new Set([...train, ...hub]));
}
