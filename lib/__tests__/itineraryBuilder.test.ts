import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import { DEFAULT_ITINERARY_SETTINGS as S } from "../itinerary/settings";
import {
  activeFilterCount,
  catalogCities,
  catalogItems,
  catalogMonths,
  cityMonths,
  dayMonth,
  dayMonthYear,
  filterCatalog,
  fittingItems,
  flightPoses,
  hasTripPartner,
  isBrowsing,
  moveName,
  nextCityQuestion,
  planePose,
  planeSpot,
  quickFiltered,
  starterEvents,
  topCities,
  tripCities,
  tripTitle,
  eventHeadline,
} from "../itinerary/builder";
import { eventKind, sameCity } from "../itinerary/geo";

type City = { latitude: number; longitude: number; name: string; city_iata: string };

const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז, צרפת", city_iata: "PAR" };
const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון, בריטניה", city_iata: "LON" };
const AMSTERDAM: City = { latitude: 52.37, longitude: 4.9, name: "אמסטרדם, הולנד", city_iata: "AMS" };
const MADRID: City = { latitude: 40.42, longitude: -3.7, name: "מדריד, ספרד", city_iata: "MAD" };
const BERLIN: City = { latitude: 52.52, longitude: 13.4, name: "ברלין, גרמניה", city_iata: "BER" };

const ev = (id: number, name: string, date: string, city: City, type = "music_event") =>
  ({
    id,
    name,
    date: `${date}T20:00:00`,
    type,
    location: { ...city, country_code: "XX" },
  }) as unknown as Event;

const celine = ev(618, "סלין דיון", "2027-05-12", PARIS);
const chelsea = ev(702, "צ'לסי - אברטון", "2027-05-15", LONDON, "sports_event");
const arsenal = ev(656, "ארסנל - נוטינגהאם", "2027-05-15", LONDON, "sports_event");
const gracieAms = ev(896, "גרייסי אברמס", "2027-05-10", AMSTERDAM);
const gracieBer = ev(1097, "גרייסי אברמס", "2027-05-13", BERLIN);
const madrid = ev(717, "ריאל מדריד - ברצלונה", "2027-05-13", MADRID, "sports_event");
const later = ev(769, "אינטר - לאציו", "2027-06-23", PARIS, "sports_event");
const tottenham = ev(699, "טוטנהאם - צ'לסי", "2027-05-08", LONDON, "sports_event");

const catalog = [celine, chelsea, arsenal, gracieAms, gracieBer, madrid, later, tottenham];

/** A two-city event: sold as a flight to London (`location`), played in Manchester (`event_location`). */
const manchester = {
  ...ev(901, "מנצ'סטר יונייטד - ליברפול", "2027-05-16", LONDON, "sports_event"),
  event_location: { latitude: 53.48, longitude: -2.24, name: "מנצ'סטר", city_iata: "MAN", country_code: "GB" },
} as unknown as Event;

describe("dates on screen", () => {
  it("prints DD/MM/YY and DD/MM from a day", () => {
    expect(dayMonthYear("2027-05-12")).toBe("12/05/27");
    expect(dayMonth("2027-05-12")).toBe("12/05");
  });
});

describe("tripTitle (Alon 12.11: the home side of a match, the act of a show)", () => {
  it("names a match by its home side and a show by its act, in trip order", () => {
    expect(tripTitle([chelsea, celine])).toBe("סלין דיון ← צ'לסי");
    expect(eventHeadline(madrid)).toBe("ריאל מדריד");
  });

  it("drops a competition prefix and keeps a name that is not two sides", () => {
    const cl = ev(1067, "ליגת האלופות: אינטר מילאן - ליברפול", "2027-05-20", PARIS, "sports_event");
    expect(eventHeadline(cl)).toBe("אינטר מילאן");
    expect(eventHeadline(ev(1, "גמר הגביע", "2027-05-20", PARIS, "sports_event"))).toBe("גמר הגביע");
  });

  it("never splits a show's name on its dash, and says the same act once in a row", () => {
    const show = ev(2, "מיוז - סיבוב הופעות", "2027-05-20", PARIS);
    expect(eventHeadline(show)).toBe("מיוז - סיבוב הופעות");
    expect(tripTitle([gracieAms, gracieBer])).toBe("גרייסי אברמס");
    expect(tripTitle([])).toBe("");
  });
});

