import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import { DEFAULT_ITINERARY_SETTINGS as S } from "../itinerary/settings";
import type { RouteCardData } from "../itinerary/routeCard";
import { mergeRouteCards, parseStaffRouteRows, staffRouteCards, type StaffRouteRow } from "../itinerary/staffRoutes";

type City = { latitude: number; longitude: number; name: string; city_iata: string };

const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז", city_iata: "PAR" };
const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון", city_iata: "LON" };
const KRAKOW: City = { latitude: 50.06, longitude: 19.94, name: "קרקוב", city_iata: "KRK" };

const TODAY = "2027-01-01";

/** One available ticket: without it the event reads as sold out and is not eligible. */
const TICKET = { id: "t1", category: "A", price: 100, available: true, description: "", colorOnTheMap: "" };

/** A partial but ELIGIBLE event: only what the rules, the eligibility and the card read. */
const ev = (
  id: number,
  name: string,
  date: string,
  city: City,
  type = "music_event",
  over: Record<string, unknown> = {},
) =>
  ({
    id,
    name,
    date: `${date}T20:00:00`,
    type,
    location: { ...city, country_code: "XX" },
    tickets_and_rates: [TICKET],
    markup_ticket: 175,
    ...over,
  }) as unknown as Event;

const celine = ev(1, "סלין דיון", "2027-05-12", PARIS);
const chelsea = ev(2, "צ'לסי - אברטון", "2027-05-15", LONDON, "sports_event");
const krakowGig = ev(3, "קונצרט בקרקוב", "2027-05-14", KRAKOW);
const EVENTS = [celine, chelsea, krakowGig];

const row = (over: Partial<StaffRouteRow> = {}): StaffRouteRow => ({
  id: 7,
  title: "דון טוליבר והקלאסיקר",
  event_ids: [1, 2],
  sort_order: 0,
  ...over,
});

describe("parseStaffRouteRows", () => {
  it("a good row keeps its title trimmed and its ids as numbers", () => {
    const good = { id: 7, title: "  דון טוליבר והקלאסיקר ", event_ids: [1, 2], sort_order: 3, is_active: true };
    expect(parseStaffRouteRows([good])).toEqual([
      { id: 7, title: "דון טוליבר והקלאסיקר", event_ids: [1, 2], sort_order: 3 },
    ]);
  });

  it("keeps three ids and the reader's order", () => {
    const rows = parseStaffRouteRows([
      { id: 9, title: "ב", event_ids: [4, 5, 6], sort_order: 1 },
      { id: 8, title: "א", event_ids: [1, 2], sort_order: 2 },
    ]);
    expect(rows.map((r) => r.id)).toEqual([9, 8]);
    expect(rows[0].event_ids).toEqual([4, 5, 6]);
  });

  it("drops malformed rows and keeps the good one next to them", () => {
    const good = { id: 7, title: "טוב", event_ids: [1, 2], sort_order: 0 };
    const rows = parseStaffRouteRows([
      { id: 1, title: " ", event_ids: [1, 2], sort_order: 0 }, // blank title
      { id: 2, title: "אחד", event_ids: [1], sort_order: 0 }, // one id
      { id: 3, title: "ארבעה", event_ids: [1, 2, 3, 4], sort_order: 0 }, // four ids
      { id: 4, title: "לא מספר", event_ids: [1, "abc"], sort_order: 0 }, // a non-numeric id
      { title: "בלי מזהה", event_ids: [1, 2], sort_order: 0 }, // a missing id field
      { id: 5, title: "בלי אירועים", sort_order: 0 }, // no event_ids at all
      { id: 6, title: "לא מערך", event_ids: "1,2", sort_order: 0 }, // not an array
      { id: 8, title: "שבר", event_ids: [1, 2.5], sort_order: 0 }, // not a whole number
      { id: 9, title: "ריק", event_ids: [null, 2], sort_order: 0 }, // a null id
      null,
      "x",
      good,
    ]);
    expect(rows).toEqual([good]);
  });

  it("a title that is not a string drops the row", () => {
    expect(parseStaffRouteRows([{ id: 1, title: 5, event_ids: [1, 2], sort_order: 0 }])).toEqual([]);
  });

  it("a missing sort_order reads as 0", () => {
    expect(parseStaffRouteRows([{ id: 1, title: "x", event_ids: [1, 2] }])[0].sort_order).toBe(0);
  });

  it("anything but an array is no rows", () => {
    expect(parseStaffRouteRows(null)).toEqual([]);
    expect(parseStaffRouteRows(undefined)).toEqual([]);
    expect(parseStaffRouteRows({})).toEqual([]);
  });
});

