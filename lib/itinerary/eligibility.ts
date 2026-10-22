/**
 * "Build Your Euro Trip" - which events may go into a trip (spec §4).
 * `getCachedEvents()` already lists only what the site lists; this repeats that (a second guard)
 * and adds the rest.
 */
import type { Event } from "@/lib/app.types";
import { isEventSoldOut, isTicketOnlyEvent } from "@/lib/events/price";
import { dayDiff, eventDay } from "./geo";

// Same value as AVAILABILITY_WINDOW_DAYS in lib/eventsData.ts:152 (the order page's sell
// window). Defined here, not imported: eventsData builds the Supabase client at module
// load, which throws without env vars and would break this pure module's unit test.
const AVAILABILITY_WINDOW_DAYS = 3;

/**
 * Listed on the site - what the catalog the builder reads keeps (`isListedEvent`, lib/eventsData.ts,
 * repeated: that file loads the database client): not a QA event (`is_test`), not taken off the
 * site (`deactivated_reason`), and not hidden until approved (`is_hidden`, added on main - read
 * tolerantly, absent = listed). A row read by id (`getEvents(id)`) is NOT filtered by these, so a
 * trip checks them itself.
 */
export function isListedForTrip(e: Event): boolean {
  const hidden = (e as Event & { is_hidden?: unknown }).is_hidden === true;
  return !e.is_test && !e.deactivated_reason && !hidden;
}

/**
 * A trip is flights + hotels around the tickets, in Europe: so a LISTED event (`isListedForTrip` -
 * a second guard behind the catalog's own filter, which on this branch's base does not know
 * `is_hidden` yet), not a ticket-only event, not sold out, not in the US, and at least the sell
 * window (3 days) away. Every list of trip events reads it - the hub's routes (`recommendRoutes`),
 * the builder's catalog, the tickets step's rows (`pickTripEvents`) and the hold's re-read - so a
 * hidden, QA or deactivated event never shows on the hub or in the builder.
 * `todayIso` is `YYYY-MM-DD` - the caller owns the clock.
 */
export function isItineraryEligible(e: Event, todayIso: string): boolean {
  if (!isListedForTrip(e)) return false;
  if (isTicketOnlyEvent(e)) return false;
  if (isEventSoldOut(e)) return false;
  if (e.location?.country_code?.toUpperCase() === "US") return false;
  return dayDiff(todayIso, eventDay(e)) >= AVAILABILITY_WINDOW_DAYS;
}
