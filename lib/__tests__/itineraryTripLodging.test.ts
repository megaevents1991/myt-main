import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import { moveName, stayCityName } from "../itinerary/builder";
import { defaultTripDates, eventGrounds, leaveGrounds, leaveWays, moves, ownTrains, stayHeads, stays, tripLegs } from "../itinerary/dates";
import { partGroundNotes } from "../itinerary/flightsView";
import { shareStay, stayPoint, tripStayCity } from "../itinerary/geo";

// Dor 09.11: in a trip a Manchester / Liverpool match sleeps where it is played; two such matches a
// short train apart share the first one's hotel.

type City = { latitude: number; longitude: number; name: string; city_iata?: string };

const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון, בריטניה", city_iata: "LON" };
const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז, צרפת", city_iata: "PAR" };
const MANCHESTER: City = { latitude: 53.48, longitude: -2.24, name: "מנצ'סטר" };
const LIVERPOOL: City = { latitude: 53.41, longitude: -2.98, name: "ליברפול, אנגליה" };

const ev = (id: number, date: string, city: City) =>
  ({ id, name: `event ${id}`, date: `${date}T20:00:00`, type: "sports_event", location: { ...city, country_code: "XX" } }) as unknown as Event;

/** A match sold as a flight to London, played in `at` (the backoffice's two-city event). */
const sub = (id: number, date: string, at: City, extra: Record<string, unknown> = {}) =>
  ({
    ...ev(id, date, LONDON),
    event_location: at,
    lodging_mode: "choice_split",
    lodging_default: "flight",
    split_default_nights: at === LIVERPOOL ? 2 : 1,
    ...extra,
  }) as unknown as Event;

const none: ReadonlySet<string> = new Set();

describe("where a trip sleeps", () => {
  it("a two-city event sleeps in its event city when its hotel may be there, else in its flight city", () => {
    expect(tripStayCity(sub(1, "2027-05-15", MANCHESTER))).toBe("event");
    expect(tripStayCity(sub(1, "2027-05-15", MANCHESTER, { lodging_mode: "event_city_only" }))).toBe("event");
    expect(tripStayCity(sub(1, "2027-05-15", MANCHESTER, { lodging_mode: "flight_city" }))).toBe("flight");
    expect(tripStayCity(ev(2, "2027-05-15", LONDON))).toBe("flight");
    expect(stayPoint(sub(1, "2027-05-15", MANCHESTER)).point.name).toBe("מנצ'סטר");
    expect(stayCityName(sub(1, "2027-05-15", LIVERPOOL))).toBe("ליברפול");
  });

  it("London, Manchester, London is three hotels and no flight between them (the split)", () => {
    const route = [ev(1, "2027-05-12", LONDON), sub(2, "2027-05-15", MANCHESTER), ev(3, "2027-05-19", LONDON)];
    const d = defaultTripDates(route);
    const list = stays(route, d);
    expect(list.map((s) => [stayCityName(s.events[0]), s.from, s.to])).toEqual([
      ["לונדון", "2027-05-11", "2027-05-15"],
      ["מנצ'סטר", "2027-05-15", "2027-05-16"],
      ["לונדון", "2027-05-16", "2027-05-20"],
    ]);
    expect(list[1].city).toBe("event");
    // One flight city: the moves are by train, the trip flies TLV - London - TLV.
    expect(tripLegs(route, d, none).map((l) => l.kind)).toEqual(["out", "ret"]);
  });

  it("the train into a sub-location's hotel takes its split nights: Liverpool's two, never before the day after A", () => {
    const route = [ev(1, "2027-05-12", LONDON), sub(2, "2027-05-16", LIVERPOOL)];
    expect(defaultTripDates(route).moves["1>2"]).toBe("2027-05-15");
    const tight = [ev(1, "2027-05-15", LONDON), sub(2, "2027-05-16", LIVERPOOL)];
    expect(defaultTripDates(tight).moves["1>2"]).toBe("2027-05-16");
    // A flight in (another flight city) keeps the day after A.
    const fromParis = [ev(1, "2027-05-12", PARIS), sub(2, "2027-05-16", MANCHESTER)];
    expect(defaultTripDates(fromParis).moves["1>2"]).toBe("2027-05-13");
  });

  it("Liverpool then Manchester share the first one's hotel; the Manchester match is a train from it", () => {
    const liverpool = sub(1, "2027-05-13", LIVERPOOL);
    const manchester = sub(2, "2027-05-15", MANCHESTER);
    expect(shareStay(liverpool, manchester)).toBe(true);
    const route = [liverpool, manchester];
    const list = stays(route, defaultTripDates(route));
    expect(list).toHaveLength(1);
    expect(stayCityName(list[0].events[0])).toBe("ליברפול");
    expect(moves(route)).toEqual([]);
    expect(stayHeads(route).get(2)?.id).toBe(1);
    const grounds = eventGrounds(route, none);
    expect(grounds.get(2)).toMatchObject({ from: "ליברפול", to: "מנצ'סטר" });
    // The first lands in London and takes the train to its own hotel.
    expect(grounds.get(1)).toMatchObject({ from: "לונדון", to: "ליברפול" });
  });

  it("London and Manchester never share a hotel (262 km)", () => {
    expect(shareStay(ev(1, "2027-05-12", LONDON), sub(2, "2027-05-15", MANCHESTER))).toBe(false);
  });
});

