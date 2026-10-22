/**
 * "Build Your Euro Trip" - the order the flights step asks for the trip's dates. Pure: no I/O,
 * no clock. One calendar walks them IN TRIP ORDER: the flight out, each move between stays, the
 * flight home. A move the customer makes on their own is still asked - it is a hotel night
 * boundary - and says so in its label.
 */
import type { Event } from "@/lib/app.types";
import { clampTripDates, moves, stays, tripDateBounds } from "./dates";
import { stayCityName } from "./builder";
import type { TripDates } from "./types";

export type DatePickStep = {
  /** `"depart"`, a move's `TripMove.key`, or `"ret"`: the same keys `TripDates` uses. */
  key: string;
  kind: "depart" | "move" | "ret";
  /** The header over the calendar while this date is picked. */
  label: string;
  /** The date now, `YYYY-MM-DD`. */
  value: string;
  /** The range this date may take (`tripDateBounds`), `YYYY-MM-DD`. */
  min: string;
  max: string;
};

/**
 * The dates to pick, in trip order: `טיסה הלוך ל<city>`, then `מעבר ל<city>` per move (plus
 * ` (עצמאית)` when `train` has it), then `חזרה מ<city>`. `<city>` is the stay flown to, moved to
 * and left, named like the hotels step names it. Values come from the dates clamped for this
 * route, so each one sits inside its own range.
 */
export function datePickSteps(route: Event[], dates: TripDates, train: ReadonlySet<string>): DatePickStep[] {
  const list = stays(route, dates);
  if (list.length === 0) return [];
  const city = (i: number): string => stayCityName(list[i].events[0]);
  const bounds = tripDateBounds(route, dates);
  const value = clampTripDates(route, dates);

  const steps: DatePickStep[] = [
    {
      key: "depart",
      kind: "depart",
      label: `טיסה הלוך ל${city(0)}`,
      value: value.depart,
      min: bounds.depart[0],
      max: bounds.depart[1],
    },
  ];
  moves(route).forEach((m, i) => {
    const [min, max] = bounds.moves[m.key];
    steps.push({
      key: m.key,
      kind: "move",
      label: `מעבר ל${city(i + 1)}${train.has(m.key) ? " (עצמאית)" : ""}`,
      value: value.moves[m.key],
      min,
      max,
    });
  });
  steps.push({
    key: "ret",
    kind: "ret",
    label: `חזרה מ${city(list.length - 1)}`,
    value: value.ret,
    min: bounds.ret[0],
    max: bounds.ret[1],
  });
  return steps;
}

/**
 * `dates` with `key`'s day set to `day`, then clamped for the route - a day outside the range
 * comes back at its edge, and an unknown key changes nothing (the dates still come back clamped).
 */
export function applyDatePick(route: Event[], dates: TripDates, key: string, day: string): TripDates {
  if (key === "depart") return clampTripDates(route, { ...dates, depart: day });
  if (key === "ret") return clampTripDates(route, { ...dates, ret: day });
  if (moves(route).some((m) => m.key === key)) {
    return clampTripDates(route, { ...dates, moves: { ...dates.moves, [key]: day } });
  }
  return clampTripDates(route, dates);
}

/** Both are the same trip days: the departure, the return and every move's day. */
export function sameTripDates(a: TripDates, b: TripDates): boolean {
  if (a.depart !== b.depart || a.ret !== b.ret) return false;
  const keys = new Set([...Object.keys(a.moves), ...Object.keys(b.moves)]);
  return [...keys].every((k) => a.moves[k] === b.moves[k]);
}

/**
 * `YYYY-MM-DD` as that day at local midnight - what a calendar widget takes. Never
 * `new Date("YYYY-MM-DD")`: that one is UTC midnight, and a day behind west of Greenwich.
 */
export function localDay(day: string): Date {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** A calendar widget's day (local) back to `YYYY-MM-DD`; the inverse of `localDay`. */
export function isoDay(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
