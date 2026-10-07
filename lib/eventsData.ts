import { supabase } from "@/lib/supabase";
import { Event } from "@/lib/app.types";
import { unstable_cache as nextCache } from "next/cache";
import { enrichEventsWithFallbackImages } from "@/lib/events/fallbackImage";
import { markLockedPackagesSoldOut } from "@/lib/events/lockedPackageAvailability";
import { markOwnStockSoldOut } from "@/lib/events/ownStock";
import { eventMatchesName, normalizeName } from "@/lib/eventNameMatch";
import {
  DATA_CACHE_ITEM_LIMIT,
  dataCacheItemSize,
  dataCacheItemState,
} from "@/lib/events/cacheItemSize";

// Inner cached reader THROWS on a failed/empty query so unstable_cache never
// stores the failure - a transient Supabase hiccup during revalidation used to
// cache {events: []} for a full hour and the whole site rendered "sold out"
// (2026-07-19). A thrown error is not cached, so the next request re-queries.
const cachedNonEmptyEvents = nextCache(
  async (): Promise<{ events: Event[] }> => {
    const res = await getEvents();
    if (!res.events.length) {
      throw new Error(
        "[EventsData] query failed or returned 0 events - not caching",
      );
    }
    warnWhenCatalogOutgrowsTheCache(res);
    return res;
  },
  ["all-events"],
  {
    tags: ["events"],
    revalidate: 3600, // Revalidate every hour (1 hour = 3600 seconds)
  },
);

// Backoffice-only columns this app never reads. `light_detail` alone was a third
// of the catalog and pushed it past unstable_cache's 2MB item limit - the write
// failed silently, so EVERY render re-pulled 2.1MB from Supabase (~1 query/sec)
// and choked the DB on 2026-09-17. Dropped before caching; keep the cached
// catalog well under 2MB.
const BACKOFFICE_ONLY_COLUMNS = [
  "light_detail",
  "light_checked_at",
  "campaign_input_hash",
  "campaign_generated_at",
] as const;

/**
 * Says so in the log when the catalog is near the cache's item limit, and loudly when it is
 * over it. Measured on what is actually stored - after the enrichment, and the way Next
 * counts it (lib/events/cacheItemSize.ts). The old check counted the plain JSON before the
 * enrichment and read 1.60M on 2026-10-07 while the stored item was 1.86M of 2.10M.
 */
function warnWhenCatalogOutgrowsTheCache(catalog: { events: Event[] }): void {
  const size = dataCacheItemSize(catalog);
  const state = dataCacheItemState(size);
  if (state === "ok") return;
  const share = Math.round((size / DATA_CACHE_ITEM_LIMIT) * 100);
  if (state === "over") {
    console.error(
      `[EventsData] the catalog is ${size} characters, OVER the cache's ${DATA_CACHE_ITEM_LIMIT} item limit - it is NOT cached, every render reads it from the database again. Drop a column from the catalog (BACKOFFICE_ONLY_COLUMNS).`,
    );
    return;
  }
  console.warn(
    `[EventsData] the catalog is ${size} characters, ${share}% of the cache's item limit - over it the cache silently stops storing`,
  );
}

function stripBackofficeOnlyColumns(events: Event[]): Event[] {
  return events.map((event) => {
    const slim: Event & Record<string, unknown> = { ...event };
    for (const column of BACKOFFICE_ONLY_COLUMNS) delete slim[column];
    return slim;
  });
}

/** Same contract as before (never throws, empty on failure) - but an empty
 *  result is served for THIS request only, never written to the shared cache. */
export async function getCachedEvents(): Promise<{ events: Event[] }> {
  try {
    return await cachedNonEmptyEvents();
  } catch (error) {
    console.error(
      "[EventsData] events unavailable - serving empty, uncached:",
      error,
    );
    return { events: [] };
  }
}

/**
 * Number of days an event must be in the future to count as "available".
 * 3 matches the order page's deliberate sell window (commit dbdc8aa "3 days");
 * the catalog, taxonomy and Meta feed share it so nothing is listed as
 * sold-out/hidden while its order page still sells.
 */
export const AVAILABILITY_WINDOW_DAYS = 3;

/**
 * May this event appear on a listing - catalog, search, category, person page?
 * Not a QA event (`is_test`), and not one the backoffice took off the site
 * because it has no ticket left to sell (`deactivated_reason`, 2026-10-04).
 * Both stay reachable by direct /order/{id}; a deactivated one shows sold out
 * there, its tickets being off sale.
 */
export const isListedEvent = (
  event: Pick<Event, "is_test" | "deactivated_reason">,
): boolean => !event.is_test && !event.deactivated_reason;

/** `YYYY-MM-DD` for `daysAhead` from now - the DB-comparable availability cutoff. */
export function futureDateISO(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split("T")[0];
}

export async function getEvents(id?: number): Promise<{ events: Event[] }> {
  const startTime = Date.now();

  try {
    // Availability cutoff - shared with catalog/taxonomy/feed so all surfaces
    // agree on what is bookable.
    const futureDate = futureDateISO(AVAILABILITY_WINDOW_DAYS);

    console.log(
      `[EventsData] Starting query - ID: ${id || "all"}, futureDate: ${futureDate}`,
    );

    let query = supabase
      .from("events")
      .select("*")
      .is("is_deleted", null)
      .gte("date", futureDate) // Only events AVAILABILITY_WINDOW_DAYS+ out
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
    // Test events (backoffice QA) and events taken off the site stay reachable
    // by direct id but never list.
    const visible = stripBackofficeOnlyColumns(
      id !== undefined ? events || [] : (events || []).filter(isListedEvent),
    );
    return {
      events: await markOwnStockSoldOut(
        await markLockedPackagesSoldOut(
          await enrichEventsWithFallbackImages(visible),
        ),
      ),
    };
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
  const needle = normalizeName(searchName);
  if (!needle) return { events: [] };

  // Read from the cached catalog, never from the database: this runs on EVERY view of an
  // artist / team page (those pages are rendered per request), and until 2026-10-07 each
  // view pulled the whole events table - 2.6 MB a time, most of the 5,800 catalog reads a
  // day. The catalog is the same rows already narrowed the same way (the availability
  // window, listed events only), with the backoffice-only columns dropped, the fallback
  // pictures filled in and sold-out packages and stock marked.
  const { events } = await getCachedEvents();

  // The substring match happens in JS (not SQL ILIKE) so it can be accent- and
  // punctuation-insensitive via normalizeName - backoffice-entered events
  // ("Andre Rieu") must still land on the accented template page ("André Rieu").
  // eventMatchesName: fuzzy substring refined to fixtures the team actually
  // plays in (team "Milan" must not pull in "Inter Milan" games), plus
  // fixtures whose club name drifted on qualifiers ("Atlético de Madrid").
  return {
    events: events.filter((e) => eventMatchesName(e.name_english, searchName)),
  };
}
