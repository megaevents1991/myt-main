import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import type { Stay, TripDates } from "../itinerary/types";
import {
  addDays,
  clampTripDates,
  defaultTripDates,
  moves,
  stays,
  tripDateBounds,
  tripLegs,
  trainLegs,
} from "../itinerary/dates";

type City = { latitude: number; longitude: number; name: string; city_iata: string };

const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז, צרפת", city_iata: "PAR" };
const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון, בריטניה", city_iata: "LON" };
const AMSTERDAM: City = { latitude: 52.37, longitude: 4.9, name: "אמסטרדם, הולנד", city_iata: "AMS" };
/** Another London venue (Wembley), ~12 km from LONDON: the same city. */
const WEMBLEY: City = { latitude: 51.556, longitude: -0.28, name: "לונדון, בריטניה", city_iata: "LON" };

/** A partial event: only what the dates read. No event_location / lodging_mode, so stay point = location. */
const ev = (id: number, name: string, date: string, city: City, type = "music_event") =>
  ({
    id,
    name,
    date: `${date}T20:00:00`,
    type,
    location: { ...city, country_code: "XX" },
  }) as unknown as Event;

/**
 * A two-city event: sold as a flight to London, played in Manchester. With the default
 * (`flight_city`) lodging the traveller sleeps in London; with `event_city_only` in Manchester.
 */
const manchesterMatch = (id: number, date: string, over: Record<string, unknown> = {}) =>
  ({
    id,
    name: "מנצ'סטר יונייטד - ליברפול",
    date: `${date}T17:30:00`,
    type: "sports_event",
    location: { ...LONDON, country_code: "GB" },
    event_location: { latitude: 53.48, longitude: -2.24, name: "מנצ'סטר", city_iata: "MAN", country_code: "GB" },
    ...over,
  }) as unknown as Event;

const celine = ev(618, "סלין דיון", "2027-05-12", PARIS);
const chelsea = ev(702, "צ'לסי - אברטון", "2027-05-15", LONDON, "sports_event");
const wembley = ev(703, "קונצרט בוומבלי", "2027-05-17", WEMBLEY);
const ajax = ev(810, "אייאקס - פיינורד", "2027-05-20", AMSTERDAM, "sports_event");

const none: ReadonlySet<string> = new Set();

/** Every stay of a valid trip has at least one night, and the stays run back to back. */
function expectContiguousNights(list: Stay[], d: TripDates) {
  for (const s of list) expect(s.from < s.to, `stay ${s.key}: ${s.from} -> ${s.to}`).toBe(true);
  for (let i = 1; i < list.length; i++) expect(list[i].from).toBe(list[i - 1].to);
  expect(list[0].from).toBe(d.depart);
  expect(list[list.length - 1].to).toBe(d.ret);
}

