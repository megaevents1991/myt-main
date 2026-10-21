"use server";

import type { Event } from "@/lib/app.types";
import { getCachedEvents, getEvents } from "@/lib/eventsData";
import { pickFreshTripEvents, pickTripEvents, tripEventIds } from "@/lib/itinerary/adapter";
import { itineraryOn } from "@/lib/itinerary/settings";
import { getItinerarySettings } from "@/lib/itinerary/settings.server";

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