describe("tripCities", () => {
  it("names each stay once, in trip order", () => {
    expect(tripCities([chelsea, celine])).toEqual(["פריז", "לונדון"]);
    expect(tripCities([chelsea, tottenham])).toEqual(["לונדון"]);
    expect(tripCities([])).toEqual([]);
  });

  it("names a sub-location by the city the event is played in, not the one it is flown to", () => {
    const match = { ...chelsea, id: 900, event_location: { name: "מנצ'סטר", latitude: 53.48, longitude: -2.24 } } as Event;
    expect(tripCities([celine, match])).toEqual(["פריז", "מנצ'סטר"]);
  });
});

describe("the self-build catalog", () => {
  it("months come sorted, once each", () => {
    expect(catalogMonths(catalog)).toEqual(["2027-05", "2027-06"]);
  });

  it("filters by text (name or city), month and kind", () => {
    expect(filterCatalog(catalog, { query: "לונדון", month: "", kind: "all", city: "" }).map((e) => e.id)).toEqual([702, 656, 699]);
    expect(filterCatalog(catalog, { query: "", month: "2027-06", kind: "all", city: "" }).map((e) => e.id)).toEqual([769]);
    expect(filterCatalog(catalog, { query: "", month: "", kind: "music", city: "" }).map((e) => e.id)).toEqual([618, 896, 1097]);
    expect(filterCatalog(catalog, { query: "  גרייסי ", month: "", kind: "all", city: "" }).map((e) => e.id)).toEqual([896, 1097]);
  });

  it("every word of a query must match - each in any field, English names too", () => {
    const badParis = { ...ev(1500, "באד באני", "2027-05-20", PARIS), name_english: "Bad Bunny" } as unknown as Event;
    const badLondon = { ...ev(1501, "באד באני", "2027-05-22", LONDON), name_english: "Bad Bunny" } as unknown as Event;
    const list = [...catalog, badParis, badLondon];
    const ids = (query: string) => filterCatalog(list, { query, month: "", kind: "all", city: "" }).map((e) => e.id);
    expect(ids("באד באני פריז")).toEqual([1500]);
    expect(ids("באד באני")).toEqual([1500, 1501]);
    expect(ids("bad bunny london")).toEqual([]); // the city is stored in Hebrew
    expect(ids("BAD   bunny")).toEqual([1500, 1501]);
    expect(ids("סלין לונדון")).toEqual([]);
  });

  it("catalogCities lists each city once", () => {
    // Hebrew order; London has three events, Paris two.
    expect(catalogCities(catalog)).toEqual(["אמסטרדם", "ברלין", "לונדון", "מדריד", "פריז"]);
    expect(catalogCities([])).toEqual([]);
  });

  it("filterCatalog keeps only the chosen city", () => {
    expect(filterCatalog(catalog, { query: "", month: "", kind: "all", city: "לונדון" }).map((e) => e.id)).toEqual([
      702, 656, 699,
    ]);
    // The other filters still apply: Paris has football only in June.
    expect(
      filterCatalog(catalog, { query: "", month: "2027-05", kind: "football", city: "פריז" }).map((e) => e.id),
    ).toEqual([]);
    expect(filterCatalog(catalog, { query: "", month: "", kind: "music", city: "פריז" }).map((e) => e.id)).toEqual([618]);
  });

  it("a city chip is the event's own city, not its flight city", () => {
    // The Manchester match brings its own city, never a second London.
    expect(catalogCities([manchester])).toEqual(["מנצ'סטר"]);
    expect(catalogCities([...catalog, manchester])).toEqual(["אמסטרדם", "ברלין", "לונדון", "מדריד", "מנצ'סטר", "פריז"]);
    const city = (c: string) =>
      filterCatalog([...catalog, manchester], { query: "", month: "", kind: "all", city: c }).map((e) => e.id);
    expect(city("מנצ'סטר")).toEqual([901]);
    expect(city("לונדון")).not.toContain(901);
    // The free-text search still reads the flight city: "לונדון" finds the match sold as a flight there.
    expect(
      filterCatalog([...catalog, manchester], { query: "לונדון", month: "", kind: "all", city: "" }).map((e) => e.id),
    ).toContain(901);
  });

  it("an empty city keeps every event", () => {
    expect(filterCatalog(catalog, { query: "", month: "", kind: "all", city: "" }).map((e) => e.id)).toEqual(
      catalog.map((e) => e.id),
    );
  });

  it("an empty route sorts by date and labels nothing", () => {
    const items = catalogItems([], [chelsea, celine], S);
    expect(items.map((i) => i.event.id)).toEqual([618, 702]);
    expect(items.every((i) => !i.inRoute)).toBe(true);
  });

  it("puts the route first, then what fits, then what does not", () => {
    const items = catalogItems([celine], [madrid, chelsea, celine, arsenal], S);
    expect(items.map((i) => i.event.id)).toEqual([618, 656, 702, 717]);
    expect(items[0].inRoute).toBe(true);
    expect(items[3].compat.status).toBe("blocked");
  });
});