describe("staffRouteCards", () => {
  it("a fitting staff row becomes a card with its title, the events in trip order", () => {
    const cards = staffRouteCards([row({ event_ids: [2, 1] })], EVENTS, S, TODAY);
    expect(cards).toHaveLength(1);
    expect(cards[0].staffTitle).toBe("דון טוליבר והקלאסיקר");
    expect(cards[0].ids).toEqual([1, 2]);
    expect(cards[0].title).toBe("פריז ← לונדון");
  });

  it("a three-event row is a card too", () => {
    const three = ev(4, "קונצרט בפריז", "2027-05-13", PARIS);
    const cards = staffRouteCards([row({ event_ids: [4, 2, 1] })], [...EVENTS, three], S, TODAY);
    expect(cards).toHaveLength(1);
    expect(cards[0].ids).toEqual([1, 4, 2]);
  });

  it("keeps the rows' order", () => {
    const parisEarly = ev(4, "קונצרט בפריז", "2027-05-10", PARIS);
    const cards = staffRouteCards(
      [row({ id: 1, title: "ראשון", event_ids: [2, 1] }), row({ id: 2, title: "שני", event_ids: [4, 1] })],
      [...EVENTS, parisEarly],
      S,
      TODAY,
    );
    expect(cards.map((c) => c.staffTitle)).toEqual(["ראשון", "שני"]);
  });

  it("a row with an id missing from the catalog is skipped", () => {
    expect(staffRouteCards([row({ event_ids: [1, 99] })], EVENTS, S, TODAY)).toEqual([]);
  });

  it("a row with an ineligible event is skipped: sold out, US, or less than 3 days away", () => {
    const soldOut = ev(10, "אזל", "2027-05-13", PARIS, "music_event", { tickets_and_rates: [] });
    const us = ev(11, "בארה״ב", "2027-05-13", PARIS, "music_event", {
      location: { ...PARIS, country_code: "US" },
    });
    const soon = ev(12, "מחר", "2027-01-03", PARIS);
    const catalog = [...EVENTS, soldOut, us, soon];
    expect(staffRouteCards([row({ event_ids: [1, 10] })], catalog, S, TODAY)).toEqual([]);
    expect(staffRouteCards([row({ event_ids: [1, 11] })], catalog, S, TODAY)).toEqual([]);
    expect(staffRouteCards([row({ event_ids: [12, 1] })], catalog, S, TODAY)).toEqual([]);
    // The same row with the eligible events is fine - the catalog is not what failed.
    expect(staffRouteCards([row({ event_ids: [1, 2] })], catalog, S, TODAY)).toHaveLength(1);
  });

  it("a row whose events do not fit together is skipped (farther apart than max_km)", () => {
    // Paris - Krakow is ~1,280 km; the default max is 1,000.
    expect(staffRouteCards([row({ event_ids: [1, 3] })], EVENTS, S, TODAY)).toEqual([]);
    // Raise the limit and the same row shows.
    expect(staffRouteCards([row({ event_ids: [1, 3] })], EVENTS, { ...S, maxKm: 2000, bestKm: 2000 }, TODAY)).toHaveLength(1);
  });

  it("a row with three events when the trip may hold two is skipped, never shown short", () => {
    const three = ev(4, "קונצרט בפריז", "2027-05-13", PARIS);
    expect(staffRouteCards([row({ event_ids: [1, 4, 2] })], [...EVENTS, three], { ...S, maxEvents: 2 }, TODAY)).toEqual([]);
  });

  it("two events on one day, or the same event twice, never make a card", () => {
    const sameDay = ev(5, "באותו יום", "2027-05-12", PARIS);
    expect(staffRouteCards([row({ event_ids: [1, 5] })], [...EVENTS, sameDay], S, TODAY)).toEqual([]);
    expect(staffRouteCards([row({ event_ids: [1, 1] })], EVENTS, S, TODAY)).toEqual([]);
  });

  it("a bad row does not take the good one with it", () => {
    const cards = staffRouteCards(
      [row({ id: 1, event_ids: [1, 99] }), row({ id: 2, title: "טוב", event_ids: [1, 2] })],
      EVENTS,
      S,
      TODAY,
    );
    expect(cards.map((c) => c.staffTitle)).toEqual(["טוב"]);
  });
});

/** A bare card: the merge reads the ids and nothing else. */
const card = (ids: number[], staffTitle?: string): RouteCardData =>
  ({ ids, title: ids.join(","), events: [], cities: [], nights: 0, stays: 0, perTraveller: 0, saving: null, kinds: [], firstDay: "", ...(staffTitle ? { staffTitle } : {}) }) as RouteCardData;

describe("mergeRouteCards", () => {
  it("puts staff first and drops the auto card with the same events", () => {
    const a = card([1, 2]);
    const b = card([3, 4]);
    const s = card([2, 1], "שלנו");
    expect(mergeRouteCards([s], [a, b])).toEqual([s, b]);
  });

  it("with no staff cards the auto list is untouched", () => {
    const auto = [card([1, 2]), card([3, 4])];
    expect(mergeRouteCards([], auto)).toEqual(auto);
  });

  it("with no auto cards the staff list stands alone", () => {
    const staff = [card([1, 2], "א"), card([3, 4], "ב")];
    expect(mergeRouteCards(staff, [])).toEqual(staff);
  });

  it("staff keep their own order, the auto cards keep theirs", () => {
    const merged = mergeRouteCards([card([5, 6], "ב"), card([1, 2], "א")], [card([7, 8]), card([3, 4])]);
    expect(merged.map((c) => c.ids)).toEqual([[5, 6], [1, 2], [7, 8], [3, 4]]);
  });

  it("two staff trips on the same events show once (the first) - the hub keys cards by their ids", () => {
    const first = card([1, 2], "ראשון");
    const merged = mergeRouteCards([first, card([2, 1], "שני")], []);
    expect(merged).toEqual([first]);
  });

  it("a trip of three events is not dropped by a pair inside it", () => {
    const triple = card([1, 2, 3]);
    expect(mergeRouteCards([card([1, 2], "זוג")], [triple])).toHaveLength(2);
  });

  it("does not mutate its inputs", () => {
    const staff = [card([2, 1], "א")];
    const auto = [card([1, 2]), card([3, 4])];
    mergeRouteCards(staff, auto);
    expect(staff).toHaveLength(1);
    expect(auto).toHaveLength(2);
    expect(staff[0].ids).toEqual([2, 1]);
  });
});
