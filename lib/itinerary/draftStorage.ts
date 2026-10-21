/**
 * sessionStorage side of the trip's draft - the rules are in ./draft.ts.
 *
 * Browser only, and never from a render (the first client render must match the server's
 * HTML). Every call is wrapped: private mode, a full quota or blocked storage must never break
 * the trip - it carries on in memory, as it did before there was a draft.
 */
import type { Event } from "@/lib/app.types";
import {
  ITINERARY_DRAFT_KEY,
  parseDraft,
  serializeDraft,
  type HeldTicket,
  type ItineraryDraftForm,
  type PageNavigation,
  type RestoredDraft,
} from "./draft";
import type { ItineraryState } from "./state";

const storage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

/** How this document was loaded (reload / back_forward / navigate) and at which URL; null when the browser does not say. */
export function pageNavigation(): PageNavigation | null {
  try {
    const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return entry ? { type: entry.type, name: entry.name } : null;
  } catch {
    return null;
  }
}

/** The trip this tab held, matched against the page's catalog; a stale or broken one is removed. */
export function readItineraryDraft(catalog: Map<number, Event>): RestoredDraft | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(ITINERARY_DRAFT_KEY);
    const draft = parseDraft(raw, Date.now(), catalog);
    if (raw && !draft) store.removeItem(ITINERARY_DRAFT_KEY);
    return draft;
  } catch (error) {
    console.error("[EuroTrip] Trip draft could not be read:", error);
    return null;
  }
}

/** Saves the trip (no route = nothing to keep: the draft goes). */
export function writeItineraryDraft(
  state: ItineraryState,
  extra: { held?: Record<number, HeldTicket>; form?: ItineraryDraftForm | null },
) {
  const store = storage();
  if (!store) return;
  try {
    if (!state.route.length) store.removeItem(ITINERARY_DRAFT_KEY);
    else store.setItem(ITINERARY_DRAFT_KEY, serializeDraft(state, Date.now(), extra));
  } catch (error) {
    console.error("[EuroTrip] Trip draft could not be saved:", error);
  }
}

/** The trip is done (held or paid) or abandoned on purpose: forget it. */
export function forgetItineraryDraft() {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(ITINERARY_DRAFT_KEY);
  } catch {
    /* nothing to forget */
  }
}