describe("eventGrounds", () => {
  it("a stay reached by a train move needs no way of its own; one reached by a flight does", () => {
    const route = [ev(1, "2027-05-12", LONDON), sub(2, "2027-05-15", MANCHESTER)];
    expect(eventGrounds(route, none).size).toBe(0);
    const fromParis = [ev(1, "2027-05-12", PARIS), sub(2, "2027-05-16", MANCHESTER)];
    expect(eventGrounds(fromParis, none).get(2)).toMatchObject({ from: "לונדון", to: "מנצ'סטר" });
    // The customer's own train from Paris goes to the Manchester hotel: nothing more to say.
    expect(eventGrounds(fromParis, new Set(["1>2"])).size).toBe(0);
  });

  it("an event played away from a hotel kept in its flight city is a day trip from it", () => {
    const route = [ev(1, "2027-05-12", LONDON), sub(2, "2027-05-15", MANCHESTER, { lodging_mode: "flight_city" })];
    expect(eventGrounds(route, none).get(2)).toMatchObject({ from: "לונדון", to: "מנצ'סטר" });
  });
});

describe("leaveGrounds", () => {
  // Dor 11.11: Manchester, London, Liverpool flew home "from London" out of a Liverpool hotel and
  // no screen said the train back.
  it("a trip that ends in a Liverpool hotel says the train back to London before the flight home", () => {
    const route = [sub(1, "2027-05-12", MANCHESTER), ev(2, "2027-05-16", LONDON), sub(3, "2027-05-20", LIVERPOOL)];
    const leave = leaveGrounds(route, none);
    expect([...leave.keys()]).toEqual(["ret"]);
    expect(leave.get("ret")).toMatchObject({ from: "ליברפול", to: "לונדון" });
    expect(leave.get("ret")?.km).toBeGreaterThan(250);
    // The way in was already said: the flight lands in London, the first hotel is in Manchester.
    expect(eventGrounds(route, none).get(1)).toMatchObject({ from: "לונדון", to: "מנצ'סטר" });
  });

  it("a trip that ends where its flight leaves has none", () => {
    const route = [ev(1, "2027-05-12", LONDON), sub(2, "2027-05-15", MANCHESTER), ev(3, "2027-05-19", LONDON)];
    expect(leaveGrounds(route, none).size).toBe(0);
    // A hotel kept in the flight city is already at the airport's city.
    const kept = [ev(1, "2027-05-12", PARIS), sub(2, "2027-05-16", MANCHESTER, { lodging_mode: "flight_city" })];
    expect(leaveGrounds(kept, none).size).toBe(0);
  });

  it("a shared stay is left from its own city: Liverpool then Manchester sleep in Liverpool", () => {
    const route = [sub(1, "2027-05-12", LIVERPOOL), sub(2, "2027-05-15", MANCHESTER)];
    expect(leaveGrounds(route, none).get("ret")).toMatchObject({ from: "ליברפול", to: "לונדון" });
  });

  it("a flight between two countries leaves from the airport too; the customer's own train does not", () => {
    const route = [sub(1, "2027-05-12", MANCHESTER), ev(2, "2027-05-16", PARIS)];
    const key = moves(route)[0].key;
    expect(leaveGrounds(route, none).get(key)).toMatchObject({ from: "מנצ'סטר", to: "לונדון" });
    expect(leaveGrounds(route, new Set([key])).has(key)).toBe(false);
  });

  it("leaveWays: in trip order, each on the day its flight leaves", () => {
    const route = [sub(1, "2027-05-12", MANCHESTER), ev(2, "2027-05-16", PARIS), sub(3, "2027-05-20", LIVERPOOL)];
    const d = defaultTripDates(route);
    const key = moves(route)[0].key;
    expect(leaveWays(route, d, none).map((w) => `${w.key} ${w.from}>${w.to} ${w.date}`)).toEqual([
      `${key} מנצ'סטר>לונדון ${d.moves[key]}`,
      `ret ליברפול>לונדון ${d.ret}`,
    ]);
  });
});

