/**
 * "Build Your Euro Trip" - the trips staff built by hand in the backoffice (`itinerary_routes`),
 * as hub cards. Pure: no I/O, no clock (`todayIso` is a parameter). The cached read of the table
 * is in ./routes.server.
 *
 * A staff trip leads the hub under its own title. It never shows short or broken: a trip whose
 * event sold out, moved to the US, came closer than the sell window, left the catalog, or no
 * longer fits with the others (distance, span, a trip that may hold fewer events now) simply
 * does not appear - the backoffice status line tells staff why.
 */
import type { Event } from "@/lib/app.types";
import { isItineraryEligible } from "./eligibility";
import { toRouteCard, type RouteCardData } from "./routeCard";
import type { ItinerarySettings } from "./settings";
import { fitRoute } from "./state";

/** One active row of `itinerary_routes`, in the shape the hub needs. */
export type StaffRouteRow = {
  id: number;
  /** The title staff gave the trip, trimmed, never blank. */
  title: string;
  /** The events' ids, 2 or 3, each a whole number. Any order - the card puts them in trip order. */
  event_ids: number[];
  sort_order: number;
};

/** A trip is two or three events (the same range `max_events` allows). */
const MIN_EVENTS = 2;
const MAX_EVENTS = 3;

/** A positive whole number from a JSON number (or the digits of one); NaN for anything else. */
function wholeId(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : NaN;
}

/**
 * The rows the table answered, with the malformed ones dropped (a row with a blank title, a
 * missing `id`, fewer than two or more than three event ids, or an id that is not a whole number).
 * Never throws; the reader's order (`sort_order`, then `id`) is kept.
 */
export function parseStaffRouteRows(data: unknown): StaffRouteRow[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((raw): StaffRouteRow[] => {
    if (!raw || typeof raw !== "object") return [];
    const r = raw as Record<string, unknown>;
    const id = wholeId(r.id);
    const title = typeof r.title === "string" ? r.title.trim() : "";
    if (Number.isNaN(id) || !title) return [];
    if (!Array.isArray(r.event_ids)) return [];
    const eventIds = r.event_ids.map(wholeId);
    if (eventIds.length < MIN_EVENTS || eventIds.length > MAX_EVENTS) return [];
    if (eventIds.some(Number.isNaN)) return [];
    const sortOrder = typeof r.sort_order === "number" && Number.isFinite(r.sort_order) ? r.sort_order : 0;
    return [{ id, title, event_ids: eventIds, sort_order: sortOrder }];
  });
}

/**
 * The cards of the rows that still hold, in the rows' order. A row becomes a card only when EVERY
 * id is in the catalog, each event is `isItineraryEligible`, and `fitRoute` takes all of them with
 * nothing refused (so a repeated id, two events on one day, a trip too far or too long, or more
 * events than `maxEvents` allows all drop the row). The card is `toRouteCard` plus `staffTitle`.
 */
export function staffRouteCards(
  rows: StaffRouteRow[],
  events: Event[],
  s: ItinerarySettings,
  todayIso: string,
): RouteCardData[] {
  const byId = new Map(events.map((e) => [e.id, e]));
  return rows.flatMap((row): RouteCardData[] => {
    const route = row.event_ids.flatMap((id): Event[] => {
      const e = byId.get(id);
      return e ? [e] : [];
    });
    if (route.length !== row.event_ids.length) return [];
    if (!route.every((e) => isItineraryEligible(e, todayIso))) return [];
    const fit = fitRoute(route, s);
    if (fit.refused.length > 0 || fit.route.length !== row.event_ids.length) return [];
    return [{ ...toRouteCard(fit.route, s), staffTitle: row.title }];
  });
}

/** The same set of events, whatever the order: the hub's one-card-per-trip key. */
const setKey = (c: RouteCardData): string => [...c.ids].sort((a, b) => a - b).join("-");

/**
 * Staff cards first (their order), then the automatic ones - without any whose events a staff card
 * already holds. A staff card on a set of events shows once (the first); the hub keys its cards by
 * their ids, so two cards on the same events would collide.
 */
export function mergeRouteCards(staff: RouteCardData[], auto: RouteCardData[]): RouteCardData[] {
  const seen = new Set<string>();
  const out: RouteCardData[] = [];
  for (const c of [...staff, ...auto]) {
    const key = setKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}
