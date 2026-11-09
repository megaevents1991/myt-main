import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import { moveName, stayCityName } from "../itinerary/builder";
import { defaultTripDates, eventGrounds, moves, stayHeads, stays, tripLegs } from "../itinerary/dates";
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

describe("moveName", () => {
  it("a flight by its airports' cities, a train by the stays it joins", () => {
    const route = [ev(1, "2027-05-12", PARIS), sub(2, "2027-05-16", MANCHESTER)];
    expect(moveName(route, "1>2")).toBe("פריז - לונדון");
    expect(moveName(route, "1>2", true)).toBe("פריז - מנצ'סטר");
    expect(moveName(route, "9>9")).toBe("");
  });
});
