import { supabase } from "@/lib/supabase";
import type { Event } from "@/lib/app.types";
import {
  isLockedPackageSoldOut,
  type LockedFlightInventory,
} from "@/lib/flights/lockedPackageSoldOut";

/**
 * A locked package sells exactly one offline flight and deliberately has no
 * fallback to a dynamic search — so when that flight runs out, the package is
 * gone, not merely flightless. The catalog card decides sold-out from ticket
 * availability alone, which left a locked-and-empty package advertised as
 * bookable right up until the customer reached the flight step and hit the
 * sold-out panel.
 *
 * This marks those events so `isEventSoldOut` can agree with the order page.
 * It runs once per events load (inside the hourly cache), not per card, and
 * costs nothing at all when no event is locked.
 *
 * Fails open: a transient database error leaves every event unmarked rather
 * than hiding the catalog. Overselling is still blocked at booking time by the
 * flight search, which does its own check.
 */
export async function markLockedPackagesSoldOut(
  events: Event[],
): Promise<Event[]> {
  const lockedEvents = events.filter((event) => event.locked_flight_id);
  if (lockedEvents.length === 0) return events;

  const eventIds = lockedEvents.map((event) => event.id);
  const flightIds = [
    ...new Set(lockedEvents.map((event) => event.locked_flight_id as number)),
  ];

  try {
    const [flightsResult, allocationsResult, consumedResult] = await Promise.all([
      supabase
        .from("flights")
        .select("id, initial_quantity, consumed_quantity, is_deleted")
        .in("id", flightIds),
      supabase
        .from("flight_event_allocations")
        .select("event_id, flight_id, allocated_seats")
        .in("event_id", eventIds),
      supabase
        .from("flight_event_consumed")
        .select("event_id, flight_id, consumed_seats")
        .in("event_id", eventIds),
    ]);

    const failure =
      flightsResult.error || allocationsResult.error || consumedResult.error;
    if (failure) {
      console.error(
        "[LockedPackages] availability lookup failed — leaving cards unmarked:",
        JSON.stringify(failure),
      );
      return events;
    }

    const flightById = new Map<number, LockedFlightInventory>(
      (flightsResult.data ?? []).map((flight) => [flight.id, flight]),
    );

    // Keyed per (event, flight): the same flight can carry a different
    // allocation for each event linked to it.
    const key = (eventId: number, flightId: number) => `${eventId}:${flightId}`;
    const consumedByPair = new Map<string, number>(
      (consumedResult.data ?? []).map((row) => [
        key(row.event_id, row.flight_id),
        row.consumed_seats,
      ]),
    );
    const allocationRemaining = new Map<string, number>(
      (allocationsResult.data ?? []).map((row) => {
        const pairKey = key(row.event_id, row.flight_id);
        return [pairKey, row.allocated_seats - (consumedByPair.get(pairKey) ?? 0)];
      }),
    );

    const soldOutEventIds = new Set(
      lockedEvents
        .filter((event) => {
          const flightId = event.locked_flight_id as number;
          return isLockedPackageSoldOut(
            flightId,
            flightById.get(flightId),
            allocationRemaining.get(key(event.id, flightId)),
          );
        })
        .map((event) => event.id),
    );

    if (soldOutEventIds.size === 0) return events;

    return events.map((event) =>
      soldOutEventIds.has(event.id)
        ? { ...event, locked_flight_sold_out: true }
        : event,
    );
  } catch (error) {
    console.error(
      "[LockedPackages] availability lookup threw — leaving cards unmarked:",
      error,
    );
    return events;
  }
}
