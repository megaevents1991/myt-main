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
 * Server only. Cached for an hour under ITINERARY_SETTINGS_TAG; the backoffice drops it
 * right after a save through POST /api/itinerary/revalidate. Never throws: a missing
 * table, a failed query or a bad row all read as the defaults (switch off).
 */
export const ITINERARY_SETTINGS_TAG = "itinerary-settings";

async function readItinerarySettings(): Promise<ItinerarySettings> {
  try {
    const { data, error } = await supabase.from("itinerary_settings").select("key, value");
    if (error) {
      console.warn("[itinerary] settings read failed, using defaults:", error.message);
      return DEFAULT_ITINERARY_SETTINGS;
    }
    return parseItinerarySettings(data);
  } catch (e) {
    console.warn("[itinerary] settings read failed, using defaults:", e);
    return DEFAULT_ITINERARY_SETTINGS;
  }
}

export const getItinerarySettings = unstable_cache(readItinerarySettings, ["itinerary-settings"], {
  revalidate: 3600,
  tags: [ITINERARY_SETTINGS_TAG],
});
