"use server";

import type { Event } from "@/lib/app.types";
import { getCachedEvents } from "@/lib/eventsData";
import { pickTripEvents, tripEventIds } from "@/lib/itinerary/adapter";
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
