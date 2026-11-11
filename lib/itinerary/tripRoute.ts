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
import { stayCityName } from "./builder";
import { datePickSteps } from "./datePick";
import { trainHours } from "./flightsView";
import { dayDiff, eventDay } from "./geo";
import { eventGrounds, leaveGrounds, moves, stayHeads, type Ground } from "./dates";
import type { TripDates } from "./types";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type TripStop =
  /** The flight out, a move between two cities, the flight home: `title` is its date label. */
  | { kind: "depart" | "move" | "ret"; title: string; day: string }
  /** Two events in one city back to back: no move, the stay goes on. */
  | { kind: "stay"; title: string }
  /**
   * A sub-location: the train from the flight city to the event's (Manchester, from London), or back
   * from a stay to the airport its flight leaves from (Liverpool to London, before the flight home).
   */
  | { kind: "ground"; title: string; detail: string }
  | { kind: "event"; title: string; day: string; city: string; eventId: number };

/** The route's stops in trip order. Undated trip dates = the events and the stays alone. */
export function tripStops(route: Event[], dates: TripDates, train: ReadonlySet<string>): TripStop[] {
  if (!route.length) return [];
  const dated = DAY_RE.test(dates.depart) && DAY_RE.test(dates.ret);
  const steps = dated ? datePickSteps(route, dates, train) : [];
  const byKey = new Map(steps.map((s) => [s.key, s]));
  const moveKeys = new Set(moves(route).map((m) => m.key));
  const grounds = eventGrounds(route, train);
  const leaves = leaveGrounds(route, train);
  const heads = stayHeads(route);
  const out: TripStop[] = [];
  const trainRow = (g: Ground): string => `רכבת מ${g.from}, כ-${trainHours(g.km)} שעות · לא כלול`;
  /** The way back to the airport, before the flight it is made for (Dor 11.11). */
  const leave = (key: string) => {
    const g = leaves.get(key);
    if (g) out.push({ kind: "ground", title: `חזרה עצמאית ל${g.to}`, detail: trainRow(g) });
  };

  const depart = byKey.get("depart");
  if (depart) out.push({ kind: "depart", title: depart.label, day: depart.value });
  route.forEach((e, i) => {
    const prev = route[i - 1];
    // A stay reached by train has its move row; `eventGrounds` leaves those out.
    const ground = grounds.get(e.id);
    if (prev) {
      const key = `${prev.id}>${e.id}`;
      const move = byKey.get(key);
      // The same hotel, but an event in another city is a way there, not "נשארים" (Alon 01.11).
      if (!moveKeys.has(key)) {
        if (!ground) out.push({ kind: "stay", title: `נשארים ב${stayCityName(heads.get(e.id) ?? e)}` });
      } else if (move) {
        leave(key);
        out.push({ kind: "move", title: move.label, day: move.value });
      }
    }
    if (ground) out.push({ kind: "ground", title: `הגעה עצמאית ל${ground.to}`, detail: trainRow(ground) });
    out.push({ kind: "event", title: e.name, day: eventDay(e), city: eventCityName(e), eventId: e.id });
  });
  const ret = byKey.get("ret");
  if (ret) {
    leave("ret");
    out.push({ kind: "ret", title: ret.label, day: ret.value });
  }
  return out;
}

/** The trip's length in days, the flight out's day and the flight home's both counted; null undated. */
export function tripDays(dates: TripDates): number | null {
  if (!DAY_RE.test(dates.depart) || !DAY_RE.test(dates.ret)) return null;
  const days = dayDiff(dates.depart, dates.ret) + 1;
  return days > 0 ? days : null;
}
