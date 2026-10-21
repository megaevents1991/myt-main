/**
 * "Build Your Euro Trip" (multi-event itinerary) - shared types.
 * Types only: nothing here runs.
 */
import type { Event } from "@/lib/app.types";
import type { LodgingCity, LodgingPoint } from "@/lib/events/lodging";

/** How an event fits next to the ones already in the trip. */
export type CompatStatus = "best" | "same" | "ok" | "warn" | "blocked";

/** Why - the UI turns the code (and its numbers / names) into Hebrew copy. */
export type CompatReason =
  | { code: "first" }
  | { code: "full"; max: number }
  | { code: "same_day"; with: string }
  | { code: "span"; days: number }
  | { code: "too_far"; km: number; from: string }
  | { code: "gap_too_long"; days: number; from: string }
  | { code: "long_gap"; days: number }
  | { code: "same_city" }
  | { code: "best" }
  | { code: "fits" };

export type Compat = {
  status: CompatStatus;
  reason: CompatReason;
  /** Distance to the farthest neighbour the event would sit next to in the trip, km. */
  km?: number;
  /** Name of that neighbour's event city. */
  nearCity?: string;
};

/** The trip's dates. All `YYYY-MM-DD`. */
export type TripDates = {
  depart: string;
  ret: string;
  /** Departure day of each move between events, keyed `${a.id}>${b.id}`. */
  moves: Record<string, string>;
};

/** One stay: consecutive events in the same city share one hotel. */
export type Stay = {
  key: string;
  point: LodgingPoint;
  city: LodgingCity;
  events: Event[];
  /** Check-in / check-out, `YYYY-MM-DD`. */
  from: string;
  to: string;
};

/** One leg of the way: IATA codes, `"TLV"` at both ends. */
export type TripLeg = {
  kind: "out" | "mid" | "ret";
  from: string;
  to: string;
  date: string;
  /** The move this leg belongs to (a mid leg), same key as `TripDates.moves`. */
  key?: string;
  km?: number;
};

/** A move between two stays made by train instead of a flight. */
export type TrainLeg = {
  key: string;
  fromName: string;
  toName: string;
  date: string;
  km: number;
};
