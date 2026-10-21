/**
 * "Build Your Euro Trip" - what a route card shows, and the hub's filters over the cards.
 * Pure: no I/O, no clock. The page resolves the events and hands them in; the client gets
 * plain data (no Event rows), so the hub's bundle and its HTML stay small.
 */
import type { Event } from "@/lib/app.types";
import { cityName, defaultCity, eventCityName } from "@/lib/events/lodging";
import { intBetween, oneOf } from "@/lib/viewState";
import { defaultTripDates, stays } from "./dates";
import { dayDiff, eventDay, eventKind } from "./geo";
import { estimateItinerary } from "./price";
import { sortRoute } from "./rules";
import type { ItinerarySettings } from "./settings";

export type RouteCardArt = {
  imageUrl: string | null;
  awayImageUrl: string | null;
  variant: "blob" | "photo";
  colorIndex?: number;
  shapeIndex?: number;
  imageScale?: number | null;
  bgScale?: number | null;
  imageOffsetX?: number | null;
  imageOffsetY?: number | null;
};

export type RouteCardData = {
  /** The events' ids in trip order - what `/euro-trip/build?events=` opens. */
  ids: number[];
  /** The stay cities joined " ← " ("פריז ← לונדון"). */
  title: string;
  events: { id: number; name: string; day: string; cityName: string; art: RouteCardArt }[];
  /** The stays' city names in trip order (a city named once while the trip stays in it). */
  cities: string[];
  /** Nights from the default departure to the default return. */
  nights: number;
  /** Hotels in the trip: one per run of events in one city. */
  stays: number;
  /** The estimate, USD per traveller, whole dollars. */
  perTraveller: number;
  /** Against buying every event as its own package; null below $50. */
  saving: number | null;
  /** Each kind once, in trip order. */
  kinds: ("music" | "football")[];
  /** The first event's day, `YYYY-MM-DD`. */
  firstDay: string;
};

/** The card art exactly as the homepage card picks it (components/ClientSideHomepage.tsx). */
function cardArt(e: Event): RouteCardArt {
  return {
    imageUrl: (e.match_away_logo_url ? e.match_home_logo_url : e.art_image_url || e.card_image_url) ?? null,
    awayImageUrl: e.match_away_logo_url ?? null,
    variant: e.art_image_url ? "blob" : "photo",
    colorIndex: e.art_color_index ?? undefined,
    shapeIndex: e.art_shape_index ?? undefined,
    imageScale: e.art_image_scale ?? null,
    bgScale: e.art_bg_scale ?? null,
    imageOffsetX: e.art_image_offset_x ?? null,
    imageOffsetY: e.art_image_offset_y ?? null,
  };
}

/** The card for a route: dates, stays and price from the trip's default dates, no flight quote. */
export function toRouteCard(route: Event[], s: ItinerarySettings): RouteCardData {
  const trip = sortRoute(route);
  const d = defaultTripDates(trip);
  const list = stays(trip, d);
  // A stay's city as the hotel step names it. Neighbouring stays always differ by place, but two
  // places may carry one name - the title then names the city once, not "לונדון ← לונדון".
  const cities = list
    .map((stay) => cityName(stay.events[0], defaultCity(stay.events[0])))
    .filter((name, i, all) => i === 0 || name !== all[i - 1]);
  const { perTraveller, saving } = estimateItinerary(trip, d, s, null);
  const kinds = [...new Set(trip.map(eventKind))];

  return {
    ids: trip.map((e) => e.id),
    title: cities.join(" ← "),
    events: trip.map((e) => ({
      id: e.id,
      name: e.name,
      day: eventDay(e),
      // Where the event itself is played (a Manchester match sold as a flight to London says Manchester).
      cityName: eventCityName(e),
      art: cardArt(e),
    })),
    cities,
    nights: trip.length ? dayDiff(d.depart, d.ret) : 0,
    stays: list.length,
    perTraveller,
    saving,
    kinds,
    firstDay: trip.length ? eventDay(trip[0]) : "",
  };
}

/* ── The hub's view: search, month, kind, sort, "הצג עוד" ── */

export const HUB_KINDS = ["all", "music", "football", "mix"] as const;
export type HubKind = (typeof HUB_KINDS)[number];
export const HUB_SORTS = ["recommended", "price", "date"] as const;
export type HubSort = (typeof HUB_SORTS)[number];

/** Cards per "page" of the hub's grid. */
export const HUB_PAGE_SIZE = 12;

export type HubView = {
  query: string;
  /** `YYYY-MM`, "" = every month. */
  month: string;
  kind: HubKind;
  sort: HubSort;
  /** How many cards "הצג עוד" has opened. */
  visible: number;
};

export const DEFAULT_HUB_VIEW: HubView = {
  query: "",
  month: "",
  kind: "all",
  sort: "recommended",
  visible: HUB_PAGE_SIZE,
};

const MONTH_RE = /^\d{4}-\d{2}$/;
const MAX_VISIBLE = 2000;

/** A stored hub view when every field has the right shape, else null (all or nothing). */
export function parseHubView(value: unknown): HubView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const kind = oneOf(HUB_KINDS)(v.kind);
  const sort = oneOf(HUB_SORTS)(v.sort);
  const visible = intBetween(1, MAX_VISIBLE)(v.visible);
  const { query, month } = v;
  if (typeof query !== "string" || query.length > 100) return null;
  if (typeof month !== "string" || (month !== "" && !MONTH_RE.test(month))) return null;
  if (kind === null || sort === null || visible === null) return null;
  return { query, month, kind, sort, visible };
}

/** Every month an event of a route falls in, `YYYY-MM`, sorted: the month chips. */
export function hubMonths(cards: RouteCardData[]): string[] {
  return [...new Set(cards.flatMap((c) => c.events.map((e) => e.day.slice(0, 7))))].sort();
}

const kindMatches = (c: RouteCardData, kind: HubKind): boolean => {
  if (kind === "all") return true;
  if (kind === "mix") return c.kinds.length > 1;
  return c.kinds.length === 1 && c.kinds[0] === kind;
};

/**
 * The cards the view shows, in its order (a new array; the input keeps the recommender's order).
 * Search: any event name or city. Month: any event of the route in it. Sort: as recommended, by
 * price (cheapest first) or by the first event's day - a tie keeps the recommended order.
 */
export function hubCards(cards: RouteCardData[], view: HubView): RouteCardData[] {
  const q = view.query.trim().toLowerCase();
  const out = cards.filter((c) => {
    if (!kindMatches(c, view.kind)) return false;
    if (view.month && !c.events.some((e) => e.day.startsWith(view.month))) return false;
    if (!q) return true;
    return (
      c.events.some((e) => e.name.toLowerCase().includes(q) || e.cityName.toLowerCase().includes(q)) ||
      c.cities.some((city) => city.toLowerCase().includes(q))
    );
  });
  if (view.sort === "price") return [...out].sort((a, b) => a.perTraveller - b.perTraveller);
  if (view.sort === "date") return [...out].sort((a, b) => a.firstDay.localeCompare(b.firstDay));
  return out;
}