describe("search first", () => {
  const none = { query: "", month: "", kind: "all" as const, city: "" };

  it("browses until a word, a month, a kind or a city is set; the filter button counts the three filters", () => {
    expect(isBrowsing(none)).toBe(true);
    expect(isBrowsing({ ...none, query: "   " })).toBe(true);
    expect(isBrowsing({ ...none, query: "סלין" })).toBe(false);
    expect(isBrowsing({ ...none, month: "2027-05" })).toBe(false);
    expect(isBrowsing({ ...none, kind: "football" })).toBe(false);
    expect(isBrowsing({ ...none, city: "לונדון" })).toBe(false);
    expect(activeFilterCount(none)).toBe(0);
    expect(activeFilterCount({ ...none, query: "x" })).toBe(0);
    expect(activeFilterCount({ query: "", month: "2027-05", kind: "music", city: "פריז" })).toBe(3);
  });

  it("top cities: the most events first, a tie in Hebrew order, at most n", () => {
    const top = topCities(catalog, 3);
    expect(top[0]).toEqual({ city: "לונדון", count: 3 });
    expect(top[1]).toEqual({ city: "פריז", count: 2 });
    expect(top).toHaveLength(3);
    expect(topCities(catalog, 0)).toEqual([]);
  });

  it("starters: the most wanted first, then the soonest, one show per name", () => {
    const wanted = { ...later, is_prioritized: true } as Event;
    const list = starterEvents([celine, chelsea, gracieAms, gracieBer, wanted, tottenham], 4);
    expect(list[0].id).toBe(later.id);
    // The rest by day; the second "גרייסי אברמס" (Berlin) never shows beside the first.
    expect(list.slice(1).map((e) => e.id)).toEqual([tottenham.id, gracieAms.id, celine.id]);
    expect(starterEvents(catalog, 0)).toEqual([]);
  });

  it("what fits leaves out another date of a show already in the trip", () => {
    const again = { ...celine, id: 9001, date: "2027-05-13T20:00:00" };
    const items = catalogItems([celine], [...catalog, again], S);
    expect(items.some((i) => i.event.id === again.id && i.compat.status !== "blocked")).toBe(true);
    expect(fittingItems(items, [celine]).some((i) => i.event.id === again.id)).toBe(false);
  });

  it("an event with no other show near it has no partner; another date of itself does not count", () => {
    const alone = { ...celine, id: 9002, date: "2029-01-10T20:00:00" };
    const again = { ...celine, id: 9003, date: "2029-01-12T20:00:00" };
    expect(hasTripPartner(alone, [alone, again], S)).toBe(false);
    const other = { ...celine, id: 9004, name: "אחר", date: "2029-01-13T20:00:00" };
    expect(hasTripPartner(alone, [alone, again, other], S)).toBe(true);
  });

  it("the quick filter: by kind, and only the cities in the trip", () => {
    const items = catalogItems([chelsea], catalog, S);
    const music = quickFiltered(items, [chelsea], { kind: "music", sameCity: false });
    expect(music.every((i) => eventKind(i.event) === "music")).toBe(true);
    const here = quickFiltered(items, [chelsea], { kind: "all", sameCity: true });
    expect(here.every((i) => sameCity(chelsea, i.event))).toBe(true);
  });

  it("what fits: never the route's own event, never a blocked one, best fit first", () => {
    const items = catalogItems([chelsea], catalog, S);
    const fits = fittingItems(items, [chelsea]);
    expect(fits.some((i) => i.event.id === chelsea.id)).toBe(false);
    expect(fits.every((i) => i.compat.status !== "blocked")).toBe(true);
    expect(fits.map((i) => i.event.id)).toEqual(
      items.filter((i) => !i.inRoute && i.compat.status !== "blocked").map((i) => i.event.id),
    );
  });
});

