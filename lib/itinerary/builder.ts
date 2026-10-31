/**
 * "Build Your Euro Trip" - what the builder's planner and its event picker show. Pure: no I/O,
 * no clock. The components render these lists; every rule comes from `rules.ts`.
 */
import type { Event } from "@/lib/app.types";
import { cityName, defaultCity, eventCityName, hasEventCity } from "@/lib/events/lodging";
import { stays } from "./dates";
import { dayDiff, eventDay, eventKind, haversineKm, sameCity } from "./geo";
import { compatibility, isAddable, sortRoute } from "./rules";
import type { ItinerarySettings } from "./settings";
import type { Compat, CompatStatus } from "./types";

/** `YYYY-MM-DD` -> `DD/MM/YY`. */
export const dayMonthYear = (day: string): string => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(2, 4)}`;

/** `YYYY-MM-DD` -> `DD/MM`. */
export const dayMonth = (day: string): string => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

/** The city the traveller sleeps in for this event, as the hotel step names it ("לונדון"). */
export const stayCityName = (e: Event): string => cityName(e, defaultCity(e));

/**
 * A sub-location's way there: the flight lands in one city and the event is in another (Manchester,
 * sold as a flight to London). Null for an event in its flight city.
 */
export function groundLink(e: Event): { from: string; to: string; km: number } | null {
  if (!hasEventCity(e) || !e.event_location) return null;
  return { from: cityName(e, "flight"), to: cityName(e, "event"), km: haversineKm(e.location, e.event_location) };
}

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

export type CatalogKind = "all" | "football" | "music";
/** `city` = an `eventCityName` from `catalogCities`; `""` = every city (like `month`). */
export type CatalogFilter = { query: string; month: string; kind: CatalogKind; city: string };

/** Every month an event falls in, `YYYY-MM`, sorted: the self-build month chips. */
export function catalogMonths(catalog: Event[]): string[] {
  return [...new Set(catalog.map((e) => eventDay(e).slice(0, 7)))].sort();
}

/**
 * Every city an event takes place in (`eventCityName` - the event's own city, not its flight
 * city), once each, in Hebrew order: the self-build city chips.
 */
export function catalogCities(catalog: Event[]): string[] {
  return [...new Set(catalog.map(eventCityName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he"));
}

/**
 * The self-build search, then month, kind and city. Like the site's search (`multiTermSearch`,
 * lib/search.ts) every word of the query must match, each in any field - "באד באני פריז" is the
 * artist AND the city - over the Hebrew name, the English name, the event's city and the flight
 * city. Plain substring matching: the builder's list is the catalog itself, no fuzzy index.
 */
export function filterCatalog(catalog: Event[], f: CatalogFilter): Event[] {
  const words = f.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return catalog.filter((e) => {
    if (f.kind !== "all" && eventKind(e) !== f.kind) return false;
    if (f.month && !eventDay(e).startsWith(f.month)) return false;
    if (f.city && eventCityName(e) !== f.city) return false;
    if (!words.length) return true;
    const text = [e.name, e.name_english ?? "", eventCityName(e), e.location?.name ?? ""].join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

export type CatalogItem = Candidate & {
  inRoute: boolean;
  /** Nothing can join this event (`hasTripPartner`), said on its row while the trip is empty. */
  lonely?: boolean;
};

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

// ---------------------------------------------------------------------------------------------
// Search first (Alon + Dor 28.10: "לזרוק עליו את כל האירועים זה מבלבל" - a search engine, the
// filters behind one "סינון" button, and suggestions instead of the whole catalog)
// ---------------------------------------------------------------------------------------------

/** No search words and no month, kind or city: the planner suggests instead of listing the catalog. */
export function isBrowsing(f: CatalogFilter): boolean {
  return !f.query.trim() && activeFilterCount(f) === 0;
}

/** How many of month / kind / city are set - the "סינון" button's count. */
export function activeFilterCount(f: CatalogFilter): number {
  return (f.month ? 1 : 0) + (f.kind !== "all" ? 1 : 0) + (f.city ? 1 : 0);
}

/** The cities with the most events, most first (a tie in Hebrew order): where a trip can start. */
export function topCities(catalog: Event[], n: number): { city: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of catalog) {
    const city = eventCityName(e);
    if (city) counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  return [...counts]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, "he"))
    .slice(0, Math.max(0, n));
}

/**
 * A first event to start from: the site's most wanted (`is_prioritized`) first, then the soonest -
 * one show per name, so an artist with five dates does not fill the row.
 */
export function starterEvents(catalog: Event[], n: number): Event[] {
  const seen = new Set<string>();
  const out: Event[] = [];
  const ordered = [...catalog].sort((a, b) => Number(!!b.is_prioritized) - Number(!!a.is_prioritized) || byDay(a, b));
  for (const e of ordered) {
    if (out.length >= n) break;
    const name = e.name.trim();
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(e);
  }
  return out;
}

/**
 * What can still join the route, best fit first (`catalogItems`' order): not the route's own, not
 * the blocked, and not another date of a show already in it - nobody flies to see one show twice
 * (Dor 31.10; a search still finds it).
 */
export function fittingItems(items: CatalogItem[], route: Event[]): CatalogItem[] {
  const names = new Set(route.map((e) => e.name.trim()));
  return items.filter((i) => !i.inRoute && i.compat.status !== "blocked" && !names.has(i.event.name.trim()));
}

/**
 * Could this event open a trip? Some OTHER event - never another date of the same show - fits it
 * cleanly: close in distance and in date (`okGapDays`; a long gap is only a `warn`). An event with
 * none is still sold, and can still be picked; the finder says so on its row (Dor 31.10).
 */
export function hasTripPartner(e: Event, catalog: Event[], s: ItinerarySettings): boolean {
  const name = e.name.trim();
  const day = eventDay(e);
  return catalog.some((other) => {
    if (other.id === e.id || other.name.trim() === name) return false;
    if (Math.abs(dayDiff(day, eventDay(other))) > s.okGapDays) return false;
    const c = compatibility([e], other, s);
    return isAddable(c) && c.status !== "warn";
  });
}

/** The "רוצה לשלב עם" row over the suggestions: a kind, and / or only the cities already in the trip. */
export type QuickFilter = { kind: CatalogKind; sameCity: boolean };

export function quickFiltered(items: CatalogItem[], route: Event[], q: QuickFilter): CatalogItem[] {
  return items.filter(
    ({ event }) =>
      (q.kind === "all" || eventKind(event) === q.kind) && (!q.sameCity || route.some((r) => sameCity(r, event))),
  );
}