describe("addDays", () => {
  it("moves a YYYY-MM-DD day forward and back", () => {
    expect(addDays("2027-05-12", 1)).toBe("2027-05-13");
    expect(addDays("2027-05-12", -1)).toBe("2027-05-11");
    expect(addDays("2027-05-12", 0)).toBe("2027-05-12");
  });

  it("crosses month, year and leap-day boundaries", () => {
    expect(addDays("2027-05-31", 1)).toBe("2027-06-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("is not moved by a DST change (UTC day math)", () => {
    expect(addDays("2027-03-27", 1)).toBe("2027-03-28");
    expect(addDays("2027-03-28", 1)).toBe("2027-03-29");
    expect(addDays("2027-10-30", 2)).toBe("2027-11-01");
  });
});

describe("moves", () => {
  it("is one move per consecutive pair in different cities, keyed a>b", () => {
    const m = moves([celine, chelsea]);
    expect(m.map((x) => x.key)).toEqual(["618>702"]);
    expect(m[0].a).toBe(celine);
    expect(m[0].b).toBe(chelsea);
  });

  it("walks the route in date order whatever order it arrives in", () => {
    expect(moves([ajax, celine, chelsea]).map((x) => x.key)).toEqual(["618>702", "702>810"]);
  });

  it("has no move between two events in one city", () => {
    expect(moves([chelsea, wembley])).toEqual([]);
  });

  it("is empty for a single event or no route", () => {
    expect(moves([celine])).toEqual([]);
    expect(moves([])).toEqual([]);
  });

  it("does not mutate its input", () => {
    const input = [chelsea, celine];
    moves(input);
    expect(input.map((e) => e.id)).toEqual([702, 618]);
  });
});

describe("defaultTripDates", () => {
  it("departs the day before the first event, returns the day after the last, moves the day after a", () => {
    expect(defaultTripDates([celine, chelsea])).toEqual({
      depart: "2027-05-11",
      ret: "2027-05-16",
      moves: { "618>702": "2027-05-13" },
    });
  });

  it("gives every move its own default on a three-event trip, in any input order", () => {
    expect(defaultTripDates([ajax, chelsea, celine])).toEqual({
      depart: "2027-05-11",
      ret: "2027-05-21",
      moves: { "618>702": "2027-05-13", "702>810": "2027-05-16" },
    });
  });

  it("has no moves for one event or events in one city", () => {
    expect(defaultTripDates([celine])).toEqual({ depart: "2027-05-11", ret: "2027-05-13", moves: {} });
    expect(defaultTripDates([chelsea, wembley])).toEqual({ depart: "2027-05-14", ret: "2027-05-18", moves: {} });
  });
});

describe("tripDateBounds", () => {
  it("depart [first - 3, first], return [last + 1, last + 3], move [a + 1, b]", () => {
    const route = [celine, chelsea];
    expect(tripDateBounds(route, defaultTripDates(route))).toEqual({
      depart: ["2027-05-09", "2027-05-12"],
      ret: ["2027-05-16", "2027-05-18"],
      moves: { "618>702": ["2027-05-13", "2027-05-15"] },
    });
  });

  it("has a range per move of a three-event trip and none for a same-city pair", () => {
    const three = [celine, chelsea, ajax];
    expect(tripDateBounds(three, defaultTripDates(three)).moves).toEqual({
      "618>702": ["2027-05-13", "2027-05-15"],
      "702>810": ["2027-05-16", "2027-05-20"],
    });
    const pair = [chelsea, wembley];
    expect(tripDateBounds(pair, defaultTripDates(pair)).moves).toEqual({});
  });

  it("does not depend on the dates passed in", () => {
    const route = [celine, chelsea];
    const wild: TripDates = { depart: "1999-01-01", ret: "2099-01-01", moves: { "x>y": "2000-01-01" } };
    expect(tripDateBounds(route, wild)).toEqual(tripDateBounds(route, defaultTripDates(route)));
  });
});

describe("clampTripDates", () => {
  const route = [celine, chelsea];

  it("pulls depart, a move and the return back inside their ranges", () => {
    const clamped = clampTripDates(route, {
      depart: "2027-05-13",
      ret: "2027-05-14",
      moves: { "618>702": "2027-05-20" },
    });
    expect(clamped).toEqual({
      depart: "2027-05-12",
      ret: "2027-05-16",
      moves: { "618>702": "2027-05-15" },
    });
  });

  it("pulls dates that are too early up to the lower bound", () => {
    expect(
      clampTripDates(route, { depart: "2027-05-01", ret: "2027-06-30", moves: { "618>702": "2027-05-12" } }),
    ).toEqual({ depart: "2027-05-09", ret: "2027-05-18", moves: { "618>702": "2027-05-13" } });
  });

  it("leaves valid dates alone and is idempotent", () => {
    const valid: TripDates = { depart: "2027-05-10", ret: "2027-05-17", moves: { "618>702": "2027-05-14" } };
    const once = clampTripDates(route, valid);
    expect(once).toEqual(valid);
    expect(clampTripDates(route, once)).toEqual(once);
  });

  it("keeps the edges of every range (they are valid)", () => {
    const edges: TripDates = { depart: "2027-05-12", ret: "2027-05-16", moves: { "618>702": "2027-05-15" } };
    expect(clampTripDates(route, edges)).toEqual(edges);
  });

  it("drops a move key that is not a move of this route", () => {
    const clamped = clampTripDates(route, {
      depart: "2027-05-11",
      ret: "2027-05-16",
      moves: { "618>702": "2027-05-13", "702>999": "2027-05-16", "1>2": "2027-01-01" },
    });
    expect(Object.keys(clamped.moves)).toEqual(["618>702"]);
  });

  it("adds a missing move at its default", () => {
    expect(clampTripDates(route, { depart: "2027-05-11", ret: "2027-05-16", moves: {} }).moves).toEqual({
      "618>702": "2027-05-13",
    });
  });

  it("re-keys the moves when the route changes under the dates", () => {
    const three = [celine, chelsea, ajax];
    const fromPair = clampTripDates(three, { depart: "2027-05-11", ret: "2027-05-16", moves: { "618>702": "2027-05-14" } });
    expect(fromPair).toEqual({
      depart: "2027-05-11",
      ret: "2027-05-21", // 2027-05-16 is before last + 1
      moves: { "618>702": "2027-05-14", "702>810": "2027-05-16" },
    });
  });

  it("does not mutate the dates it is given", () => {
    const input: TripDates = { depart: "2027-05-13", ret: "2027-05-14", moves: { "618>702": "2027-05-20" } };
    const copy = JSON.parse(JSON.stringify(input));
    clampTripDates(route, input);
    expect(input).toEqual(copy);
  });

  it("gives the default dates of a route to a draft that has none yet (the empty route's dates)", () => {
    const fresh = defaultTripDates([]);
    expect(clampTripDates(route, fresh)).toEqual(defaultTripDates(route));
    expect(
      clampTripDates(route, { depart: "not a day", ret: "", moves: { "618>702": "" } }),
    ).toEqual(defaultTripDates(route));
  });
});

describe("stays", () => {
  it("[Céline, Chelsea]: Paris 11 -> 13, London 13 -> 16", () => {
    const route = [celine, chelsea];
    const d = defaultTripDates(route);
    const list = stays(route, d);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ key: "618", city: "flight", from: "2027-05-11", to: "2027-05-13" });
    expect(list[0].point.name).toBe("פריז, צרפת");
    expect(list[0].events.map((e) => e.id)).toEqual([618]);
    expect(list[1]).toMatchObject({ key: "702", city: "flight", from: "2027-05-13", to: "2027-05-16" });
    expect(list[1].point.name).toBe("לונדון, בריטניה");
    expectContiguousNights(list, d);
  });

  it("[Chelsea 15/05, London event 17/05]: one stay, depart -> return, no move", () => {
    const route = [chelsea, wembley];
    const d = defaultTripDates(route);
    const list = stays(route, d);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ key: "702", from: "2027-05-14", to: "2027-05-18" });
    expect(list[0].events.map((e) => e.id)).toEqual([702, 703]);
    expectContiguousNights(list, d);
  });

  it("a Manchester match slept in Manchester + a London event: two stays, 262 km apart", () => {
    const match = manchesterMatch(901, "2027-05-15", { lodging_mode: "event_city_only" });
    const route = [match, wembley];
    const d = defaultTripDates(route);
    const list = stays(route, d);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ key: "901", city: "event", from: "2027-05-14", to: "2027-05-16" });
    expect(list[0].point.name).toBe("מנצ'סטר");
    expect(list[1]).toMatchObject({ key: "703", city: "flight", from: "2027-05-16", to: "2027-05-18" });
    expectContiguousNights(list, d);
  });

  it("the same match on the default (flight city) lodging + a London event: one stay", () => {
    const route = [manchesterMatch(901, "2027-05-15"), wembley];
    const d = defaultTripDates(route);
    const list = stays(route, d);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ key: "901", city: "flight", from: "2027-05-14", to: "2027-05-18" });
    expectContiguousNights(list, d);
  });

  it("a three-city trip has three stays that run back to back, in date order", () => {
    const route = [ajax, celine, chelsea];
    const d = defaultTripDates(route);
    const list = stays(route, d);
    expect(list.map((s) => [s.key, s.from, s.to])).toEqual([
      ["618", "2027-05-11", "2027-05-13"],
      ["702", "2027-05-13", "2027-05-16"],
      ["810", "2027-05-16", "2027-05-21"],
    ]);
    expectContiguousNights(list, d);
  });

  it("follows the dates it is given", () => {
    const route = [celine, chelsea];
    const d: TripDates = { depart: "2027-05-09", ret: "2027-05-18", moves: { "618>702": "2027-05-15" } };
    expect(stays(route, d).map((s) => [s.from, s.to])).toEqual([
      ["2027-05-09", "2027-05-15"],
      ["2027-05-15", "2027-05-18"],
    ]);
  });

  it("falls back to the default move day when the dates lack the move", () => {
    const list = stays([celine, chelsea], { depart: "2027-05-11", ret: "2027-05-16", moves: {} });
    expect(list.map((s) => [s.from, s.to])).toEqual([
      ["2027-05-11", "2027-05-13"],
      ["2027-05-13", "2027-05-16"],
    ]);
  });

  it("every stay keeps at least one night with each date at either end of its range", () => {
    const route = [celine, chelsea, ajax];
    const bounds = tripDateBounds(route, defaultTripDates(route));
    for (const depart of bounds.depart) {
      for (const ret of bounds.ret) {
        for (const m1 of bounds.moves["618>702"]) {
          for (const m2 of bounds.moves["702>810"]) {
            const d: TripDates = { depart, ret, moves: { "618>702": m1, "702>810": m2 } };
            expectContiguousNights(stays(route, d), d);
          }
        }
      }
    }
    const pair = [chelsea, wembley];
    const pb = tripDateBounds(pair, defaultTripDates(pair));
    for (const depart of pb.depart) {
      for (const ret of pb.ret) {
        const d: TripDates = { depart, ret, moves: {} };
        expectContiguousNights(stays(pair, d), d);
      }
    }
  });

  it("clamped dates always make valid stays", () => {
    const route = [celine, chelsea];
    const d = clampTripDates(route, { depart: "2027-05-30", ret: "2027-05-01", moves: { "618>702": "2027-05-30" } });
    expectContiguousNights(stays(route, d), d);
  });

  it("is empty for no route", () => {
    expect(stays([], { depart: "", ret: "", moves: {} })).toEqual([]);
  });
});

