// Server-only: reads the shared Supabase service key. (No `server-only` guard - the package
// isn't a dependency here; never import this from a client component.)
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { isMissingSettingsTable } from "@/lib/itinerary/settings";
import { parseStaffRouteRows, type StaffRouteRow } from "@/lib/itinerary/staffRoutes";

/**
 * "Build Your Euro Trip" - the trips staff built by hand, read from `itinerary_routes` (the
 * backoffice writes it). The hub turns them into cards that lead the list (./staffRoutes).
 *
 * Same shape as ./settings.server: cached for an hour under ITINERARY_ROUTES_TAG (the backoffice
 * drops it right after a save through POST /api/itinerary/revalidate), the cached read THROWS -
 * unstable_cache keeps the last good value when its function throws, so a blip at an hourly
 * refresh cannot empty the hub's lead for an hour - and the page reader makes its fallback
 * OUTSIDE the cache, so `[]` is never cached.
 */
export const ITINERARY_ROUTES_TAG = "itinerary-routes";

async function readOrThrow(): Promise<StaffRouteRow[]> {
  const { data, error } = await supabase
    .from("itinerary_routes")
    .select("id, title, event_ids, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  // Keep the code: the page reader tells a missing table from any other failure by it.
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return parseStaffRouteRows(data);
}

const cachedRead = unstable_cache(readOrThrow, ["itinerary-routes"], {
  revalidate: 3600,
  tags: [ITINERARY_ROUTES_TAG],
});

/**
 * The hub's reader: no staff trips (`[]`) ONLY when the table is missing (the backoffice
 * migration not applied yet - `isMissingSettingsTable`, by code); any other failure throws, so a
 * regeneration during a blip fails and Next keeps the last good page instead of baking in a hub
 * without its staff trips for an hour.
 */
export async function getStaffRoutesForPage(): Promise<StaffRouteRow[]> {
  try {
    return await cachedRead();
  } catch (e) {
    if (isMissingSettingsTable(e)) {
      console.warn("[itinerary] routes table missing, no staff trips:", e);
      return [];
    }
    throw new Error(
      `Euro trip: staff trips unavailable - keeping last good static page (${e instanceof Error ? e.message : String(e)})`,
      { cause: e },
    );
  }
}
