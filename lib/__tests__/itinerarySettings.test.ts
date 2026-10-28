import { describe, expect, it } from "vitest";
import {
  DEFAULT_ITINERARY_SETTINGS,
  euroTripSwitchOn,
  isMissingSettingsTable,
  itineraryOn,
  parseItinerarySettings,
} from "@/lib/itinerary/settings";

describe("parseItinerarySettings", () => {
  it("returns the defaults for null / undefined / empty rows", () => {
    expect(parseItinerarySettings(null)).toEqual(DEFAULT_ITINERARY_SETTINGS);
    expect(parseItinerarySettings(undefined)).toEqual(DEFAULT_ITINERARY_SETTINGS);
    expect(parseItinerarySettings([])).toEqual(DEFAULT_ITINERARY_SETTINGS);
  });

  it("holds the spec defaults verbatim", () => {
    expect(DEFAULT_ITINERARY_SETTINGS).toEqual({
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
      maxAutoRoutes: 0,
    });
  });

  it("reads snake_case keys into the camelCase settings", () => {
    const s = parseItinerarySettings([
      { key: "tier_2_pct", value: 25 },
      { key: "payments_enabled", value: true },
    ]);
    expect(s.tier2Pct).toBe(25);
    expect(s.paymentsEnabled).toBe(true);
    expect(s.tier3Pct).toBe(50);
    expect(s.maxKm).toBe(1000);
  });

  it("reads every key", () => {
    const s = parseItinerarySettings([
      { key: "payments_enabled", value: true },
      { key: "tier_2_pct", value: 10 },
      { key: "tier_3_pct", value: 20 },
      { key: "max_events", value: 2 },
      { key: "max_km", value: 800 },
      { key: "best_km", value: 400 },
      { key: "ok_gap_days", value: 3 },
      { key: "max_gap_days", value: 7 },
      { key: "max_span_days", value: 14 },
      { key: "max_auto_routes", value: 6 },
    ]);
    expect(s).toEqual({
      enabled: false,
      paymentsEnabled: true,
      tier2Pct: 10,
      tier3Pct: 20,
      maxEvents: 2,
      maxKm: 800,
      bestKm: 400,
      okGapDays: 3,
      maxGapDays: 7,
      maxSpanDays: 14,
      maxAutoRoutes: 6,
    });
  });

  it("falls back to the default on a wrong type or an out-of-range value", () => {
    expect(parseItinerarySettings([{ key: "max_km", value: "x" }]).maxKm).toBe(1000);
    expect(parseItinerarySettings([{ key: "max_km", value: 99999 }]).maxKm).toBe(1000);
    expect(parseItinerarySettings([{ key: "max_km", value: 49 }]).maxKm).toBe(1000);
    expect(parseItinerarySettings([{ key: "tier_2_pct", value: 91 }]).tier2Pct).toBe(30);
    expect(parseItinerarySettings([{ key: "tier_2_pct", value: -1 }]).tier2Pct).toBe(30);
    expect(parseItinerarySettings([{ key: "max_events", value: 1 }]).maxEvents).toBe(3);
    expect(parseItinerarySettings([{ key: "max_events", value: 4 }]).maxEvents).toBe(3);
    expect(parseItinerarySettings([{ key: "ok_gap_days", value: 0 }]).okGapDays).toBe(5);
    expect(parseItinerarySettings([{ key: "max_span_days", value: 31 }]).maxSpanDays).toBe(21);
    expect(parseItinerarySettings([{ key: "max_auto_routes", value: 49 }]).maxAutoRoutes).toBe(0);
    expect(parseItinerarySettings([{ key: "payments_enabled", value: 1 }]).paymentsEnabled).toBe(false);
    expect(parseItinerarySettings([{ key: "tier_3_pct", value: Number.NaN }]).tier3Pct).toBe(50);
    expect(parseItinerarySettings([{ key: "max_km", value: null }]).maxKm).toBe(1000);
  });

  it("accepts the range edges", () => {
    expect(parseItinerarySettings([{ key: "tier_2_pct", value: 0 }]).tier2Pct).toBe(0);
    expect(parseItinerarySettings([{ key: "tier_2_pct", value: 90 }]).tier2Pct).toBe(90);
    expect(parseItinerarySettings([{ key: "max_events", value: 2 }]).maxEvents).toBe(2);
    expect(parseItinerarySettings([{ key: "max_events", value: 3 }]).maxEvents).toBe(3);
    expect(parseItinerarySettings([{ key: "max_km", value: 50 }]).maxKm).toBe(50);
    expect(parseItinerarySettings([{ key: "max_km", value: 5000 }]).maxKm).toBe(5000);
    expect(parseItinerarySettings([{ key: "max_gap_days", value: 1 }]).maxGapDays).toBe(1);
    expect(parseItinerarySettings([{ key: "max_gap_days", value: 30 }]).maxGapDays).toBe(30);
    expect(parseItinerarySettings([{ key: "max_auto_routes", value: 0 }]).maxAutoRoutes).toBe(0);
    expect(parseItinerarySettings([{ key: "max_auto_routes", value: 48 }]).maxAutoRoutes).toBe(48);
  });

  it("ignores unknown keys", () => {
    const s = parseItinerarySettings([
      { key: "surprise", value: 5 },
      { key: "tier2Pct", value: 5 },
    ]);
    expect(s).toEqual(DEFAULT_ITINERARY_SETTINGS);
  });
});

