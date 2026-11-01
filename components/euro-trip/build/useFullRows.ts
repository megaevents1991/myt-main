"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { loadTripEvents } from "@/app/euro-trip/build/actions";
import { MAX_TRIP_LOAD, asFullRow, goneIds, isFullRow } from "@/lib/itinerary/adapter";
import { useItinerary } from "./ItineraryProvider";

/** The same words the route link uses for an event that left the catalog. */
const GONE = "האירוע כבר לא זמין";

/**
 * The route's events still hold the builder's slim catalog rows (lib/itinerary/slim.ts);
 * the ticket step needs them whole. One Server Action call for every slim row, when the step
 * opens (a row loaded before - the customer came back from a later step - is not loaded
 * again; never more than MAX_TRIP_LOAD per call, the action's own cap). A row that comes back
 * is swapped in (`setEventData`: same trip, so the picks stay); an asked id that does not
 * come back left the catalog - the route's notice says so and it leaves the route, unless the
 * customer already took it out while the answer was on its way. Called by the screen that waits for
 * the trip's price too (TripQuoteWait), so the rows are whole by the time the tickets open.
 */
export function useFullRows(): { failed: boolean; retry: () => void } {
  const { state, setEventData, removeEvent, showNotice } = useItinerary();
  const key = state.route
    .filter((e) => !isFullRow(e))
    .slice(0, MAX_TRIP_LOAD)
    .map((e) => e.id)
    .join(",");
  // The route when the answer lands, not when it was asked.
  const route = useRef(state.route);
  useLayoutEffect(() => {
    route.current = state.route;
  });
  const [attempt, setAttempt] = useState(0);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  // One call per (rows, attempt) - never a second one while it is answered.
  const asked = useRef<string | null>(null);

  useEffect(() => {
    if (!key) return;
    const ask = `${key}#${attempt}`;
    if (asked.current === ask) return;
    asked.current = ask;
    setFailedFor(null);
    const ids = key.split(",").map(Number);
    loadTripEvents(ids)
      .then((rows) => {
        for (const row of rows) setEventData(asFullRow(row));
        const gone = goneIds(
          ids,
          rows,
          route.current.map((e) => e.id),
        );
        if (!gone.length) return;
        showNotice(GONE);
        for (const id of gone) removeEvent(id);
      })
      .catch((err) => {
        console.error("[EuroTrip] Failed to load the trip's events:", err);
        setFailedFor(ask);
      });
    // The actions only dispatch to the provider - any render's copy does the same.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return {
    failed: failedFor === `${key}#${attempt}`,
    retry: () => setAttempt((a) => a + 1),
  };
}
