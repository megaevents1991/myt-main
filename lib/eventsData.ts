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
import {
  CATALOG_TAG,
  catalogPart,
  mergeCatalogParts,
} from "@/lib/events/catalogParts";

// The catalog is cached in parts (lib/events/catalogParts.ts). In one item it was 87% of
// the 2 MB a cache item may be at 440 events, and over that the cache stops storing without
// a word - every render then reads the database (the 2026-09-17 outage). Four parts carry
// about four times that catalog. The number is part of every key, so changing it is safe:
// the old parts are simply never read again.
const CATALOG_PARTS = 4;

/** The catalog could not be read, or came back empty: nothing to cache, nothing to retry. */
class CatalogUnavailableError extends Error {}

// THROWS on a failed/empty query so unstable_cache never stores the failure - a transient
// Supabase hiccup during revalidation used to cache {events: []} for a full hour and the
// whole site rendered "sold out" (2026-07-19). A thrown error is not cached, so the next
// request re-queries.
async function loadNonEmptyCatalog(): Promise<Event[]> {
  const { events } = await getEvents();
  if (!events.length) {
    throw new CatalogUnavailableError(
      "[EventsData] query failed or returned 0 events - not caching",
    );
  }
  return events;
}

/**
 * Every part of the catalog, from the cache where it is there. The parts that are not -
 * after an invalidation, after an hour, or on a page regeneration, where the cache is not
 * consulted at all - share ONE read of the database. `whole` lives for this call only: the
 * parts a call fills always come from the same read, and no other request is ever handed
 * a read that began before its own (which could cache data older than an invalidation).
 */
async function readCatalogParts(): Promise<Event[][]> {
  let whole: Promise<Event[]> | null = null;
  const loadWhole = () => (whole ??= loadNonEmptyCatalog());

  return Promise.all(
    Array.from({ length: CATALOG_PARTS }, (_, part) =>
      nextCache(
        async (): Promise<Event[]> => {
          const events = catalogPart(await loadWhole(), part, CATALOG_PARTS);
          warnWhenPartOutgrowsTheCache(events, part);
          return events;
        },
        // A cache key is the function's text plus these: the part is what tells them apart.
        // The catalog's own tag is in the key too, so no part stored before it had that tag
        // is ever read (it would not hear the tag being dropped).
        ["all-events", CATALOG_TAG, `part-${part}-of-${CATALOG_PARTS}`],
        {
          // `events` = everything the backoffice refreshes at once. CATALOG_TAG = the
          // listings alone (lib/events/livePriceInvalidation.ts).
          tags: ["events", CATALOG_TAG],
          revalidate: 3600, // Revalidate every hour (1 hour = 3600 seconds)
        },
      )(),
    ),
  );
}

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
 * Says so in the log when a part of the catalog is near the cache's item limit, and loudly
 * when it is over it. Measured on what is actually stored - after the enrichment, and the
 * way Next counts it (lib/events/cacheItemSize.ts). The check before this counted the plain
 * JSON ahead of the enrichment and read 1.60M on 2026-10-07 while the stored item was
 * 1.83M of 2.10M.
 */
function warnWhenPartOutgrowsTheCache(events: Event[], part: number): void {
  const size = dataCacheItemSize(events);
  const state = dataCacheItemState(size);
  if (state === "ok") return;
  const which = `part ${part + 1} of ${CATALOG_PARTS} of the catalog (${events.length} events)`;
  if (state === "over") {
    console.error(
      `[EventsData] ${which} is ${size} characters, OVER the cache's ${DATA_CACHE_ITEM_LIMIT} item limit - it is NOT cached, every render reads the database again. Raise CATALOG_PARTS.`,
    );
    return;
  }
  const share = Math.round((size / DATA_CACHE_ITEM_LIMIT) * 100);
  console.warn(
    `[EventsData] ${which} is ${size} characters, ${share}% of the cache's item limit - over it the cache silently stops storing. Raise CATALOG_PARTS.`,
  );
}

/** Every reader that hands event rows to a page drops these first - they are the
 *  backoffice's (competitor prices, our net costs) and must never reach a browser. */
export function stripBackofficeOnlyColumns(events: Event[]): Event[] {
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
    return { events: mergeCatalogParts(await readCatalogParts()) };
  } catch (error) {
    if (error instanceof CatalogUnavailableError) {
      console.error(
        "[EventsData] events unavailable - serving empty, uncached:",
        error,
      );
      return { events: [] };
    }
    // Not the data - the caching around it. A slower page beats an empty site, so the
    // catalog is read straight from the database for this request (getEvents never throws).
    console.error(
      "[EventsData] the cached catalog failed - reading the database directly for this request:",
      error,
    );
    return getEvents();
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
