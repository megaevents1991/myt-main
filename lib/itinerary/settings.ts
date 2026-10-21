/**
 * "Build Your Euro Trip" (multi-event itinerary) - settings.
 *
 * Pure: no I/O. The caller reads the `itinerary_settings` rows (key / value, written by
 * the backoffice) and hands them to `parseItinerarySettings`, which never throws -
 * a missing row, a wrong type or an out-of-range value falls back to the default.
 */

export type ItinerarySettings = {
  /** Master switch: the pages are public in production only while this is true. */
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
  /** How many routes the page builds on its own before leaving it to the customer. */
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
  maxAutoRoutes: 12,
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

// DB key (snake_case) -> field + what it may hold. Ranges are inclusive.
const SPECS: Spec[] = [
  { key: "enabled", field: "enabled", kind: "bool" },
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

/** The switch: on when staff enabled it, and always outside production (preview / dev). */
export function itineraryOn(s: ItinerarySettings, vercelEnv: string | undefined): boolean {
  return s.enabled || vercelEnv !== "production";
}
