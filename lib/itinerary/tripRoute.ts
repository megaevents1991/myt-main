/**
 * "Build Your Euro Trip" - the trip as a route, stop by stop, for the summary's "מסלול (N ימים)"
 * (Alon 28.10: "בסיכום שיהיה מסלול קיים וכל העריכות האלה יהיה מתחתיו"; Dor picked one row per
 * stop over one per day). Pure: no I/O, no clock.
 *
 * The same order the planner's panel draws (TripPanel): the flight out, each event, between two
 * events the move to the next city (or "נשארים ב<city>" when both are in one), the flight home.
 * The flight and move rows carry the trip's ONE date rule's labels and days (`datePickSteps`), so
 * the summary, the panel and the flights step's calendar always say the same thing.
 */
import type { Event } from "@/lib/app.types";
import { eventCityName } from "@/lib/events/lodging";
import { groundLink, stayCityName } from "./builder";
import { datePickSteps } from "./datePick";
import { trainHours } from "./flightsView";
import { dayDiff, eventDay, sameHub } from "./geo";
import { moves } from "./dates";
import type { TripDates } from "./types";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type TripStop =
  /** The flight out, a move between two cities, the flight home: `title` is its date label. */
  | { kind: "depart" | "move" | "ret"; title: string; day: string }
  /** Two events in one city back to back: no move, the stay goes on. */
  | { kind: "stay"; title: string }
  /** A sub-location: the train from the flight city to the event's (Manchester, from London). */
  | { kind: "ground"; title: string; detail: string }
  | { kind: "event"; title: string; day: string; city: string; eventId: number };

/** The route's stops in trip order. Undated trip dates = the events and the stays alone. */
export function tripStops(route: Event[], dates: TripDates, train: ReadonlySet<string>): TripStop[] {
  if (!route.length) return [];
  const dated = DAY_RE.test(dates.depart) && DAY_RE.test(dates.ret);
  const steps = dated ? datePickSteps(route, dates, train) : [];
  const byKey = new Map(steps.map((s) => [s.key, s]));
  const moveKeys = new Set(moves(route).map((m) => m.key));
  const out: TripStop[] = [];

  const depart = byKey.get("depart");
  if (depart) out.push({ kind: "depart", title: depart.label, day: depart.value });
  route.forEach((e, i) => {
    const prev = route[i - 1];
    if (prev) {
      const key = `${prev.id}>${e.id}`;
      const move = byKey.get(key);
      if (!moveKeys.has(key)) out.push({ kind: "stay", title: `נשארים ב${stayCityName(e)}` });
      else if (move) out.push({ kind: "move", title: move.label, day: move.value });
    }
    // Reached by a move of its own under one flight city, the train is already said.
    const ground = groundLink(e);
    if (ground && !(prev && moveKeys.has(`${prev.id}>${e.id}`) && sameHub(prev, e))) {
      out.push({
        kind: "ground",
        title: `רכבת מ${ground.from} ל${ground.to}`,
        detail: `כ-${trainHours(ground.km)} שעות · בכוחות עצמכם, לא כלול`,
      });
    }
    out.push({ kind: "event", title: e.name, day: eventDay(e), city: eventCityName(e), eventId: e.id });
  });
  const ret = byKey.get("ret");
  if (ret) out.push({ kind: "ret", title: ret.label, day: ret.value });
  return out;
}

/** The trip's length in days, the flight out's day and the flight home's both counted; null undated. */
export function tripDays(dates: TripDates): number | null {
  if (!DAY_RE.test(dates.depart) || !DAY_RE.test(dates.ret)) return null;
  const days = dayDiff(dates.depart, dates.ret) + 1;
  return days > 0 ? days : null;
}