describe("tripLegs", () => {
  it("[Céline, Chelsea]: TLV -> PAR on depart, PAR -> LON on the move (343 km), LON -> TLV on return", () => {
    const route = [celine, chelsea];
    const legs = tripLegs(route, defaultTripDates(route), none);
    expect(legs).toHaveLength(3);
    expect(legs[0]).toEqual({ kind: "out", from: "TLV", to: "PAR", date: "2027-05-11" });
    expect(legs[1]).toMatchObject({ kind: "mid", from: "PAR", to: "LON", date: "2027-05-13", key: "618>702" });
    expect(Math.abs((legs[1].km ?? 0) - 343)).toBeLessThanOrEqual(2);
    expect(legs[2]).toEqual({ kind: "ret", from: "LON", to: "TLV", date: "2027-05-16" });
  });

  it("a move by train leaves the flight legs and becomes a train leg", () => {
    const route = [celine, chelsea];
    const d = defaultTripDates(route);
    const train: ReadonlySet<string> = new Set(["618>702"]);
    const legs = tripLegs(route, d, train);
    expect(legs.map((l) => [l.kind, l.from, l.to, l.date])).toEqual([
      ["out", "TLV", "PAR", "2027-05-11"],
      ["ret", "LON", "TLV", "2027-05-16"],
    ]);
    const tl = trainLegs(route, d, train);
    expect(tl).toHaveLength(1);
    expect(tl[0]).toMatchObject({ key: "618>702", fromName: "פריז", toName: "לונדון", date: "2027-05-13" });
    expect(Math.abs(tl[0].km - 343)).toBeLessThanOrEqual(2);
  });

  it("no train leg while nothing is by train", () => {
    const route = [celine, chelsea];
    expect(trainLegs(route, defaultTripDates(route), none)).toEqual([]);
  });

  it("[Chelsea 15/05, London event 17/05]: out and return only, no mid leg", () => {
    const route = [chelsea, wembley];
    const legs = tripLegs(route, defaultTripDates(route), none);
    expect(legs.map((l) => [l.kind, l.from, l.to, l.date])).toEqual([
      ["out", "TLV", "LON", "2027-05-14"],
      ["ret", "LON", "TLV", "2027-05-18"],
    ]);
  });

  it("a Manchester match slept in Manchester + a London event: two stays but no flight between them", () => {
    const match = manchesterMatch(901, "2027-05-15", { lodging_mode: "event_city_only" });
    const route = [match, wembley];
    const d = defaultTripDates(route);
    expect(stays(route, d)).toHaveLength(2);
    expect(moves(route)).toHaveLength(1);
    const legs = tripLegs(route, d, none);
    expect(legs.map((l) => l.kind)).toEqual(["out", "ret"]);
    expect(legs[0]).toMatchObject({ from: "TLV", to: "LON" });
    expect(legs[1]).toMatchObject({ from: "LON", to: "TLV" });
  });

  it("a single event is a return trip", () => {
    const legs = tripLegs([celine], defaultTripDates([celine]), none);
    expect(legs.map((l) => [l.kind, l.from, l.to, l.date])).toEqual([
      ["out", "TLV", "PAR", "2027-05-11"],
      ["ret", "PAR", "TLV", "2027-05-13"],
    ]);
  });

  it("three cities: out, two mid legs on their move days (in order), return", () => {
    const route = [ajax, chelsea, celine];
    const legs = tripLegs(route, defaultTripDates(route), none);
    expect(legs.map((l) => [l.kind, l.from, l.to, l.date])).toEqual([
      ["out", "TLV", "PAR", "2027-05-11"],
      ["mid", "PAR", "LON", "2027-05-13"],
      ["mid", "LON", "AMS", "2027-05-16"],
      ["ret", "AMS", "TLV", "2027-05-21"],
    ]);
    expect(legs[2].key).toBe("702>810");
    expect(Math.abs((legs[2].km ?? 0) - 357)).toBeLessThanOrEqual(3);
  });

  it("one train hop of two keeps the other flight", () => {
    const route = [celine, chelsea, ajax];
    const d = defaultTripDates(route);
    const train: ReadonlySet<string> = new Set(["618>702"]);
    expect(tripLegs(route, d, train).map((l) => [l.kind, l.from, l.to])).toEqual([
      ["out", "TLV", "PAR"],
      ["mid", "LON", "AMS"],
      ["ret", "AMS", "TLV"],
    ]);
    expect(trainLegs(route, d, train).map((t) => t.key)).toEqual(["618>702"]);
  });

  it("dates come from the trip dates it is given", () => {
    const route = [celine, chelsea];
    const d: TripDates = { depart: "2027-05-09", ret: "2027-05-18", moves: { "618>702": "2027-05-15" } };
    expect(tripLegs(route, d, none).map((l) => l.date)).toEqual(["2027-05-09", "2027-05-15", "2027-05-18"]);
  });

  it("a key in the train set that is not a move of the route does nothing", () => {
    const route = [celine, chelsea];
    const d = defaultTripDates(route);
    const train: ReadonlySet<string> = new Set(["1>2"]);
    expect(tripLegs(route, d, train)).toEqual(tripLegs(route, d, none));
    expect(trainLegs(route, d, train)).toEqual([]);
  });

  it("is empty for no route", () => {
    const d = { depart: "", ret: "", moves: {} };
    expect(tripLegs([], d, none)).toEqual([]);
    expect(trainLegs([], d, none)).toEqual([]);
  });
});

describe("empty route", () => {
  it("has no dates to propose and nothing to clamp", () => {
    expect(defaultTripDates([])).toEqual({ depart: "", ret: "", moves: {} });
    expect(clampTripDates([], { depart: "2027-05-01", ret: "2027-05-09", moves: { "1>2": "2027-05-03" } })).toEqual({
      depart: "",
      ret: "",
      moves: {},
    });
    expect(tripDateBounds([], defaultTripDates([]))).toEqual({ depart: ["", ""], ret: ["", ""], moves: {} });
  });
});
