// MEGA CLUB - the club's settings as the site reads them. Server only. The backoffice writes club_settings
// (/marketing/club > Settings); "changes reach the site within a minute" = this 60 s per-instance cache.
import { supabase } from "@/lib/supabase";
import { parseClubSettings, type ClubSettings } from "@/lib/club/rules";

const CACHE_MS = 60_000;
export const CLUB_DB_DEADLINE_MS = 3000;

let cached: { at: number; value: ClubSettings } | null = null;

/** Any failure (table missing before the migration, a slow DB) = the club is off = today's popup (Review Focus 4). */
export async function getClubSettings(now = Date.now(), opts: { fresh?: boolean } = {}): Promise<ClubSettings> {
  if (!opts.fresh && cached && now - cached.at < CACHE_MS) return cached.value;
  let value: ClubSettings;
  try {
    const { data, error } = await supabase
      .from("club_settings")
      .select("value")
      .eq("key", "program")
      .abortSignal(AbortSignal.timeout(CLUB_DB_DEADLINE_MS))
      .maybeSingle();
    if (error) {
      console.error("club settings read failed:", JSON.stringify(error));
      value = parseClubSettings(null);
    } else {
      value = parseClubSettings(data?.value ?? null);
    }
  } catch (e) {
    console.error("club settings read failed:", e);
    value = parseClubSettings(null);
  }
  cached = { at: now, value };
  return value;
}
