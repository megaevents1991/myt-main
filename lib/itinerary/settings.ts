/**
 * "Build Your Euro Trip" (multi-event itinerary) - settings.
 *
 * Pure: no I/O. The caller reads the `itinerary_settings` rows (key / value, written by
 * the backoffice) and hands them to `parseItinerarySettings`, which never throws -
 * a missing row, a wrong type or an out-of-range value falls back to the default.
 */

export type ItinerarySettings = {
  /**
   * Master switch: the pages are public in production only while this is true. NOT a row of
   * `itinerary_settings` since 2026-10-28 - it is the "euro_trip" row of the backoffice /homepage board
   * (`euroTripSwitchOn`), filled in by the server reader (settings.server.ts).
   */
  enabled: boolean;
  /** A multi-event itinerary may be paid for (off = quote / request only). */
  paymentsEnabled: boolean;
  /** Discount % on the 2nd event of a trip. */
  tier2Pct: number;
  /** Discount % on the 3rd event of a trip. */
  tier3Pct: number;
  /** Most events in one trip. */
  maxEvents: number;
  /** Farthest two events of one trip may be, in km. */
  maxKm: number;
  /** Up to this many km two events are a "best" pairing. */
  bestKm: number;
  /** Up to this many days between two events is an "ok" gap. */
  okGapDays: number;
  /** More than this many days between two events is blocked. */
  maxGapDays: number;
  /** Longest whole trip, first event to last, in days. */
  maxSpanDays: number;
  /** How many routes the page builds on its own before leaving it to the customer (0 = staff trips only). */
  maxAutoRoutes: number;
};

export const DEFAULT_ITINERARY_SETTINGS: ItinerarySettings = {
  enabled: false,
  paymentsEnabled: false,
  tier2Pct: 30,
  tier3Pct: 50,
  maxEvents: 3,
  maxKm: 1000,
  bestKm: 600,
  okGapDays: 5,
  maxGapDays: 10,
  maxSpanDays: 21,
  // 0 (Dor 28.10): the hub shows only the trips staff switched on, never routes it made up itself.
  maxAutoRoutes: 0,
};

type BoolField = "enabled" | "paymentsEnabled";
type NumField = Exclude<keyof ItinerarySettings, BoolField>;

type Spec =
  | { key: string; field: BoolField; kind: "bool" }
  | { key: string; field: NumField; kind: "num"; min: number; max: number; int: boolean };

const num = (key: string, field: NumField, min: number, max: number, int: boolean): Spec => ({
  key,
  field,
  kind: "num",
  min,
  max,
  int,
});

// DB key (snake_case) -> field + what it may hold. Ranges are inclusive. No "enabled" row: a stale one
// left in the table must never open the pages (the switch is the homepage row, below).
const SPECS: Spec[] = [
  { key: "payments_enabled", field: "paymentsEnabled", kind: "bool" },
  num("tier_2_pct", "tier2Pct", 0, 90, false),
  num("tier_3_pct", "tier3Pct", 0, 90, false),
  num("max_events", "maxEvents", 2, 3, true),
  num("max_km", "maxKm", 50, 5000, false),
  num("best_km", "bestKm", 50, 5000, false),
  num("ok_gap_days", "okGapDays", 1, 30, true),
  num("max_gap_days", "maxGapDays", 1, 30, true),
  num("max_span_days", "maxSpanDays", 1, 30, true),
  num("max_auto_routes", "maxAutoRoutes", 0, 48, true),
];

export function parseItinerarySettings(
  rows: { key: string; value: unknown }[] | null | undefined,
): ItinerarySettings {
  const out: ItinerarySettings = { ...DEFAULT_ITINERARY_SETTINGS };
  if (!Array.isArray(rows)) return out;

  for (const row of rows) {
    const spec = SPECS.find((s) => s.key === row?.key);
    if (!spec) continue; // unknown key
    const v = row.value;
    if (spec.kind === "bool") {
      if (typeof v === "boolean") out[spec.field] = v;
      continue;
    }
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    if (v < spec.min || v > spec.max) continue;
    if (spec.int && !Number.isInteger(v)) continue;
    out[spec.field] = v;
  }
  return out;
}

/**
 * Is this failed read of `itinerary_settings` "the table is not there" (the backoffice migration
 * not applied yet) - the one failure a PAGE may answer with the defaults? Postgres 42P01 /
 * PostgREST PGRST205 by code; the words ("relation ... does not exist", "Could not find the
 * table ...") count only when the error has NO code (only the message survived the cache).
 * Anything else - a timeout, a refused connection, a 5xx - is not: the page throws and ISR
 * keeps its last good version.
 */
export function isMissingSettingsTable(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const { code, message } = e as { code?: unknown; message?: unknown };
  // A code names the failure: only the two "no such table" codes count, whatever the words say
  // (42703, a missing COLUMN, reads "... of relation "itinerary_settings" does not exist" too).
  if (code !== undefined && code !== null && code !== "") return code === "42P01" || code === "PGRST205";
  // No code (an Error rethrown by the cache kept only its message): the words decide.
  const text = typeof message === "string" ? message : "";
  return /relation\s+\S+\s+does not exist/i.test(text) || /could not find the table/i.test(text);
}

/**
 * The /homepage board row that IS the feature's switch (backoffice `EURO_TRIP_SECTION_KEY`, Dor 28.10:
 * "רק אם אנחנו מפעילים את זה בבק אופיס - דרך ניהול ה-homepage"). Shown = the homepage gets its entry
 * and the pages open; hidden or no row = off.
 */
export const EURO_TRIP_SECTION_KEY = "euro_trip";

export type HomepageSwitchRow = {
  key: string;
  page?: string | null;
  is_visible?: boolean | null;
  position?: number | null;
};

/**
 * Is the Euro Trip switched on, from the `homepage_sections` rows? The homepage page's row of that key
 * decides - the first by position, the way lib/homepageLayout.ts reads the board. No row (the board was
 * never saved since the row existed), or anything but a real `true`, is off.
 */
export function euroTripSwitchOn(rows: readonly HomepageSwitchRow[] | null | undefined): boolean {
  if (!Array.isArray(rows)) return false;
  const row = rows
    .filter((r) => r?.key === EURO_TRIP_SECTION_KEY && (r.page ?? "home") === "home")
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
  return row?.is_visible === true;
}

/** The switch: on when staff showed the homepage row, and always outside production (preview / dev). */
export function itineraryOn(s: ItinerarySettings, vercelEnv: string | undefined): boolean {
  return s.enabled || vercelEnv !== "production";
}