describe("the retired `enabled` row (the switch is the homepage row since 28.10)", () => {
  it("never opens the pages, whatever it holds", () => {
    expect(parseItinerarySettings([{ key: "enabled", value: true }]).enabled).toBe(false);
    expect(parseItinerarySettings([{ key: "enabled", value: "true" }]).enabled).toBe(false);
  });
});

describe("euroTripSwitchOn - the /homepage board's euro_trip row", () => {
  it("is off with no rows, or no euro_trip row", () => {
    expect(euroTripSwitchOn(null)).toBe(false);
    expect(euroTripSwitchOn(undefined)).toBe(false);
    expect(euroTripSwitchOn([])).toBe(false);
    expect(euroTripSwitchOn([{ key: "newest", page: "home", is_visible: true }])).toBe(false);
  });

  it("follows the row's visibility, and only a real true is on", () => {
    expect(euroTripSwitchOn([{ key: "euro_trip", page: "home", is_visible: true }])).toBe(true);
    expect(euroTripSwitchOn([{ key: "euro_trip", page: "home", is_visible: false }])).toBe(false);
    expect(euroTripSwitchOn([{ key: "euro_trip", page: "home", is_visible: null }])).toBe(false);
    expect(euroTripSwitchOn([{ key: "euro_trip", page: "home" }])).toBe(false);
  });

  it("reads the homepage page only (a row without a page is the homepage's)", () => {
    expect(euroTripSwitchOn([{ key: "euro_trip", page: "landing", is_visible: true }])).toBe(false);
    expect(euroTripSwitchOn([{ key: "euro_trip", page: null, is_visible: true }])).toBe(true);
  });

  it("the first row by position decides, as the homepage reads the board", () => {
    expect(
      euroTripSwitchOn([
        { key: "euro_trip", page: "home", is_visible: true, position: 9 },
        { key: "euro_trip", page: "home", is_visible: false, position: 2 },
      ]),
    ).toBe(false);
  });
});

describe("itineraryOn", () => {
  it("is off in production while the switch is off", () => {
    expect(itineraryOn(DEFAULT_ITINERARY_SETTINGS, "production")).toBe(false);
  });

  it("is on outside production", () => {
    expect(itineraryOn(DEFAULT_ITINERARY_SETTINGS, "preview")).toBe(true);
    expect(itineraryOn(DEFAULT_ITINERARY_SETTINGS, "development")).toBe(true);
    expect(itineraryOn(DEFAULT_ITINERARY_SETTINGS, undefined)).toBe(true);
  });

  it("is on in production once enabled", () => {
    expect(itineraryOn({ ...DEFAULT_ITINERARY_SETTINGS, enabled: true }, "production")).toBe(true);
  });
});

describe("isMissingSettingsTable - the one failure a page answers with the defaults", () => {
  it("a missing table, by Postgres / PostgREST code", () => {
    expect(isMissingSettingsTable({ code: "42P01", message: "x" })).toBe(true);
    expect(isMissingSettingsTable({ code: "PGRST205", message: "x" })).toBe(true);
  });

  it("a missing table, by its words when only the message survived (an Error rethrown by the cache)", () => {
    expect(isMissingSettingsTable(new Error('relation "public.itinerary_settings" does not exist'))).toBe(true);
    expect(
      isMissingSettingsTable(new Error("Could not find the table 'public.itinerary_settings' in the schema cache")),
    ).toBe(true);
  });

  it("anything else is not: a timeout, a refused connection, a 5xx, a missing column, nothing", () => {
    expect(isMissingSettingsTable({ code: "57014", message: "canceling statement due to statement timeout" })).toBe(false);
    expect(isMissingSettingsTable(new Error("fetch failed"))).toBe(false);
    expect(isMissingSettingsTable(new Error("TypeError: Failed to fetch"))).toBe(false);
    expect(isMissingSettingsTable({ code: "PGRST301", message: "JWT expired" })).toBe(false);
    expect(isMissingSettingsTable({ code: "42703", message: 'column "value" does not exist' })).toBe(false);
    expect(isMissingSettingsTable({ message: "upstream connect error or disconnect/reset before headers. 503" })).toBe(false);
    expect(isMissingSettingsTable(null)).toBe(false);
    expect(isMissingSettingsTable(undefined)).toBe(false);
    expect(isMissingSettingsTable("relation x does not exist")).toBe(false);
  });

  it("a code decides alone: a missing COLUMN whose message names the relation is not a missing table", () => {
    expect(
      isMissingSettingsTable({ code: "42703", message: 'column "x" of relation "itinerary_settings" does not exist' }),
    ).toBe(false);
    // ... and the table's own codes still count with any message, or none.
    expect(isMissingSettingsTable({ code: "42P01" })).toBe(true);
    expect(isMissingSettingsTable({ code: "PGRST205", message: "anything" })).toBe(true);
    // ... while the words count when there is no code (or an empty one).
    expect(isMissingSettingsTable({ message: 'relation "itinerary_settings" does not exist' })).toBe(true);
    expect(isMissingSettingsTable({ code: "", message: 'relation "itinerary_settings" does not exist' })).toBe(true);
  });
});
