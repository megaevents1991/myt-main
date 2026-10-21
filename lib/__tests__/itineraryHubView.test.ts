import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import { DEFAULT_ITINERARY_SETTINGS as S } from "../itinerary/settings";
import { toRouteCard, type RouteCardData } from "../itinerary/routeCard";
import { DEFAULT_HUB_VIEW, hubCards, hubMonths, parseHubView } from "../itinerary/hubView";

const ev = (id: number, name: string, day: string, cityName: string) => ({
  id,
  name,
  day,
  cityName,
  art: { imageUrl: null, awayImageUrl: null, variant: "photo" as const },
});

const card = (over: Partial<RouteCardData>): RouteCardData => ({
  ids: [1, 2],
  title: "פריז ← לונדון",
  events: [ev(1, "a", "2027-05-12", "פריז"), ev(2, "b", "2027-05-15", "לונדון")],
  cities: ["פריז", "לונדון"],
  nights: 5,
  stays: 2,
  perTraveller: 2000,
  saving: null,
  kinds: ["music"],
  firstDay: "2027-05-12",
  ...over,
});

const concerts = card({
  ids: [1, 2],
  events: [ev(1, "Coldplay", "2027-05-12", "פריז"), ev(2, "סלין דיון", "2027-05-15", "לונדון")],
  kinds: ["music"],
  perTraveller: 2500,
  firstDay: "2027-05-12",
});
const matches = card({
  ids: [3, 4],
  title: "מדריד ← ברצלונה",
  cities: ["מדריד", "ברצלונה"],
  events: [ev(3, "ריאל מדריד", "2027-04-02", "מדריד"), ev(4, "ברצלונה", "2027-04-05", "ברצלונה")],
  kinds: ["football"],
  perTraveller: 1800,
  firstDay: "2027-04-02",
});
const mix = card({
  ids: [5, 6],
  title: "מילאנו",
  cities: ["מילאנו"],
  events: [ev(5, "אינטר", "2027-05-30", "מילאנו"), ev(6, "Vasco Rossi", "2027-06-01", "מילאנו")],
  kinds: ["football", "music"],
  perTraveller: 2100,
  firstDay: "2027-05-30",
});
const all = [concerts, matches, mix]; // the recommender's order

const ids = (list: RouteCardData[]) => list.map((c) => c.ids[0]);

/** A real card: a concert in Paris, then a Manchester match sold as a flight to London. */
const manchesterTrip = toRouteCard(
  [
    {
      id: 618,
      name: "סלין דיון",
      date: "2027-05-12T20:00:00",
      type: "music_event",
      location: { latitude: 48.86, longitude: 2.35, name: "פריז, צרפת", city_iata: "PAR", country_code: "FR" },
      markup_ticket: 175,
      tickets_and_rates: [{ price: 150, available: true }],
    },
    {
      id: 705,
      name: "מנצ'סטר יונייטד - ליברפול",
      date: "2027-05-15T17:30:00",
      type: "sports_event",
      location: { latitude: 51.5, longitude: -0.13, name: "לונדון, בריטניה", city_iata: "LON", country_code: "GB" },
      event_location: { latitude: 53.48, longitude: -2.24, name: "מנצ'סטר", city_iata: "MAN", country_code: "GB" },
      markup_ticket: 175,
      tickets_and_rates: [{ price: 200, available: true }],
    },
  ] as unknown as Event[],
  S,
);

