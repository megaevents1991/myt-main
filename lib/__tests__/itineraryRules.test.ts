import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import type { Compat } from "../itinerary/types";
import { DEFAULT_ITINERARY_SETTINGS as S } from "../itinerary/settings";
import { compatibility, describeCompat, isAddable, sortRoute } from "../itinerary/rules";

type City = { latitude: number; longitude: number; name: string; city_iata: string };

const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז", city_iata: "PAR" };
const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון", city_iata: "LON" };
const AMSTERDAM: City = { latitude: 52.37, longitude: 4.9, name: "אמסטרדם", city_iata: "AMS" };
const MADRID: City = { latitude: 40.42, longitude: -3.7, name: "מדריד", city_iata: "MAD" };
const MILAN: City = { latitude: 45.46, longitude: 9.19, name: "מילאנו", city_iata: "MIL" };
const BERLIN: City = { latitude: 52.52, longitude: 13.4, name: "ברלין", city_iata: "BER" };
const KRAKOW: City = { latitude: 50.06, longitude: 19.94, name: "קרקוב", city_iata: "KRK" };

/** A partial event: only what the rules read. No event_location / lodging_mode, so stay point = location. */
const ev = (id: number, name: string, date: string, city: City, type = "music_event") =>
  ({
    id,
    name,
    date: `${date}T20:00:00`,
    type,
    location: { ...city, country_code: "XX" },
  }) as unknown as Event;

const celine = ev(1, "סלין דיון", "2027-05-12", PARIS);
const chelsea = ev(2, "צ'לסי - אברטון", "2027-05-15", LONDON, "sports_event");
const gracie = ev(3, "גרייסי אברמס", "2027-05-10", AMSTERDAM);
const realBarca = ev(4, "ריאל - ברסה", "2027-05-09", MADRID, "sports_event");
const arsenal = ev(5, "ארסנל - ליברפול", "2027-05-15", LONDON, "sports_event");
const interLazio = ev(6, "אינטר - לאציו", "2027-05-23", MILAN, "sports_event");
const berlin = ev(7, "קונצרט בברלין", "2027-05-13", BERLIN);

describe("sortRoute", () => {
  it("sorts by day, then id, without touching the input", () => {
    const input = [chelsea, celine, gracie];
    expect(sortRoute(input).map((e) => e.id)).toEqual([3, 1, 2]);
    expect(input.map((e) => e.id)).toEqual([2, 1, 3]);
  });

  it("breaks a same-day tie by id", () => {
    expect(sortRoute([arsenal, chelsea]).map((e) => e.id)).toEqual([2, 5]);
  });
});

