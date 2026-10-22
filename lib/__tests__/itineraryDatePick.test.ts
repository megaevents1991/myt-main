import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import { clampTripDates, defaultTripDates, moves, tripDateBounds } from "../itinerary/dates";
import { applyDatePick, datePickSteps } from "../itinerary/datePick";

type City = { latitude: number; longitude: number; name: string; city_iata: string };

const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז, צרפת", city_iata: "PAR" };
const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון, בריטניה", city_iata: "LON" };
const WEMBLEY: City = { latitude: 51.556, longitude: -0.28, name: "לונדון, בריטניה", city_iata: "LON" };
const AMSTERDAM: City = { latitude: 52.37, longitude: 4.9, name: "אמסטרדם, הולנד", city_iata: "AMS" };

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
const wembley = ev(703, "קונצרט בוומבלי", "2027-05-17", WEMBLEY);
const ajax = ev(810, "אייאקס - פיינורד", "2027-05-20", AMSTERDAM, "sports_event");

const none: ReadonlySet<string> = new Set();

describe("datePickSteps", () => {
  it("two cities: depart, the move, return - in trip order, named after the city flown to / moved to / left", () => {
    const route = [celine, chelsea];
    const d = defaultTripDates(route);
    const steps = datePickSteps(route, d, none);
    expect(steps.map((s) => s.key)).toEqual(["depart", "618>702", "ret"]);
    expect(steps.map((s) => s.kind)).toEqual(["depart", "move", "ret"]);
    expect(steps.map((s) => s.label)).toEqual(["טיסה הלוך לפריז", "מעבר ללונדון", "חזרה מלונדון"]);
  });

  it("each step carries its date and the range tripDateBounds allows", () => {
    const route = [celine, chelsea];
    const d = defaultTripDates(route);
    const b = tripDateBounds(route, d);
    const [depart, move, ret] = datePickSteps(route, d, none);
    expect(depart.value).toBe(d.depart);
    expect([depart.min, depart.max]).toEqual(b.depart);
    expect(move.value).toBe(d.moves["618>702"]);
    expect([move.min, move.max]).toEqual(b.moves["618>702"]);
    expect(ret.value).toBe(d.ret);
    expect([ret.min, ret.max]).toEqual(b.ret);
  });

  it("two events in one city make one stay: no move to pick", () => {
    const route = [chelsea, wembley];
    const steps = datePickSteps(route, defaultTripDates(route), none);
    expect(steps.map((s) => s.key)).toEqual(["depart", "ret"]);
    expect(steps.map((s) => s.label)).toEqual(["טיסה הלוך ללונדון", "חזרה מלונדון"]);
  });

  it("three cities: four dates, the return names the LAST city", () => {
    const route = [celine, chelsea, ajax];
    const steps = datePickSteps(route, defaultTripDates(route), none);
    expect(steps.map((s) => s.key)).toEqual(["depart", "618>702", "702>810", "ret"]);
    expect(steps.map((s) => s.label)).toEqual([
      "טיסה הלוך לפריז",
      "מעבר ללונדון",
      "מעבר לאמסטרדם",
      "חזרה מאמסטרדם",
    ]);
  });

  it("a stay of two events in one city is named once, from its first event", () => {
    const route = [celine, chelsea, wembley];
    const steps = datePickSteps(route, defaultTripDates(route), none);
    expect(steps.map((s) => s.label)).toEqual(["טיסה הלוך לפריז", "מעבר ללונדון", "חזרה מלונדון"]);
  });

  it("a move made on one's own is still picked, and says so", () => {
    const route = [celine, chelsea, ajax];
    const steps = datePickSteps(route, defaultTripDates(route), new Set(["702>810"]));
    expect(steps.map((s) => s.label)).toEqual([
      "טיסה הלוך לפריז",
      "מעבר ללונדון",
      "מעבר לאמסטרדם (עצמאית)",
      "חזרה מאמסטרדם",
    ]);
    expect(steps).toHaveLength(4);
  });

  it("a train key that is not a move of the route changes nothing", () => {
    const route = [celine, chelsea];
    const steps = datePickSteps(route, defaultTripDates(route), new Set(["1>2"]));
    expect(steps.map((s) => s.label)).toEqual(["טיסה הלוך לפריז", "מעבר ללונדון", "חזרה מלונדון"]);
  });

  it("the route is read in trip order whatever order it arrives in", () => {
    const steps = datePickSteps([ajax, celine, chelsea], defaultTripDates([celine, chelsea, ajax]), none);
    expect(steps.map((s) => s.key)).toEqual(["depart", "618>702", "702>810", "ret"]);
  });

  it("dates that are not set yet show the defaults, inside each range", () => {
    const route = [celine, chelsea];
    const def = defaultTripDates(route);
    const steps = datePickSteps(route, { depart: "", ret: "", moves: {} }, none);
    expect(steps.map((s) => s.value)).toEqual([def.depart, def.moves["618>702"], def.ret]);
    for (const s of steps) expect(s.value >= s.min && s.value <= s.max).toBe(true);
  });

  it("an empty route has nothing to pick", () => {
    expect(datePickSteps([], { depart: "", ret: "", moves: {} }, none)).toEqual([]);
  });
});

describe("applyDatePick", () => {
  const route = [celine, chelsea];
  const d = defaultTripDates(route);
  const key = moves(route)[0].key;

  it("a day inside the range is kept", () => {
    const [lo, hi] = tripDateBounds(route, d).moves[key];
    expect(hi > lo).toBe(true);
    const out = applyDatePick(route, d, key, hi);
    expect(out.moves[key]).toBe(hi);
    expect(out.depart).toBe(d.depart);
    expect(out.ret).toBe(d.ret);
  });

  it("the departure and the return are keys too", () => {
    const b = tripDateBounds(route, d);
    expect(applyDatePick(route, d, "depart", b.depart[0]).depart).toBe(b.depart[0]);
    expect(applyDatePick(route, d, "ret", b.ret[1]).ret).toBe(b.ret[1]);
  });

  it("a day past the range comes back clamped to its edge", () => {
    const [lo, hi] = tripDateBounds(route, d).moves[key];
    expect(applyDatePick(route, d, key, "2030-01-01").moves[key]).toBe(hi);
    expect(applyDatePick(route, d, key, "2020-01-01").moves[key]).toBe(lo);
  });

  it("an unknown key changes nothing - the dates only come back clamped", () => {
    expect(applyDatePick(route, d, "nope", "2027-05-14")).toEqual(clampTripDates(route, d));
  });

  it("does not mutate the dates it was given", () => {
    const before = JSON.stringify(d);
    applyDatePick(route, d, key, "2027-05-14");
    expect(JSON.stringify(d)).toBe(before);
  });
});
