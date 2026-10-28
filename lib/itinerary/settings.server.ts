// Server-only: reads the shared Supabase service key. (No `server-only` guard - the package
// isn't a dependency here; never import this from a client component.)
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_ITINERARY_SETTINGS,
  EURO_TRIP_SECTION_KEY,
  euroTripSwitchOn,
  isMissingSettingsTable,
  parseItinerarySettings,
  type ItinerarySettings,
} from "@/lib/itinerary/settings";

/**
 * "Build Your Euro Trip" - the staff settings, read from the `itinerary_settings` table
 * (key / value rows the backoffice writes), and the feature's switch, which is the "euro_trip"
 * row of the backoffice /homepage board (`homepage_sections`, 2026-10-28).
 *
 * Cached for an hour under ITINERARY_SETTINGS_TAG; the backoffice drops it right after a
 * settings save AND after a homepage save that flips the switch, through POST
 * /api/itinerary/revalidate. The cached read throws, and unstable_cache
 * keeps the last good value when its function throws (lib/eventsData.ts learned this the
 * hard way): a blip at an hourly refresh cannot switch a live feature off for an hour. A bad
 * row is a different matter - the parser skips it and the rest of the table still counts.
 *
 * Two readers, one cache:
 * - `getItinerarySettings` (Server Actions, the confirm route, the flights route) never
 *   throws: any failure reads as the defaults (switch off) - a request answered "off" for a
 *   moment is safe, and the fallback is made OUTSIDE the cache, so it is never cached.
 * - `getItinerarySettingsForPage` (the ISR pages and their metadata) answers the defaults ONLY
 *   when the table is missing (`isMissingSettingsTable`) and throws on any other failure: a page
 *   regenerated during a blip would otherwise bake "off" (a 404) or the default tiers into its
 *   HTML for an hour; throwing makes the regeneration fail and Next keeps the last good page -
 *   the empty-catalog rule (app/page.tsx).
 */
export const ITINERARY_SETTINGS_TAG = "itinerary-settings";

async function readOrThrow(): Promise<ItinerarySettings> {
  const [settings, homepage] = await Promise.all([
    supabase.from("itinerary_settings").select("key, value"),
    supabase
      .from("homepage_sections")
      .select("key, page, is_visible, position")
      .eq("key", EURO_TRIP_SECTION_KEY),
  ]);
  // Keep the code: the page reader tells a missing table from any other failure by it.
  if (settings.error) throw Object.assign(new Error(settings.error.message), { code: settings.error.code });
  // A failed switch read is a failure like any other (never "off" cached for an hour, never "on").
  if (homepage.error) throw Object.assign(new Error(homepage.error.message), { code: homepage.error.code });
  return { ...parseItinerarySettings(settings.data), enabled: euroTripSwitchOn(homepage.data) };
}

// "-v2" since the switch moved to the homepage row: never answer from a value cached before it.
const cachedRead = unstable_cache(readOrThrow, ["itinerary-settings-v2"], {
  revalidate: 3600,
  tags: [ITINERARY_SETTINGS_TAG],
});

export async function getItinerarySettings(): Promise<ItinerarySettings> {
  try {
    return await cachedRead();
  } catch (e) {
    console.warn("[itinerary] settings read failed, using defaults:", e);
    return DEFAULT_ITINERARY_SETTINGS;
  }
}

/** The pages' reader: the defaults only for a missing table; any other failure throws (keep the last good page). */
export async function getItinerarySettingsForPage(): Promise<ItinerarySettings> {
  try {
    return await cachedRead();
  } catch (e) {
    if (isMissingSettingsTable(e)) {
      console.warn("[itinerary] settings table missing, using defaults:", e);
      return DEFAULT_ITINERARY_SETTINGS;
    }
    throw new Error(`Euro trip: settings unavailable - keeping last good static page (${e instanceof Error ? e.message : String(e)})`);
  }
}