describe("compatibility", () => {
  it("an empty route can start with anything", () => {
    const c = compatibility([], celine, S);
    expect(c.status).toBe("ok");
    expect(c.reason).toEqual({ code: "first" });
  });

  it("a full route blocks every candidate, before any other check", () => {
    const route = [gracie, celine, chelsea];
    // Even a same-day candidate reports `full` first.
    expect(compatibility(route, arsenal, S)).toMatchObject({ status: "blocked", reason: { code: "full" } });
    expect(compatibility(route, berlin, S)).toMatchObject({ status: "blocked", reason: { code: "full" } });
  });

  it("honours maxEvents from the settings", () => {
    const two = { ...S, maxEvents: 2 };
    expect(compatibility([celine, chelsea], berlin, two).reason).toEqual({ code: "full" });
  });

  it("blocks a second event on the same day and names the one it clashes with", () => {
    const c = compatibility([celine, chelsea], arsenal, S);
    expect(c.status).toBe("blocked");
    expect(c.reason).toEqual({ code: "same_day", with: "צ'לסי - אברטון" });
  });

  it("blocks a trip longer than maxSpanDays", () => {
    const c = compatibility([celine], ev(8, "קונצרט יוני", "2027-06-10", PARIS), S);
    expect(c.status).toBe("blocked");
    expect(c.reason).toEqual({ code: "span", days: 29 });
  });

  it("allows exactly maxSpanDays", () => {
    // 2027-05-12 + 21 days = 2027-06-02, same city.
    const c = compatibility([celine], ev(8, "קונצרט", "2027-06-02", PARIS), { ...S, maxGapDays: 30 });
    expect(c.status).not.toBe("blocked");
  });

  it("blocks an event more than maxKm from its neighbour, naming that neighbour's city", () => {
    const c = compatibility([celine, chelsea], realBarca, S);
    expect(c.status).toBe("blocked");
    expect(c.reason.code).toBe("too_far");
    if (c.reason.code !== "too_far") throw new Error("unreachable");
    expect(c.reason.km).toBeGreaterThan(1000);
    expect(c.reason.from).toBe("פריז");
  });

  it("names the neighbour's city alone when the location is stored as 'City, Country'", () => {
    const paris = ev(14, "סלין דיון", "2027-05-12", { ...PARIS, name: "פריז, צרפת" });
    const c = compatibility([paris], realBarca, S);
    expect(c.reason).toMatchObject({ code: "too_far", from: "פריז" });
  });

  it("blocks a gap longer than maxGapDays", () => {
    // Paris 05-12 -> Amsterdam 05-23: 430 km, 11 days (span 11 <= 21).
    const c = compatibility([celine], ev(9, "קונצרט באמסטרדם", "2027-05-23", AMSTERDAM), S);
    expect(c.status).toBe("blocked");
    expect(c.reason).toEqual({ code: "gap_too_long", days: 11, from: "פריז" });
  });

  it("allows exactly maxGapDays but warns", () => {
    const c = compatibility([celine], ev(9, "קונצרט באמסטרדם", "2027-05-22", AMSTERDAM), S);
    expect(c.status).toBe("warn");
    expect(c.reason).toEqual({ code: "long_gap", days: 10 });
  });

  it("warns on a gap above okGapDays and reports the days", () => {
    const c = compatibility([celine, chelsea], interLazio, S);
    expect(c.status).toBe("warn");
    expect(c.reason).toEqual({ code: "long_gap", days: 8 });
    expect(c.km).toBe(959); // Milan - London, the only neighbour
    expect(c.nearCity).toBe("לונדון");
  });

  it("is best for a near neighbour and a short gap", () => {
    const c = compatibility([celine, chelsea], gracie, S);
    expect(c.status).toBe("best");
    expect(c.reason).toEqual({ code: "best" });
    expect(c.km).toBe(430); // Amsterdam - Paris, the only neighbour
    expect(c.nearCity).toBe("פריז");
  });

  it("is not best when the gap is longer than 3 days", () => {
    // Amsterdam 05-17 after Paris 05-12: 430 km but 5 days.
    const c = compatibility([celine], ev(9, "קונצרט באמסטרדם", "2027-05-17", AMSTERDAM), S);
    expect(c.status).toBe("ok");
    expect(c.reason).toEqual({ code: "fits" });
  });

  it("is best at exactly bestKm and a 3-day gap, ok one km below", () => {
    // Paris 05-12 -> Amsterdam 05-15: 430 km, 3 days.
    const ams = ev(9, "קונצרט באמסטרדם", "2027-05-15", AMSTERDAM);
    expect(compatibility([celine], ams, { ...S, bestKm: 430 }).status).toBe("best");
    expect(compatibility([celine], ams, { ...S, bestKm: 429 }).status).toBe("ok");
  });

  it("is `same` when every neighbour is in the same city", () => {
    const c = compatibility([chelsea], ev(10, "קונצרט בלונדון", "2027-05-17", LONDON), S);
    expect(c.status).toBe("same");
    expect(c.reason).toEqual({ code: "same_city" });
    expect(c.km).toBe(0);
    expect(c.nearCity).toBe("לונדון");
  });

  it("a long wait in the same city is still a warning, not `same`", () => {
    const c = compatibility([chelsea], ev(10, "קונצרט בלונדון", "2027-05-22", LONDON), S);
    expect(c.status).toBe("warn");
    expect(c.reason).toEqual({ code: "long_gap", days: 7 });
  });

  it("checks an event inserted between two against BOTH neighbours", () => {
    // Berlin 05-13 between Paris 05-12 and London 05-15: 878 km / 1 day, 932 km / 2 days.
    const c = compatibility([celine, chelsea], berlin, S);
    expect(c.status).toBe("ok");
    expect(c.reason).toEqual({ code: "fits" });
    expect(c.km).toBe(932); // Berlin - London; Paris is 877
    expect(c.nearCity).toBe("לונדון"); // the farther of the two
  });

  it("blocks when the LATER neighbour is too far, even if the earlier one is fine", () => {
    // Amsterdam 05-10 (430 km, 2 days) and Madrid 05-14 (1,053 km, 2 days) around Paris 05-12.
    const madrid14 = ev(11, "קונצרט במדריד", "2027-05-14", MADRID);
    const c = compatibility([gracie, madrid14], celine, S);
    expect(c.status).toBe("blocked");
    expect(c.reason).toEqual({ code: "too_far", km: 1053, from: "מדריד" });
  });

  it("blocks when the EARLIER neighbour is too far, even if the later one is fine", () => {
    const madrid10 = ev(11, "קונצרט במדריד", "2027-05-10", MADRID);
    const c = compatibility([madrid10, chelsea], celine, S);
    expect(c.status).toBe("blocked");
    expect(c.reason).toEqual({ code: "too_far", km: 1053, from: "מדריד" });
  });

  it("reports the farthest neighbour when both are too far", () => {
    // Between Madrid 05-10 and Krakow 05-14, Paris is 1,053 and 1,275 km away.
    const madrid10 = ev(11, "קונצרט במדריד", "2027-05-10", MADRID);
    const krakow14 = ev(12, "קונצרט בקרקוב", "2027-05-14", KRAKOW);
    const c = compatibility([madrid10, krakow14], celine, S);
    expect(c.reason).toEqual({ code: "too_far", km: 1275, from: "קרקוב" });
  });

  it("a too-far neighbour wins over a too-long gap", () => {
    // Madrid is 1,053 km from Paris AND 11 days away.
    const c = compatibility([celine], ev(13, "קונצרט במדריד", "2027-05-23", MADRID), S);
    expect(c.reason.code).toBe("too_far");
  });

  it("blocks a candidate placed before the route when the next event is too far", () => {
    const c = compatibility([celine], realBarca, S);
    expect(c.status).toBe("blocked");
    expect(c.reason).toMatchObject({ code: "too_far", from: "פריז" });
  });

  it("does not depend on the order the route is given in", () => {
    const a = compatibility([celine, chelsea], berlin, S);
    const b = compatibility([chelsea, celine], berlin, S);
    expect(b).toEqual(a);
  });

  it("uses the settings' thresholds, not constants", () => {
    const tight = { ...S, maxKm: 300 };
    expect(compatibility([celine], gracie, tight).reason.code).toBe("too_far");
    expect(compatibility([celine], gracie, S).status).toBe("best");
  });

  it("Krakow is too far from Paris (distance beats a fitting date)", () => {
    const c = compatibility([celine], ev(12, "קונצרט בקרקוב", "2027-05-14", KRAKOW), S);
    expect(c.status).toBe("blocked");
    expect(c.reason.code).toBe("too_far");
  });
});

