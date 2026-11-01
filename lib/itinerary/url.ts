/**
 * "Build Your Euro Trip" - the builder's `?events=` parameter. Pure: no I/O.
 *
 * The page never reads the URL on the server (it stays cached); the builder reads
 * `window.location.search` after hydration, turns it into ids here, and matches them
 * against the catalog the page handed down.
 */
import type { Event } from "@/lib/app.types";

const ID_RE = /^\d+$/;

/** What `HIDE_UNTIL_ROUTE_SCRIPT` adds to the page, and what it hides. */
export const ROUTE_WAIT_STYLE_ID = "trip-route-wait";
export const TRIP_BODY_CLASS = "trip-flow-body";
/** Never hidden for longer than this, whatever happens to the page's code. */
const ROUTE_WAIT_MAX_MS = 8000;

/**
 * The page is cached, so the server always prints the empty planner. A link that names a trip would
 * show it until the browser has read the route (a second on a phone), then jump: this runs in the
 * printed page, before the first paint, and hides the flow until `ItineraryFlow` takes the style off.
 * A style in the head, not an attribute on an element React hydrates.
 */
export const HIDE_UNTIL_ROUTE_SCRIPT = `if(/[?&]events=/.test(location.search)){var s=document.createElement("style");s.id="${ROUTE_WAIT_STYLE_ID}";s.textContent=".${TRIP_BODY_CLASS}{visibility:hidden}";document.head.appendChild(s);setTimeout(function(){s.remove()},${ROUTE_WAIT_MAX_MS})}`;

/**
 * `?events=618,702` -> `{ ids: [618, 702], overflow: [] }`: positive integers only, each once,
 * in their order, at most `max` of them in `ids`. The valid ids past the cap come back in
 * `overflow` - a link that names more events than a trip holds is not "whole". Anything else in
 * the list is skipped, never an error.
 */
export function readEventsParam(raw: string | null, max = 3): { ids: number[]; overflow: number[] } {
  const ids: number[] = [];
  const overflow: number[] = [];
  if (!raw) return { ids, overflow };
  for (const part of raw.split(",")) {
    const s = part.trim();
    if (!ID_RE.test(s)) continue;
    const id = Number(s);
    if (!Number.isSafeInteger(id) || id <= 0 || ids.includes(id) || overflow.includes(id)) continue;
    if (ids.length < max) ids.push(id);
    else overflow.push(id);
  }
  return { ids, overflow };
}

/** `readEventsParam`'s ids alone: `?events=618,702` -> `[618, 702]`, at most `max`. */
export function parseEventsParam(raw: string | null, max = 3): number[] {
  return readEventsParam(raw, max).ids;
}

/** The ids' events, in the ids' order; an id the catalog does not hold is `dropped`. */
export function reconcileRoute(
  ids: number[],
  catalog: Map<number, Event>,
): { route: Event[]; dropped: number[] } {
  const route: Event[] = [];
  const dropped: number[] = [];
  for (const id of ids) {
    const e = catalog.get(id);
    if (e) route.push(e);
    else dropped.push(id);
  }
  return { route, dropped };
}

/** The value `?events=` carries for a route; null = no route, the parameter leaves the URL. */
export function eventsParamValue(route: Event[]): string | null {
  return route.length ? route.map((e) => e.id).join(",") : null;
}
