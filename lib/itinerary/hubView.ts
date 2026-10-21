/**
 * "Build Your Euro Trip" - the hub's view over the route cards: search, month, kind, sort and
 * "הצג עוד". Pure, and light on purpose: the hub's client bundle imports this module, so it
 * reads only the cards' plain data (`RouteCardData` is a type import) - never the estimator,
 * the dates or the rules behind ./routeCard.
 */
import { intBetween, oneOf } from "@/lib/viewState";
import type { RouteCardData } from "./routeCard";

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
const MAX_QUERY = 100;
const MAX_VISIBLE = 2000;

/** A stored hub view when every field has the right shape, else null (all or nothing). */
export function parseHubView(value: unknown): HubView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const kind = oneOf(HUB_KINDS)(v.kind);
  const sort = oneOf(HUB_SORTS)(v.sort);
  const visible = intBetween(1, MAX_VISIBLE)(v.visible);
  const { query, month } = v;
  if (typeof query !== "string" || query.length > MAX_QUERY) return null;
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
