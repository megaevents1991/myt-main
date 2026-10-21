// Server-only: reads the shared Supabase service key. (No `server-only` guard - the package
// isn't a dependency here; never import this from a client component.)
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_ITINERARY_SETTINGS,
  parseItinerarySettings,
  type ItinerarySettings,
} from "@/lib/itinerary/settings";

/**
 * "Build Your Euro Trip" - the staff settings, read from the `itinerary_settings` table
 * (key / value rows the backoffice writes).
 *
 * Cached for an hour under ITINERARY_SETTINGS_TAG; the backoffice drops it right after a
 * save through POST /api/itinerary/revalidate. `getItinerarySettings` never throws: a
 * missing table or a failed query reads as the defaults (switch off) - but that fallback
 * is made OUTSIDE the cache, so a failure is never cached. The cached read throws, and
 * unstable_cache keeps the last good value when its function throws (lib/eventsData.ts
 * learned this the hard way): a blip at an hourly refresh cannot switch a live feature
 * off for an hour. A bad row is a different matter - the parser skips it and the rest
 * of the table still counts.
 */
export const ITINERARY_SETTINGS_TAG = "itinerary-settings";

async function readOrThrow(): Promise<ItinerarySettings> {
  const { data, error } = await supabase.from("itinerary_settings").select("key, value");
  if (error) throw new Error(error.message);
  return parseItinerarySettings(data);
}

const cachedRead = unstable_cache(readOrThrow, ["itinerary-settings"], {
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