describe("ownTrains", () => {
  it("every move made on the ground, in trip order: under one flight city, and the customer's own choice", () => {
    const route = [sub(1, "2027-05-12", MANCHESTER), ev(2, "2027-05-16", LONDON), sub(3, "2027-05-20", LIVERPOOL)];
    const d = defaultTripDates(route);
    expect(ownTrains(route, d, none).map((t) => `${t.fromName}>${t.toName} ${t.date}`)).toEqual([
      "מנצ'סטר>לונדון 2027-05-13",
      "לונדון>ליברפול 2027-05-19",
    ]);
    const abroad = [ev(1, "2027-05-12", PARIS), ev(2, "2027-05-16", LONDON)];
    expect(ownTrains(abroad, defaultTripDates(abroad), none)).toEqual([]);
    expect(ownTrains(abroad, defaultTripDates(abroad), new Set(["1>2"])).map((t) => t.key)).toEqual(["1>2"]);
  });
});

describe("partGroundNotes (the small lines over a part's flights)", () => {
  const main = { key: "main", kind: "main" as const };

  it("Manchester, London, Liverpool: the way in from London, and the flight home leaves London", () => {
    const route = [sub(1, "2027-05-12", MANCHESTER), ev(2, "2027-05-16", LONDON), sub(3, "2027-05-20", LIVERPOOL)];
    expect(partGroundNotes(route, defaultTripDates(route), none, main)).toEqual([
      "למנצ'סטר ברכבת מלונדון, כ-2.0 שעות, הגעה עצמאית",
      "הטיסה חזרה יוצאת מלונדון: רכבת מליברפול, כ-2.2 שעות, הגעה עצמאית",
    ]);
  });

  it("a trip that ends in London says nothing about the way back", () => {
    const route = [sub(1, "2027-05-12", MANCHESTER), ev(2, "2027-05-16", LONDON)];
    expect(partGroundNotes(route, defaultTripDates(route), none, main)).toEqual(["למנצ'סטר ברכבת מלונדון, כ-2.0 שעות, הגעה עצמאית"]);
  });

  it("a move out of a Manchester hotel leaves London; the next stay's way is the move's too", () => {
    const route = [sub(1, "2027-05-12", MANCHESTER), ev(2, "2027-05-16", PARIS), sub(3, "2027-05-20", LIVERPOOL)];
    const [first, second] = moves(route);
    const d = defaultTripDates(route);
    expect(partGroundNotes(route, d, none, { key: first.key, kind: "move" })).toEqual([
      "הטיסה יוצאת מלונדון: רכבת ממנצ'סטר, כ-2.0 שעות, הגעה עצמאית",
    ]);
    expect(partGroundNotes(route, d, none, { key: second.key, kind: "move" })).toEqual(["לליברפול ברכבת מלונדון, כ-2.2 שעות, הגעה עצמאית"]);
  });
});

describe("moveName", () => {
  it("a flight by its airports' cities, a train by the stays it joins", () => {
    const route = [ev(1, "2027-05-12", PARIS), sub(2, "2027-05-16", MANCHESTER)];
    expect(moveName(route, "1>2")).toBe("פריז - לונדון");
    expect(moveName(route, "1>2", true)).toBe("פריז - מנצ'סטר");
    expect(moveName(route, "9>9")).toBe("");
  });
});