describe("isAddable", () => {
  it("is false only for blocked", () => {
    const mk = (status: Compat["status"]): Compat => ({ status, reason: { code: "fits" } });
    expect(isAddable(mk("blocked"))).toBe(false);
    for (const s of ["best", "same", "ok", "warn"] as const) expect(isAddable(mk(s))).toBe(true);
  });

  it("matches the real results", () => {
    expect(isAddable(compatibility([celine, chelsea], realBarca, S))).toBe(false);
    expect(isAddable(compatibility([celine, chelsea], gracie, S))).toBe(true);
    expect(isAddable(compatibility([], celine, S))).toBe(true);
  });
});

describe("describeCompat", () => {
  const d = (reason: Compat["reason"]) => describeCompat({ status: "ok", reason });

  it("says every reason in Hebrew, exactly", () => {
    expect(d({ code: "first" })).toBe("אפשר להתחיל מכאן");
    expect(d({ code: "full" })).toBe("המסלול מלא - עד 3 אירועים");
    expect(d({ code: "same_day", with: "צ'לסי - אברטון" })).toBe("באותו יום כמו צ'לסי - אברטון");
    expect(d({ code: "span", days: 29 })).toBe("טיול של 29 ימים - ארוך מדי");
    expect(d({ code: "too_far", km: 1053, from: "פריז" })).toBe("1,053 ק״מ מפריז - רחוק מדי");
    expect(d({ code: "too_far", km: 780, from: "לונדון" })).toBe("780 ק״מ מלונדון - רחוק מדי");
    expect(d({ code: "gap_too_long", days: 11, from: "פריז" })).toBe("11 ימים מפריז - פער ארוך מדי");
    expect(d({ code: "long_gap", days: 8 })).toBe("אפשרי - 8 ימים בין האירועים");
    expect(d({ code: "same_city" })).toBe("באותה עיר - בלי טיסה נוספת");
    expect(d({ code: "best" })).toBe("מומלץ - קרוב וזורם");
    expect(d({ code: "fits" })).toBe("מתאים למסלול");
  });

  it("describes the real results end to end", () => {
    expect(describeCompat(compatibility([], celine, S))).toBe("אפשר להתחיל מכאן");
    expect(describeCompat(compatibility([celine, chelsea], arsenal, S))).toBe(
      "באותו יום כמו צ'לסי - אברטון",
    );
    expect(describeCompat(compatibility([celine, chelsea], realBarca, S))).toMatch(
      /^1,\d{3} ק״מ מפריז - רחוק מדי$/,
    );
    expect(describeCompat(compatibility([celine, chelsea], interLazio, S))).toBe(
      "אפשרי - 8 ימים בין האירועים",
    );
    expect(describeCompat(compatibility([celine, chelsea], gracie, S))).toBe("מומלץ - קרוב וזורם");
    expect(describeCompat(compatibility([celine, chelsea], berlin, S))).toBe("מתאים למסלול");
  });
});
