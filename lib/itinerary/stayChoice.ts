/**
 * "Build Your Euro Trip" - where the trip sleeps for a match away from its flight city, the
 * customer's choice on the hotels step (Alon 12.11, notes 3 / 10 / 11 / 12; Dor 12.11: "בשלב
 * המלונות", as the single-event order offers "איפה ישנים?"). Pure: no I/O, no clock.
 *
 * The defaults stay Dor's of 09.11 - a Manchester match sleeps in Manchester, a Liverpool match after
 * it shares the Manchester hotel. The customer may instead:
 *  - sleep in the flight city ("מלון בלונדון"): London, Manchester, London becomes ONE London stay,
 *    the match a day trip by train from it;
 *  - sleep in the match's own city in its own hotel ("מלון בליברפול"): Manchester and Liverpool
 *    become two hotels - the split.
 * The pick rides on the event (`withStayPick`), like a direct flight, so the route alone says the
 * trip's stays on the client and on the server.
 */
import type { Event } from "@/lib/app.types";
import { cityName, eventCityName, hasEventCity, offeredCities } from "@/lib/events/lodging";
import { stayHeads } from "./dates";
import { sameCity, stayPickOf, withStayPick, type StayPick } from "./geo";
import { sortRoute } from "./rules";
import { stayCityName } from "./builder";

/** One way to sleep for the event: its own city, its flight city, or the stay before it (`shared`). */
export type StayOption = { pick: StayPick | "shared"; label: string };

export type StayChoice = {
  event: Event;
  options: StayOption[];
  /** What the trip does now. */
  current: StayPick | "shared";
  /** What it does with no pick of the customer's (Dor's 09.11 default) - choosing it drops the pick. */
  fallback: StayPick | "shared";
};

/** The picks this event may take: the cities it offers a hotel in (the single-event order's own). */
export function stayPicksFor(e: Event): StayPick[] {
  const plain = withStayPick(e, undefined);
  if (!hasEventCity(plain)) return [];
  return offeredCities(plain);
}

/**
 * The events the customer may choose for, in trip order, each with its options (two or more) and
 * the one the trip holds now. `shared` is offered where, with no pick of its own, the event would
 * sleep in the hotel of another city's match before it (Liverpool after Manchester) - the default.
 */
export function stayChoices(route: Event[]): StayChoice[] {
  const trip = sortRoute(route);
  return trip.flatMap((e): StayChoice[] => {
    const picks = stayPicksFor(e);
    if (!picks.length) return [];
    const plain = withStayPick(e, undefined);
    const head = stayHeads(trip.map((x) => (x.id === e.id ? plain : x))).get(e.id);
    const shares = !!head && head.id !== e.id && !sameCity(head, plain);
    const options: StayOption[] = [];
    if (shares && head) options.push({ pick: "shared", label: `מלון אחד ב${stayCityName(head)}` });
    if (picks.includes("event")) options.push({ pick: "event", label: `מלון ב${eventCityName(plain)}` });
    if (picks.includes("flight")) options.push({ pick: "flight", label: `מלון ב${cityName(plain, "flight")}` });
    if (options.length < 2) return [];
    const fallback: StayPick | "shared" = shares ? "shared" : picks.includes("event") ? "event" : "flight";
    return [{ event: e, options, current: stayPickOf(e) ?? fallback, fallback }];
  });
}

/**
 * The route with the customer's picks on it (the server's own rows, `confirmFlow`); `null` when a
 * pick is not one the event offers. Every other event goes plain.
 */
export function applyStayPicks(route: Event[], picks: Readonly<Record<number, StayPick>>): Event[] | null {
  for (const [id, pick] of Object.entries(picks)) {
    const e = route.find((x) => x.id === Number(id));
    if (!e || !stayPicksFor(e).includes(pick)) return null;
  }
  return route.map((e) => withStayPick(e, picks[e.id]));
}

/** The picks the route carries, by event id - what a hold and a draft send. */
export function stayPicksOf(route: Event[]): Record<number, StayPick> {
  return Object.fromEntries(route.flatMap((e) => {
    const pick = stayPickOf(e);
    return pick ? [[e.id, pick]] : [];
  }));
}
