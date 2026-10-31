import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import { DEFAULT_ITINERARY_SETTINGS as S } from "../itinerary/settings";
import {
  activeFilterCount,
  catalogCities,
  catalogItems,
  catalogMonths,
  dayMonth,
  dayMonthYear,
  filterCatalog,
  fittingItems,
  hasTripPartner,
  isBrowsing,
  quickFiltered,
  starterEvents,
  topCities,
  tripCities,
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

describe("tripCities", () => {
  it("names each stay once, in trip order", () => {
    expect(tripCities([chelsea, celine])).toEqual(["פריז", "לונדון"]);
    expect(tripCities([chelsea, tottenham])).toEqual(["לונדון"]);
    expect(tripCities([])).toEqual([]);
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
