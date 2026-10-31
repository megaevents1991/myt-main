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

/**
 * A two-city event: sold as a flight to London, played in Manchester (a stay in London by default,
 * in Manchester with `lodging_mode: "event_city_only"`). The km are measured on the event's own city.
 */
const twoCity = (id: number, name: string, date: string, over: Record<string, unknown> = {}) =>
  ({
    id,
    name,
    date: `${date}T20:00:00`,
    type: "sports_event",
    location: { ...LONDON, name: "לונדון, בריטניה", country_code: "GB" },
    event_location: { latitude: 53.48, longitude: -2.24, name: "מנצ'סטר", city_iata: "MAN", country_code: "GB" },
    ...over,
  }) as unknown as Event;

const celine = ev(1, "סלין דיון", "2027-05-12", PARIS);
const chelsea = ev(2, "צ'לסי - אברטון", "2027-05-15", LONDON, "sports_event");
const gracie = ev(3, "גרייסי אברמס", "2027-05-10", AMSTERDAM);
const realBarca = ev(4, "ריאל - ברסה", "2027-05-09", MADRID, "sports_event");
const arsenal = ev(5, "ארסנל - ליברפול", "2027-05-15", LONDON, "sports_event");
const interLazio = ev(6, "אינטר - לאציו", "2027-05-23", MILAN, "sports_event");
const berlin = ev(7, "קונצרט בברלין", "2027-05-13", BERLIN);

describe("no change of city on the day of a show (Dor 31.10)", () => {
  const amsterdam7 = ev(31, "גרייסי אברמס", "2027-05-07", AMSTERDAM);
  const london8 = ev(32, "טוטנהאם - צ'לסי", "2027-05-08", LONDON, "sports_event");

  it("blocks another city the day before or after, either way round", () => {
    expect(compatibility([amsterdam7], london8, S).reason).toEqual({ code: "no_move_day", from: "אמסטרדם" });
    expect(compatibility([london8], amsterdam7, S).reason).toEqual({ code: "no_move_day", from: "לונדון" });
    expect(isAddable(compatibility([amsterdam7], london8, S))).toBe(false);
  });

  it("takes a free day between them", () => {
    expect(isAddable(compatibility([amsterdam7], ev(33, "ארסנל - ליברפול", "2027-05-09", LONDON, "sports_event"), S))).toBe(true);
  });

  it("does not ask it of one city", () => {
    expect(compatibility([london8], ev(34, "קונצרט בלונדון", "2027-05-09", LONDON), S).status).toBe("same");
  });

  it("does not ask it of a sub-location: one flight city, a train away", () => {
    // Slept in Manchester: two stays, no flight between them.
    const slept = twoCity(35, "מנצ'סטר יונייטד - ליברפול", "2027-05-09", { lodging_mode: "event_city_only" });
    expect(isAddable(compatibility([london8], slept, S))).toBe(true);
    // Slept in London: the same stay.
    const dayTrip = twoCity(36, "מנצ'סטר סיטי - אברטון", "2027-05-07");
    expect(isAddable(compatibility([london8], dayTrip, S))).toBe(true);
  });
});

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
    expect(compatibility(route, arsenal, S)).toMatchObject({
      status: "blocked",
      reason: { code: "full", max: 3 },
    });
    expect(compatibility(route, berlin, S)).toMatchObject({
      status: "blocked",
      reason: { code: "full", max: 3 },
    });
  });

  it("honours maxEvents from the settings", () => {
    const two = { ...S, maxEvents: 2 };
    const c = compatibility([celine, chelsea], berlin, two);
    expect(c.status).toBe("blocked");
    expect(c.reason).toEqual({ code: "full", max: 2 });
    expect(describeCompat(c)).toBe("המסלול מלא - עד 2 אירועים");
    // ...and with the default 3 the same two-event route still has room.
    expect(compatibility([celine, chelsea], berlin, S).reason.code).not.toBe("full");
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
    // Berlin 05-15 between Paris 05-12 and London 05-17: 878 km / 3 days, 932 km / 2 days.
    const later = ev(21, "צ'לסי - טוטנהאם", "2027-05-17", LONDON, "sports_event");
    const c = compatibility([celine, later], ev(22, "קונצרט בברלין", "2027-05-15", BERLIN), S);
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

describe("compatibility on a two-city event (flight city vs event city)", () => {
  // Manchester - Paris 605 km, Manchester - London 262 km, London - Paris 343 km, Manchester - Madrid 1,456 km.
  const mcMatch = twoCity(20, "מנצ'סטר יונייטד - ליברפול", "2027-05-14");

  it("measures km from the event's own city, not the flight city", () => {
    // A stay-point (London) distance would be 343 km and `best`; the match is in Manchester: 605 km.
    const c = compatibility([celine], mcMatch, S);
    expect(c.status).toBe("ok");
    expect(c.reason).toEqual({ code: "fits" });
    expect(c.km).toBe(605);
    expect(c.nearCity).toBe("פריז");
  });

  it("measures it the same way when the two-city event is already in the route", () => {
    const c = compatibility([mcMatch], ev(21, "קונצרט בפריז", "2027-05-16", PARIS), S);
    expect(c.km).toBe(605);
    expect(c.status).toBe("ok");
  });

  it("names the event city of a two-city neighbour, not its flight city", () => {
    // Madrid - Manchester is 1,456 km (Madrid - London 1,263): too far either way, but the label
    // must be the city the match is in.
    const c = compatibility([mcMatch], ev(22, "קונצרט במדריד", "2027-05-16", MADRID), S);
    expect(c.reason).toEqual({ code: "too_far", km: 1456, from: "מנצ'סטר" });
    expect(describeCompat(c)).toBe("1,456 ק״מ ממנצ'סטר - רחוק מדי");
    const ok = compatibility([mcMatch], celine, S);
    expect(ok.nearCity).toBe("מנצ'סטר");
  });

  it("a flight-city stay makes a London event the same city (both sleep in London)", () => {
    const c = compatibility([mcMatch], ev(23, "קונצרט בלונדון", "2027-05-16", LONDON), S);
    expect(c.status).toBe("same");
    expect(c.reason).toEqual({ code: "same_city" });
    expect(c.km).toBe(0);
  });

  it("with event_city_only lodging the stay is Manchester: no longer the same city, 262 km", () => {
    const manchesterStay = twoCity(20, "מנצ'סטר יונייטד - ליברפול", "2027-05-14", {
      lodging_mode: "event_city_only",
    });
    const c = compatibility([manchesterStay], ev(23, "קונצרט בלונדון", "2027-05-16", LONDON), S);
    expect(c.status).toBe("best");
    expect(c.km).toBe(262);
    expect(c.nearCity).toBe("מנצ'סטר");
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
    expect(d({ code: "full", max: 3 })).toBe("המסלול מלא - עד 3 אירועים");
    expect(d({ code: "full", max: 2 })).toBe("המסלול מלא - עד 2 אירועים");
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
    expect(describeCompat(compatibility([celine, chelsea], berlin, S))).toBe("אין יום למעבר מפריז");
  });
});
