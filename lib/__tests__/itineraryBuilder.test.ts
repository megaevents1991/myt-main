import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import { DEFAULT_ITINERARY_SETTINGS as S } from "../itinerary/settings";
import {
  catalogItems,
  catalogMonths,
  dayMonth,
  dayMonthYear,
  filterCatalog,
  routeCandidates,
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

describe("routeCandidates", () => {
  it("lists the catalog by date while the route is empty", () => {
    const list = routeCandidates([], catalog, S);
    expect(list.map((c) => c.event.id)).toEqual([699, 896, 618, 717, 1097, 656, 702, 769]);
    expect(list.every((c) => c.compat.reason.code === "first")).toBe(true);
  });

  it("keeps the date window, hides the route and other dates of its events, best first", () => {
    const list = routeCandidates([gracieAms, celine], catalog, S);
    const ids = list.map((c) => c.event.id);
    expect(ids).not.toContain(896);
    expect(ids).not.toContain(618);
    expect(ids).not.toContain(1097); // another date of גרייסי אברמס
    expect(ids).not.toContain(769); // more than max_gap_days after the last event
    // מומלץ first (London is close to both ends), by date; Madrid is too far from Paris.
    expect(ids).toEqual([699, 656, 702, 717]);
    expect(list.slice(0, 3).every((c) => c.compat.status === "best")).toBe(true);
    expect(list.find((c) => c.event.id === 717)?.compat.status).toBe("blocked");
    const statuses = list.map((c) => c.compat.status);
    expect(statuses.indexOf("blocked")).toBeGreaterThan(statuses.lastIndexOf("best"));
  });
});

describe("the self-build catalog", () => {
  it("months come sorted, once each", () => {
    expect(catalogMonths(catalog)).toEqual(["2027-05", "2027-06"]);
  });

  it("filters by text (name or city), month and kind", () => {
    expect(filterCatalog(catalog, { query: "לונדון", month: "", kind: "all" }).map((e) => e.id)).toEqual([702, 656, 699]);
    expect(filterCatalog(catalog, { query: "", month: "2027-06", kind: "all" }).map((e) => e.id)).toEqual([769]);
    expect(filterCatalog(catalog, { query: "", month: "", kind: "music" }).map((e) => e.id)).toEqual([618, 896, 1097]);
    expect(filterCatalog(catalog, { query: "  גרייסי ", month: "", kind: "all" }).map((e) => e.id)).toEqual([896, 1097]);
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
