import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import { defaultTripDates, moves } from "../itinerary/dates";
import { datePickSteps } from "../itinerary/datePick";
import { tripDays, tripStops } from "../itinerary/tripRoute";

type City = { latitude: number; longitude: number; name: string; city_iata: string };

const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז, צרפת", city_iata: "PAR" };
const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון, בריטניה", city_iata: "LON" };
const WEMBLEY: City = { latitude: 51.556, longitude: -0.28, name: "לונדון, בריטניה", city_iata: "LON" };

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

const none: ReadonlySet<string> = new Set();

describe("tripStops", () => {
  const MANCHESTER = { name: "מנצ'סטר", latitude: 53.48, longitude: -2.24 };
  const manchesterMatch = (id: number, date: string, lodging_mode = "choice_split") =>
    ({
      ...ev(id, "מנצ'סטר סיטי - צ'לסי", date, LONDON, "sports_event"),
      event_location: MANCHESTER,
      lodging_mode,
      lodging_default: "flight",
      split_default_nights: 1,
    }) as unknown as Event;

  it("a Manchester match next to London sleeps in Manchester: a train move, not 'נשארים' (Dor 09.11)", () => {
    const show = ev(1, "בוב דילן", "2027-05-12", LONDON);
    const match = manchesterMatch(2, "2027-05-15");
    const stops = tripStops([show, match], defaultTripDates([show, match]), none);
    // The trip ends in the Manchester hotel and flies home from London: the train back is a row (Dor 11.11).
    expect(stops.map((s) => s.kind)).toEqual(["depart", "event", "move", "event", "ground", "ret"]);
    expect(stops[2]).toMatchObject({ title: "הגעה עצמאית למנצ'סטר", day: "2027-05-15" });
    expect(stops[4]).toMatchObject({ title: "חזרה עצמאית ללונדון", detail: "רכבת ממנצ'סטר, כ-2.0 שעות · לא כלול" });
    expect(stops.some((s) => s.title.startsWith("נשארים"))).toBe(false);
  });

  it("London, Manchester, London: two train moves, the hotel in Manchester for the match's night", () => {
    const route = [ev(1, "טוטנהאם", "2027-05-12", LONDON, "sports_event"), manchesterMatch(2, "2027-05-15"), ev(3, "ארסנל", "2027-05-19", LONDON, "sports_event")];
    const stops = tripStops(route, defaultTripDates(route), none);
    expect(stops.map((s) => s.kind)).toEqual(["depart", "event", "move", "event", "move", "event", "ret"]);
    expect(stops[2]).toMatchObject({ title: "הגעה עצמאית למנצ'סטר", day: "2027-05-15" });
    expect(stops[4]).toMatchObject({ title: "הגעה עצמאית ללונדון", day: "2027-05-16" });
  });

  it("Manchester, London, Liverpool: the train back to London stands before the flight home (Dor 11.11)", () => {
    const LIVERPOOL = { name: "ליברפול, אנגליה", latitude: 53.41, longitude: -2.98 };
    const liverpool = { ...manchesterMatch(3, "2027-05-20"), name: "ליברפול - סנדרלנד", event_location: LIVERPOOL, split_default_nights: 2 } as unknown as Event;
    const route = [manchesterMatch(1, "2027-05-12"), ev(2, "ארסנל", "2027-05-16", LONDON, "sports_event"), liverpool];
    const stops = tripStops(route, defaultTripDates(route), none);
    expect(stops.map((s) => s.kind)).toEqual(["depart", "ground", "event", "move", "event", "move", "event", "ground", "ret"]);
    expect(stops[1]).toMatchObject({ title: "הגעה עצמאית למנצ'סטר" });
    expect(stops[7]).toMatchObject({ kind: "ground", title: "חזרה עצמאית ללונדון", detail: "רכבת מליברפול, כ-2.2 שעות · לא כלול" });
    expect(stops[8]).toMatchObject({ kind: "ret", title: "חזרה מלונדון" });
  });

  it("an event whose hotel stays in its flight city is still a way there, not 'נשארים' (Alon 01.11)", () => {
    const show = ev(1, "בוב דילן", "2027-05-12", LONDON);
    const match = manchesterMatch(2, "2027-05-15", "flight_city");
    const stops = tripStops([show, match], defaultTripDates([show, match]), none);
    expect(stops.map((s) => s.kind)).toEqual(["depart", "event", "ground", "event", "ret"]);
    expect(stops[2]).toMatchObject({ title: "הגעה עצמאית למנצ'סטר" });
    expect(stops.some((s) => s.title.startsWith("נשארים"))).toBe(false);
  });

  it("walks the trip like the planner's panel: out, event, move, event, home - with the date rule's labels", () => {
    const route = [celine, chelsea];
    const dates = defaultTripDates(route);
    const steps = datePickSteps(route, dates, none);
    const stops = tripStops(route, dates, none);
    expect(stops.map((s) => s.kind)).toEqual(["depart", "event", "move", "event", "ret"]);
    // The flight and move rows say exactly what the calendar says.
    expect(stops.filter((s) => s.kind !== "event").map((s) => s.title)).toEqual(steps.map((s) => s.label));
    expect(stops[0]).toMatchObject({ kind: "depart", day: dates.depart });
    expect(stops[1]).toMatchObject({ kind: "event", title: "סלין דיון", day: "2027-05-12", eventId: 618 });
    expect(stops[2]).toMatchObject({ kind: "move", day: dates.moves[moves(route)[0].key] });
    expect(stops[4]).toMatchObject({ kind: "ret", day: dates.ret });
  });

  it("two events in one city back to back: a stay row, no move", () => {
    const route = [chelsea, wembley];
    const stops = tripStops(route, defaultTripDates(route), none);
    expect(stops.map((s) => s.kind)).toEqual(["depart", "event", "stay", "event", "ret"]);
    expect(stops[2].title.startsWith("נשארים ב")).toBe(true);
  });

  it("a move the customer makes on their own keeps its row, worded as the calendar words it", () => {
    const route = [celine, chelsea];
    const dates = defaultTripDates(route);
    const train = new Set([moves(route)[0].key]);
    const move = tripStops(route, dates, train).find((s) => s.kind === "move");
    expect(move?.title).toBe("הגעה עצמאית ללונדון");
  });

  it("undated trip: the events alone; no route at all for no events", () => {
    const route = [celine, chelsea];
    const undated = tripStops(route, { depart: "", ret: "", moves: {} }, none);
    expect(undated.map((s) => s.kind)).toEqual(["event", "event"]);
    expect(tripStops([], defaultTripDates([]), none)).toEqual([]);
  });
});

describe("tripDays", () => {
  it("counts the flight out's day and the flight home's", () => {
    expect(tripDays({ depart: "2027-05-11", ret: "2027-05-16", moves: {} })).toBe(6);
    expect(tripDays({ depart: "2027-05-11", ret: "2027-05-11", moves: {} })).toBe(1);
  });
  it("is null for undated or upside-down dates", () => {
    expect(tripDays({ depart: "", ret: "2027-05-16", moves: {} })).toBeNull();
    expect(tripDays({ depart: "2027-05-16", ret: "2027-05-11", moves: {} })).toBeNull();
  });
});
