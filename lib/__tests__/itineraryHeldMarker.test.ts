import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import { tripKey } from "../itinerary/confirm";
import {
  HELD_MARKER_TTL_MS,
  PRIOR_HOLD_NOTICE,
  parseHeldMarker,
  priorHoldFor,
  serializeHeldMarker,
} from "../itinerary/heldMarker";
import { INITIAL_ITINERARY_STATE, itineraryReducer } from "../itinerary/state";

type City = { latitude: number; longitude: number; name: string; city_iata: string };
const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז, צרפת", city_iata: "PAR" };
const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון, בריטניה", city_iata: "LON" };

const ev = (id: number, date: string, city: City) =>
  ({ id, name: `event ${id}`, date: `${date}T20:00:00`, type: "music_event", location: { ...city, country_code: "XX" } }) as unknown as Event;

const route = [ev(618, "2027-05-12", PARIS), ev(702, "2027-05-15", LONDON)];
/** The builder as `?events=618,702` opens it: the route, its default dates, a party of two. */
const opened = () => itineraryReducer(INITIAL_ITINERARY_STATE, { type: "load", route, mode: "route" });

const T0 = Date.parse("2026-10-22T10:00:00Z");
const HOUR = 60 * 60 * 1000;
const GROUP = "3f2b8c1e-9d4a-4e6b-8a1c-2d3e4f5a6b7c";

describe("m7 - the tab remembers a trip it held", () => {
  const key = tripKey(opened());
  const raw = serializeHeldMarker({ group: GROUP, tripKey: key, reference: "ME22500" }, T0);

  it("reads back what was written, within the hold's 24 hours", () => {
    expect(parseHeldMarker(raw, T0)).toEqual({ group: GROUP, tripKey: key, reference: "ME22500", at: T0 });
    expect(parseHeldMarker(raw, T0 + 23 * HOUR)).not.toBeNull();
    expect(parseHeldMarker(raw, T0 + HELD_MARKER_TTL_MS)).not.toBeNull();
  });

  it("says nothing after 24 hours, for a marker from the future, or a broken one", () => {
    expect(parseHeldMarker(raw, T0 + HELD_MARKER_TTL_MS + 1)).toBeNull();
    expect(parseHeldMarker(raw, T0 - 1)).toBeNull();
    for (const bad of [null, undefined, "", "{", "null", "[]", JSON.stringify({ group: GROUP, at: T0 }), JSON.stringify({ group: GROUP, tripKey: key, at: "x" })]) {
      expect(parseHeldMarker(bad, T0)).toBeNull();
    }
    expect(parseHeldMarker(JSON.stringify({ group: GROUP, tripKey: key, reference: 5, at: T0 }), T0)).toBeNull();
  });

  it("a hold whose reference was not saved keeps a null reference", () => {
    const noRef = serializeHeldMarker({ group: GROUP, tripKey: key, reference: null }, T0);
    expect(parseHeldMarker(noRef, T0)?.reference).toBeNull();
  });

  it("a refresh after the hold reopens the same trip from the URL: it is the held one", () => {
    // The hold was for the trip as the link opened it; a reload opens it again the same way.
    const marker = parseHeldMarker(raw, T0 + HOUR);
    expect(priorHoldFor(marker, tripKey(opened()))).toEqual(marker);
    expect(PRIOR_HOLD_NOTICE).toBe("כבר שמרתם את הטיול הזה ל-24 שעות - נציג יחזור אליכם");
  });

  it("another trip - another party, other dates, another route - is not the held one", () => {
    const marker = parseHeldMarker(raw, T0 + HOUR);
    const three = itineraryReducer(opened(), { type: "setPax", pax: 3 });
    expect(priorHoldFor(marker, tripKey(three))).toBeNull();
    const s = opened();
    const later = itineraryReducer(s, { type: "setDates", dates: { ...s.dates, ret: "2027-05-17" } });
    expect(priorHoldFor(marker, tripKey(later))).toBeNull();
    const one = itineraryReducer(s, { type: "removeEvent", id: 702 });
    expect(priorHoldFor(marker, tripKey(one))).toBeNull();
    expect(priorHoldFor(null, key)).toBeNull();
  });
});
