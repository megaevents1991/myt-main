/**
 * "Build Your Euro Trip" - the tab remembers a trip it held. Pure: no I/O, no clock (the caller
 * hands `now`); the storage calls are in ./draftStorage.ts.
 *
 * A hold closes the trip's draft, but a refresh of the builder (`?events=` is still in the URL)
 * opens the same route again, ready for a second hold - a duplicate group for sales. So a
 * successful hold leaves a small marker in this tab (sessionStorage): the group, the trip
 * (`tripKey`) and the reference. When the builder opens on the SAME trip within 24 hours (the
 * hold's own life), it says so quietly at the top - the customer may still go on (no block: they
 * may want to change it, or they know what they are doing).
 */

export const HELD_MARKER_KEY = "myt:itinerary-held";

/** A hold lasts 24 hours; after that the marker says nothing. */
export const HELD_MARKER_TTL_MS = 24 * 60 * 60 * 1000;

/** What the builder says when it opens on a trip this tab already held. */
export const PRIOR_HOLD_NOTICE = "כבר שמרתם את הטיול הזה ל-24 שעות - נציג יחזור אליכם";

export type HeldMarker = {
  /** The held group (`itinerary_group`). */
  group: string;
  /** The trip it held (`tripKey`). */
  tripKey: string;
  /** Seq 1's booking reference, when it was saved. */
  reference: string | null;
  /** When it was held (ms). */
  at: number;
};

export function serializeHeldMarker(m: Omit<HeldMarker, "at">, now: number): string {
  const marker: HeldMarker = { group: m.group, tripKey: m.tripKey, reference: m.reference ?? null, at: now };
  return JSON.stringify(marker);
}

/** The marker in storage, or null: none, broken, from the future, or older than 24 hours. */
export function parseHeldMarker(raw: string | null | undefined, now: number): HeldMarker | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const { group, tripKey, reference, at } = v as Record<string, unknown>;
  if (typeof group !== "string" || !group || typeof tripKey !== "string" || !tripKey) return null;
  if (reference !== null && reference !== undefined && typeof reference !== "string") return null;
  if (typeof at !== "number" || !Number.isFinite(at) || at > now || now - at > HELD_MARKER_TTL_MS) return null;
  return { group, tripKey, reference: reference ?? null, at };
}

/** The marker when it is for this trip (`tripKey`), else null. */
export function priorHoldFor(marker: HeldMarker | null, tripKey: string): HeldMarker | null {
  return marker && marker.tripKey === tripKey ? marker : null;
}
