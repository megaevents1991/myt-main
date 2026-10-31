"use server";

import { randomUUID } from "node:crypto";

import type { Event } from "@/lib/app.types";
import { getCachedEvents, getEvents } from "@/lib/eventsData";
import { pickFreshTripEvents, pickTripEvents, tripEventIds } from "@/lib/itinerary/adapter";
import { sortRoute } from "@/lib/itinerary/rules";
import { itineraryOn } from "@/lib/itinerary/settings";
import { getItinerarySettings } from "@/lib/itinerary/settings.server";
import { MIN_TRIP_EVENTS } from "@/lib/itinerary/state";
import { cleanSuggestTitle, type SuggestionRow } from "@/lib/itinerary/suggestion";
import { supabase } from "@/lib/supabase";

/**
 * "Build Your Euro Trip" - the full rows of the trip's events, for the tickets step.
 *
 * The builder ships a slim catalog (lib/itinerary/slim.ts: the cheapest ticket, no map); the
 * live ticket step needs every category, the seat map and the supplier ids. Read from the
 * cached catalog - the listed events, backoffice columns already dropped - never from
 * `/api/events?id=` (an uncached `select *` per call that also returns hidden rows). At most
 * MAX_TRIP_LOAD ids per call (the step never asks for more), and only events a trip may hold
 * today: an asked id missing from the answer is gone.
 *
 * Throws - the step then offers a retry, never "the event is gone" - when the feature is
 * switched off (same switch as the page) or the catalog itself is unavailable
 * (`getCachedEvents` answers an outage with no events).
 */
export async function loadTripEvents(ids: number[]): Promise<Event[]> {
  if (!itineraryOn(await getItinerarySettings(), process.env.VERCEL_ENV)) {
    throw new Error("Euro trip: the trip builder is switched off");
  }
  const wanted = tripEventIds(ids);
  if (!wanted.length) return [];
  const { events } = await getCachedEvents();
  if (!events.length) throw new Error("Euro trip: the events catalog is unavailable");
  return pickTripEvents(events, wanted, new Date().toISOString().slice(0, 10));
}

/**
 * The same rows, read FRESH from the database (`getEvents(id)` per id, at most MAX_TRIP_LOAD) -
 * only after the hold's confirm answered that the price or a ticket changed: it prices with these
 * rows, and the cached catalog can be up to an hour older (a backoffice edit not revalidated yet).
 * Listed and eligible events only (`pickFreshTripEvents`, the catalog's own filters); an asked id
 * missing from the answer is gone. The tickets step keeps using `loadTripEvents` (cached).
 *
 * Throws when the builder is switched off, or when every read came back empty (`getEvents`
 * answers a database error with no rows - never "every event is gone" on an outage).
 */
export async function loadTripEventsFresh(ids: number[]): Promise<Event[]> {
  if (!itineraryOn(await getItinerarySettings(), process.env.VERCEL_ENV)) {
    throw new Error("Euro trip: the trip builder is switched off");
  }
  const wanted = tripEventIds(ids);
  if (!wanted.length) return [];
  const rows = await Promise.all(wanted.map(async (id) => (await getEvents(id)).events[0]));
  if (rows.every((r) => !r)) throw new Error("Euro trip: no event row could be read");
  return pickFreshTripEvents(rows, wanted, new Date().toISOString().slice(0, 10));
}

/**
 * "רוצים שנציע את הטיול שלכם גם לאחרים?" - sent on its own button, for the team's review (Dor 31.10:
 * "שלח לבדיקה של הצוות"), no hold needed. One `itinerary_route_requests` row: the events the server
 * re-read, in trip order, the name cleaned, and whatever the summary's form holds of the contact. The
 * row belongs to no reservation, so its `itinerary_group` is its own. Never throws (a thrown Server
 * Action is hidden in production): `{ ok: false }` = said on the card.
 */
export async function sendTripSuggestion(input: {
  eventIds: number[];
  title: string;
  pax: number;
  contact: { name: string; email: string; phone: string };
}): Promise<{ ok: boolean }> {
  try {
    if (!itineraryOn(await getItinerarySettings(), process.env.VERCEL_ENV)) return { ok: false };
    const wanted = tripEventIds(input.eventIds);
    if (wanted.length < MIN_TRIP_EVENTS) return { ok: false };
    const { events } = await getCachedEvents();
    const found = pickTripEvents(events, wanted, new Date().toISOString().slice(0, 10));
    if (found.length !== wanted.length) return { ok: false };
    const text = (v: unknown): string => (typeof v === "string" ? v.trim().slice(0, 200) : "");
    const row: SuggestionRow = {
      title: cleanSuggestTitle(input.title) || null,
      event_ids: sortRoute(found).map((e) => e.id),
      itinerary_group: randomUUID(),
      reservation_id: null,
      pax: Number.isInteger(input.pax) && input.pax > 0 ? input.pax : 1,
      contact_name: text(input.contact?.name),
      contact_email: text(input.contact?.email),
      contact_phone: text(input.contact?.phone),
    };
    const { error } = await supabase.from("itinerary_route_requests").insert(row);
    if (error) {
      console.error("[EuroTrip] trip suggestion not saved:", JSON.stringify(error));
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    console.error("[EuroTrip] trip suggestion failed:", error);
    return { ok: false };
  }
}