describe("the questions after a city (Alon 01.11)", () => {
  const show = ev(1, "הופעה", "2027-05-12", PARIS);
  const match = ev(2, "פריז - ליון", "2027-05-20", PARIS, "sports_event");
  const later = ev(3, "הופעה אחרת", "2027-07-02", PARIS);
  const catalog = [later, show, match, ev(4, "ברלין", "2027-05-13", BERLIN)];
  const f = { query: "", month: "", kind: "all" as const, city: "פריז" };

  it("lists the city's months in order, with how many", () => {
    expect(cityMonths(catalog, "פריז")).toEqual([
      { month: "2027-05", count: 2 },
      { month: "2027-07", count: 1 },
    ]);
  });

  it("asks the month, then the kind, then nothing", () => {
    expect(nextCityQuestion(catalog, f)).toBe("month");
    expect(nextCityQuestion(catalog, { ...f, month: "2027-05" })).toBe("kind");
    expect(nextCityQuestion(catalog, { ...f, month: "2027-05", kind: "music" })).toBeNull();
  });

  it("skips a question with one possible answer, or one answered 'לא משנה'", () => {
    expect(nextCityQuestion(catalog, { ...f, month: "2027-07" })).toBeNull();
    expect(nextCityQuestion([show], f)).toBeNull();
    expect(nextCityQuestion(catalog, f, { month: true })).toBe("kind");
    expect(nextCityQuestion(catalog, f, { month: true, kind: true })).toBeNull();
  });

  it("asks nothing without a city, or over a search", () => {
    expect(nextCityQuestion(catalog, { ...f, city: "" })).toBeNull();
    expect(nextCityQuestion(catalog, { ...f, query: "הופעה" })).toBeNull();
  });
});

describe("moveName", () => {
  it("names a move by the stays it joins", () => {
    const route = [celine, chelsea];
    expect(moveName(route, `${celine.id}>${chelsea.id}`)).toBe("פריז - לונדון");
    expect(moveName(route, "nope")).toBe("");
  });
});

describe("the plane on the planner's flight path (Dor 11.11)", () => {
  it("moves with every event picked: beside the first stop, on the top of each open hop, beside the last", () => {
    expect([0, 1, 2, 3].map((n) => planeSpot(n, 3))).toEqual([0.25, 0.5, 1.5, 1.75]);
  });

  it("a trip of two events is one hop", () => {
    expect([0, 1, 2].map((n) => planeSpot(n, 2))).toEqual([0.25, 0.5, 0.75]);
  });

  it("never leaves the path", () => {
    expect(planeSpot(-1, 3)).toBe(0.25);
    expect(planeSpot(5, 3)).toBe(1.75);
  });
});

describe("the plane rides the arcs (Dor 11.11)", () => {
  const SLOPE = 0.3;

  it("sits on the top of a hop, level", () => {
    const top = planePose(0.5, 3, SLOPE);
    expect(top.along).toBeCloseTo(0.25);
    expect(top.down).toBeCloseTo(0.45);
    expect(top.tilt).toBeCloseTo(0);
  });

  it("is down at a stop: nose up on the way out of it, down on the way into the last", () => {
    const mid = planePose(1, 3, SLOPE);
    expect(mid.along).toBeCloseTo(0.5);
    expect(mid.down).toBeCloseTo(0.85);
    expect(mid.tilt).toBeGreaterThan(20);
    const last = planePose(2, 3, SLOPE);
    expect(last.along).toBeCloseTo(1);
    expect(last.down).toBeCloseTo(0.85);
    expect(last.tilt).toBeCloseTo(-mid.tilt);
  });

  it("climbs and comes down by the same curve", () => {
    const up = planePose(0.2, 3, SLOPE);
    const down = planePose(0.8, 3, SLOPE);
    expect(up.down).toBeCloseTo(down.down);
    expect(up.tilt).toBeGreaterThan(0);
    expect(down.tilt).toBeCloseTo(-up.tilt);
    // Between a stop and the top of its hop.
    expect(up.down).toBeGreaterThan(0.45);
    expect(up.down).toBeLessThan(0.85);
  });

  it("stays on the path whatever it is asked", () => {
    expect(planePose(-3, 3, SLOPE).along).toBe(0);
    expect(planePose(9, 3, SLOPE).along).toBe(1);
  });

  it("a flight between two hops goes down to the stop between them and up again", () => {
    const poses = flightPoses(0.5, 1.5, 3, SLOPE);
    expect(poses[0]).toEqual(planePose(0.5, 3, SLOPE));
    expect(poses[poses.length - 1]).toEqual(planePose(1.5, 3, SLOPE));
    const lowest = poses.reduce((a, b) => (b.down > a.down ? b : a));
    expect(lowest.along).toBeCloseTo(0.5);
    expect(lowest.down).toBeCloseTo(0.85);
    // Close enough together to draw the curve.
    expect(poses.length).toBeGreaterThanOrEqual(17);
  });

  it("a short flight still draws its curve, and a flight back is the same road", () => {
    const out = flightPoses(0.2, 0.5, 3, SLOPE);
    expect(out.length).toBeGreaterThanOrEqual(7);
    expect(out.every((p, i) => i === 0 || p.down < out[i - 1].down)).toBe(true);
    const back = flightPoses(0.5, 0.2, 3, SLOPE);
    expect(back.map((p) => p.down.toFixed(6))).toEqual([...out].reverse().map((p) => p.down.toFixed(6)));
  });
});
