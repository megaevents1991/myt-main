import {
  getCachedEvents,
  futureDateISO,
  AVAILABILITY_WINDOW_DAYS,
} from "@/lib/eventsData";
import { eventBelongsToTeam } from "@/lib/eventNameMatch";

/**
 * Builds a predicate that answers "do we currently have an available event for
 * this artist/team?" — the same rule the detail pages use via getEventsByName:
 * an event is counted when it is not deleted, is at least 7 days out, and its
 * name_english contains the item's English name (case-insensitive substring).
 *
 * Fetches all future events ONCE through the cached reader (shared `events`
 * tag), so a whole catalog page costs a single query, not one per item.
 * On any upstream failure getCachedEvents() yields { events: [] }, so the
 * predicate simply returns false for everything (all items fall to Wishlist).
 */
export async function getAvailabilityChecker(): Promise<
  (nameEnglish?: string) => boolean
> {
  const { events } = await getCachedEvents();

  // getCachedEvents/getEvents uses a looser 3-day window; re-filter to the
  // shared AVAILABILITY_WINDOW_DAYS so the catalog matches getEventsByName on
  // the detail pages. getEvents already filters is_deleted IS NULL, but guard
  // it here too so this stays correct if that query ever changes.
  const futureDate = futureDateISO(AVAILABILITY_WINDOW_DAYS);

  const availableNames = events
    .filter((e) => !e.is_deleted && e.name_english && e.date >= futureDate)
    .map((e) => e.name_english as string);

  return (nameEnglish?: string): boolean => {
    const needle = nameEnglish?.trim();
    if (!needle) return false;
    const low = needle.toLowerCase();
    // Substring gate + fixture-aware refinement, matching getEventsByName, so a
    // team isn't marked On-Tour by another club's games (Milan vs Inter Milan).
    return availableNames.some(
      (n) => n.toLowerCase().includes(low) && eventBelongsToTeam(n, needle),
    );
  };
}
