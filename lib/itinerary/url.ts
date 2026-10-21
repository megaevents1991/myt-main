/**
 * "Build Your Euro Trip" - the builder's `?events=` parameter. Pure: no I/O.
 *
 * The page never reads the URL on the server (it stays cached); the builder reads
 * `window.location.search` after hydration, turns it into ids here, and matches them
 * against the catalog the page handed down.
 */
import type { Event } from "@/lib/app.types";

const ID_RE = /^\d+$/;

/**
 * `?events=618,702` -> `[618, 702]`: positive integers only, each once, in their order,
 * at most `max` of them. Anything else in the list is skipped, never an error.
 */
export function parseEventsParam(raw: string | null, max = 3): number[] {
  if (!raw) return [];
  const out: number[] = [];
  for (const part of raw.split(",")) {
    if (out.length >= max) break;
    const s = part.trim();
    if (!ID_RE.test(s)) continue;
    const id = Number(s);
    if (!Number.isSafeInteger(id) || id <= 0 || out.includes(id)) continue;
    out.push(id);
  }
  return out;
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
