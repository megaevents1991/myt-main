import { supabase } from "@/lib/supabase";
import { Event } from "@/lib/app.types";
import { unstable_cache as nextCache } from "next/cache";
import { enrichEventsWithFallbackImages } from "@/lib/events/fallbackImage";
import { eventRelatesToTeam, normalizeName } from "@/lib/eventNameMatch";

// Inner cached reader THROWS on a failed/empty query so unstable_cache never
// stores the failure — a transient Supabase hiccup during revalidation used to
// cache {events: []} for a full hour and the whole site rendered "sold out"
// (2026-07-19). A thrown error is not cached, so the next request re-queries.
const cachedNonEmptyEvents = nextCache(
  async (): Promise<{ events: Event[] }> => {
    const res = await getEvents();
    if (!res.events.length) {
      throw new Error("[EventsData] query failed or returned 0 events — not caching");
    }
    return res;
  },
  ["all-events"],
  {
    tags: ["events"],
    revalidate: 3600, // Revalidate every hour (1 hour = 3600 seconds)
  }
);

/** Same contract as before (never throws, empty on failure) — but an empty
 *  result is served for THIS request only, never written to the shared cache. */
export async function getCachedEvents(): Promise<{ events: Event[] }> {
  try {
    return await cachedNonEmptyEvents();
  } catch (error) {
    console.error("[EventsData] events unavailable — serving empty, uncached:", error);
    return { events: [] };
  }
}

/** Number of days an event must be in the future to count as "available". */
export const AVAILABILITY_WINDOW_DAYS = 7;

/** `YYYY-MM-DD` for `daysAhead` from now — the DB-comparable availability cutoff. */
export function futureDateISO(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split("T")[0];
}

export async function getEvents(id?: number): Promise<{ events: Event[] }> {
  const startTime = Date.now();

  try {
    // Calculate date 7 days from now
    const sevenDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    // Format to YYYY-MM-DD for database comparison
    const futureDate = sevenDaysFromNow.toISOString().split("T")[0]; // Format: 2025-04-32

    console.log(
      `[EventsData] Starting query - ID: ${id || "all"}, futureDate: ${futureDate}`,
    );

    let query = supabase
      .from("events")
      .select("*")
      .is("is_deleted", null)
      .gte("date", futureDate) // Only get events 7+ days in the future
      .order("date", { ascending: true });

    if (id !== undefined) {
      query = query.eq("id", id);
    }

    const { data: events, error } = await query;
    const queryTime = Date.now() - startTime;

    if (error) {
      console.error(`[EventsData] Database error after ${queryTime}ms:`, {
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        searchId: id,
        futureDate,
      });
      return Promise.resolve({ events: [] as Event[] });
    }

    console.log(
      `[EventsData] Query successful - Returned ${events?.length || 0} events in ${queryTime}ms`,
    );
    return { events: await enrichEventsWithFallbackImages(events || []) };
  } catch (error) {
    const queryTime = Date.now() - startTime;
    console.error(`[EventsData] Unexpected error after ${queryTime}ms:`, {
      error,
      searchId: id,
      timestamp: new Date().toISOString(),
    });
    return Promise.resolve({ events: [] as Event[] });
  }
}

export async function getEventsByName(
  searchName: string,
): Promise<{ events: Event[] }> {
  // Only events at least AVAILABILITY_WINDOW_DAYS out count (shared with the
  // catalog's on-tour check in lib/tourStatus.ts — keep them on one threshold).
  const futureDate = futureDateISO(AVAILABILITY_WINDOW_DAYS);
  const needle = normalizeName(searchName);
  if (!needle) return { events: [] };

  // The substring match happens in JS (not SQL ILIKE) so it can be accent- and
  // punctuation-insensitive via normalizeName — backoffice-entered events
  // ("Andre Rieu") must still land on the accented template page ("André Rieu").
  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .is("is_deleted", null)
    .gte("date", futureDate) // Only get events 7+ days in the future
    .order("date", { ascending: true });

  if (error) return Promise.resolve({ events: [] as Event[] });

  // The substring gate is deliberately fuzzy, so a club whose name is a
  // substring of another's over-matches (team "Milan" pulls in ALL "Inter
  // Milan" fixtures). eventRelatesToTeam keeps only fixtures the team actually
  // plays in — home and away both (the page splits them visually); non-fixture
  // events (artists) pass through untouched.
  const matched = (events ?? []).filter(
    (e) =>
      normalizeName(e.name_english).includes(needle) &&
      eventRelatesToTeam(e.name_english ?? "", searchName),
  );
  return { events: await enrichEventsWithFallbackImages(matched) };
}
