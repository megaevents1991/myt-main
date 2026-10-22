import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import { DEFAULT_ITINERARY_SETTINGS as S } from "../itinerary/settings";
import {
  catalogCities,
  catalogItems,
  catalogMonths,
  dayMonth,
  dayMonthYear,
  filterCatalog,
  tripCities,
} from "../itinerary/builder";

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