describe("hubCards", () => {
  it("the defaults keep every card in the recommended order", () => {
    expect(ids(hubCards(all, DEFAULT_HUB_VIEW))).toEqual([1, 3, 5]);
  });

  it("filters by kind: concerts only, football only, the mix", () => {
    expect(ids(hubCards(all, { ...DEFAULT_HUB_VIEW, kind: "music" }))).toEqual([1]);
    expect(ids(hubCards(all, { ...DEFAULT_HUB_VIEW, kind: "football" }))).toEqual([3]);
    expect(ids(hubCards(all, { ...DEFAULT_HUB_VIEW, kind: "mix" }))).toEqual([5]);
  });

  it("searches event names and cities, ignoring case and spaces around", () => {
    expect(ids(hubCards(all, { ...DEFAULT_HUB_VIEW, query: "  coldPLAY " }))).toEqual([1]);
    expect(ids(hubCards(all, { ...DEFAULT_HUB_VIEW, query: "ברצלונה" }))).toEqual([3]);
    expect(ids(hubCards(all, { ...DEFAULT_HUB_VIEW, query: "מילאנו" }))).toEqual([5]);
    expect(hubCards(all, { ...DEFAULT_HUB_VIEW, query: "טוקיו" })).toEqual([]);
  });

  it("a Manchester match sold as a London flight is found by both cities", () => {
    const list = [...all, manchesterTrip];
    expect(ids(hubCards(list, { ...DEFAULT_HUB_VIEW, query: "מנצ'סטר" }))).toEqual([618]);
    // London is the trip's stay (the title), not where the match is played.
    expect(ids(hubCards(list, { ...DEFAULT_HUB_VIEW, query: "לונדון" }))).toEqual([1, 618]);
  });

  it("a month matches a route with any of its events in it", () => {
    expect(ids(hubCards(all, { ...DEFAULT_HUB_VIEW, month: "2027-05" }))).toEqual([1, 5]);
    expect(ids(hubCards(all, { ...DEFAULT_HUB_VIEW, month: "2027-06" }))).toEqual([5]);
  });

  it("sorts by price (cheapest first) and by date (soonest first)", () => {
    expect(ids(hubCards(all, { ...DEFAULT_HUB_VIEW, sort: "price" }))).toEqual([3, 5, 1]);
    expect(ids(hubCards(all, { ...DEFAULT_HUB_VIEW, sort: "date" }))).toEqual([3, 1, 5]);
  });

  it("never reorders the list it is given", () => {
    hubCards(all, { ...DEFAULT_HUB_VIEW, sort: "price" });
    expect(ids(all)).toEqual([1, 3, 5]);
  });
});

describe("hubMonths", () => {
  it("every month an event of a route falls in, sorted", () => {
    expect(hubMonths(all)).toEqual(["2027-04", "2027-05", "2027-06"]);
    expect(hubMonths([])).toEqual([]);
  });
});

describe("parseHubView", () => {
  it("takes a stored view with every field right", () => {
    const v = { query: "פריז", month: "2027-05", kind: "mix", sort: "price", visible: 24 };
    expect(parseHubView(v)).toEqual(v);
    expect(parseHubView(DEFAULT_HUB_VIEW)).toEqual(DEFAULT_HUB_VIEW);
  });

  it("takes the upper bounds themselves", () => {
    expect(parseHubView({ ...DEFAULT_HUB_VIEW, query: "x".repeat(100) })?.query).toHaveLength(100);
    expect(parseHubView({ ...DEFAULT_HUB_VIEW, visible: 2000 })?.visible).toBe(2000);
  });

  it("refuses anything past them", () => {
    expect(parseHubView({ ...DEFAULT_HUB_VIEW, query: "x".repeat(101) })).toBeNull();
    expect(parseHubView({ ...DEFAULT_HUB_VIEW, visible: 2001 })).toBeNull();
    expect(parseHubView({ ...DEFAULT_HUB_VIEW, month: "2027-5" })).toBeNull();
  });

  it("ignores junk, a wrong field or a missing one", () => {
    expect(parseHubView(null)).toBeNull();
    expect(parseHubView("x")).toBeNull();
    expect(parseHubView([])).toBeNull();
    expect(parseHubView({ ...DEFAULT_HUB_VIEW, kind: "tennis" })).toBeNull();
    expect(parseHubView({ ...DEFAULT_HUB_VIEW, sort: "name" })).toBeNull();
    expect(parseHubView({ ...DEFAULT_HUB_VIEW, month: "May" })).toBeNull();
    expect(parseHubView({ ...DEFAULT_HUB_VIEW, visible: 0 })).toBeNull();
    expect(parseHubView({ ...DEFAULT_HUB_VIEW, visible: 1.5 })).toBeNull();
    expect(parseHubView({ ...DEFAULT_HUB_VIEW, query: 7 })).toBeNull();
    const { sort: _sort, ...noSort } = DEFAULT_HUB_VIEW;
    expect(parseHubView(noSort)).toBeNull();
  });
});
