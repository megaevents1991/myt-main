/**
 * "Build Your Euro Trip" - what the builder's route step and self-build list show. Pure: no I/O,
 * no clock. The components render these lists; every rule comes from `rules.ts`.
 */
import type { Event } from "@/lib/app.types";
import { cityName, defaultCity, eventCityName } from "@/lib/events/lodging";
import { stays } from "./dates";
import { dayDiff, eventDay, eventKind } from "./geo";
import { compatibility, sortRoute } from "./rules";
import type { ItinerarySettings } from "./settings";
import type { Compat, CompatStatus } from "./types";

/** `YYYY-MM-DD` -> `DD/MM/YY`. */
export const dayMonthYear = (day: string): string => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(2, 4)}`;

/** `YYYY-MM-DD` -> `DD/MM`. */
export const dayMonth = (day: string): string => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

/** The city the traveller sleeps in for this event, as the hotel step names it ("לונדון"). */
export const stayCityName = (e: Event): string => cityName(e, defaultCity(e));

/**
 * The trip's stay cities in order ("פריז", "לונדון"), each named once while the trip stays
 * in it - the builder header's title. Same rule as the hub's route card.
 */
export function tripCities(route: Event[]): string[] {
  if (!route.length) return [];
  const list = stays(route, { depart: "", ret: "", moves: {} });
  return list
    .map((stay) => stayCityName(stay.events[0]))
    .filter((name, i, all) => i === 0 || name !== all[i - 1]);
}

/** Display order of a compatibility answer: the best fits first, the blocked last. */
export const COMPAT_RANK: Record<CompatStatus, number> = { best: 0, same: 1, ok: 2, warn: 3, blocked: 4 };

export type Candidate = { event: Event; compat: Compat };

const byDay = (a: Event, b: Event): number => eventDay(a).localeCompare(eventDay(b)) || a.id - b.id;

/**
 * "אפשר לשלב גם": the events that could sit next to the route - within `maxGapDays` of its first
 * and last event, not in it, not another date of an event already in it (same name) - each with
 * its compatibility, best first, then by date. An empty route lists the whole catalog by date.
 */
export function routeCandidates(route: Event[], catalog: Event[], s: ItinerarySettings): Candidate[] {
  const trip = sortRoute(route);
  const ids = new Set(trip.map((e) => e.id));
  const names = new Set(trip.map((e) => e.name.trim()));
  const first = trip[0];
  const last = trip[trip.length - 1];
  return catalog
    .filter((e) => !ids.has(e.id) && !names.has(e.name.trim()))
    .filter(
      (e) =>
        !first ||
        (dayDiff(eventDay(first), eventDay(e)) >= -s.maxGapDays && dayDiff(eventDay(last), eventDay(e)) <= s.maxGapDays),
    )
    .map((event) => ({ event, compat: compatibility(trip, event, s) }))
    .sort((a, b) => COMPAT_RANK[a.compat.status] - COMPAT_RANK[b.compat.status] || byDay(a.event, b.event));
}

export type CatalogKind = "all" | "football" | "music";
export type CatalogFilter = { query: string; month: string; kind: CatalogKind };

/** Every month an event falls in, `YYYY-MM`, sorted: the self-build month chips. */
export function catalogMonths(catalog: Event[]): string[] {
  return [...new Set(catalog.map((e) => eventDay(e).slice(0, 7)))].sort();
}

/**
 * The self-build search, then month and kind. Like the site's search (`multiTermSearch`,
 * lib/search.ts) every word of the query must match, each in any field - "באד באני פריז" is the
 * artist AND the city - over the Hebrew name, the English name, the event's city and the flight
 * city. Plain substring matching: the builder's list is the catalog itself, no fuzzy index.
 */
export function filterCatalog(catalog: Event[], f: CatalogFilter): Event[] {
  const words = f.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return catalog.filter((e) => {
    if (f.kind !== "all" && eventKind(e) !== f.kind) return false;
    if (f.month && !eventDay(e).startsWith(f.month)) return false;
    if (!words.length) return true;
    const text = [e.name, e.name_english ?? "", eventCityName(e), e.location?.name ?? ""].join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

export type CatalogItem = Candidate & { inRoute: boolean };

/**
 * The self-build grid: each event with its compatibility against the route. While the route is
 * empty, by date; after the first pick the route's own events first, then the best fits, the
 * blocked last (each group by date).
 */
export function catalogItems(route: Event[], list: Event[], s: ItinerarySettings): CatalogItem[] {
  const trip = sortRoute(route);
  const ids = new Set(trip.map((e) => e.id));
  const rank = (i: CatalogItem) => (i.inRoute ? -1 : COMPAT_RANK[i.compat.status]);
  const items = list.map((event) => ({
    event,
    inRoute: ids.has(event.id),
    compat: compatibility(trip, event, s),
  }));
  return items.sort((a, b) => (trip.length ? rank(a) - rank(b) : 0) || byDay(a.event, b.event));
}
