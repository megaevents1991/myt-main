import { describe, expect, it } from "vitest";

import type { Event } from "@/lib/app.types";
import { applyDirect, canFlyDirect, directCityName, directOrigin, eventCityAirport, flyDirect } from "../itinerary/direct";
import { datePickSteps } from "../itinerary/datePick";
import { stayChoices } from "../itinerary/stayChoice";
import { defaultTripDates, eventGrounds, leaveGrounds, moves, stays, tripLegs } from "../itinerary/dates";
import { INITIAL_ITINERARY_STATE, itineraryReducer, type ItineraryState } from "../itinerary/state";

const LONDON = { name: "לונדון, בריטניה", latitude: 51.5, longitude: -0.12, city_iata: "LON" };
const DUSSELDORF = { name: "דיסלדורף, גרמניה", latitude: 51.22, longitude: 6.77, city_iata: "DUS" };
const MANCHESTER = { name: "מנצ'סטר", latitude: 53.48, longitude: -2.24 };
const LIVERPOOL = { name: "ליברפול", latitude: 53.41, longitude: -2.98 };

const ev = (id: number, date: string, location: Event["location"], extra: Partial<Event> = {}): Event =>
  ({ id, name: `event ${id}`, date, type: "sports_event", location, tickets_and_rates: [], ...extra }) as unknown as Event;

const dylan = ev(1, "2026-12-07", LONDON);
const dortmund = ev(2, "2026-12-09", DUSSELDORF);
const city = ev(3, "2026-12-12", LONDON, { event_location: MANCHESTER, lodging_mode: "choice_split", lodging_default: "flight" });
const londonAfter = ev(6, "2026-12-15", LONDON);
const cityFirst = ev(7, "2026-12-04", LONDON, { event_location: MANCHESTER, lodging_mode: "choice_split", lodging_default: "flight" });
const liverpool = ev(5, "2026-12-04", LONDON, { event_location: LIVERPOOL, lodging_mode: "choice_split", lodging_default: "flight" });

describe("flying straight to a sub-location", () => {
  it("knows the airport of Manchester, and of no event without a city of its own", () => {
    expect(eventCityAirport(city)).toBe("MAN");
    expect(eventCityAirport(dylan)).toBeNull();
    expect(eventCityAirport(ev(4, "2026-12-12", LONDON, { event_location: { name: "ברייטון", latitude: 50.82, longitude: -0.13 } }))).toBeNull();
  });

  it("is offered where a flight reaches it: the trip's ends, or a neighbour under another flight city (Alon 12.11)", () => {
    expect(canFlyDirect([dylan, dortmund, city], city)).toBe(true);
    // Next to a London show, as the trip's last or first event.
    expect(canFlyDirect([dylan, city], city)).toBe(true);
    expect(canFlyDirect([cityFirst, dylan], cityFirst)).toBe(true);
    // Between two London shows no flight touches it.
    expect(canFlyDirect([dylan, city, londonAfter], city)).toBe(false);
  });

  it("next to London the way on is still the train: no Manchester-London flight (Alon 12.11)", () => {
    const route = [flyDirect(cityFirst), dylan];
    const dates = defaultTripDates(route);
    expect(tripLegs(route, dates, new Set()).map((l) => `${l.from}>${l.to}`)).toEqual(["TLV>MAN", "LON>TLV"]);
    expect(datePickSteps(route, dates, new Set()).map((s) => s.label)).toEqual([
      "טיסה הלוך למנצ'סטר",
      "הגעה עצמאית ללונדון",
      "חזרה מלונדון",
    ]);
    expect(flyDirect(cityFirst).location).toMatchObject({ city_iata: "MAN", hub_iata: "LON" });
  });

  it("a Liverpool match lands in Manchester, sleeps in Liverpool and says the train from the airport (Alon 12.11)", () => {
    expect(eventCityAirport(liverpool)).toBe("MAN");
    expect(directCityName(liverpool)).toBe("מנצ'סטר");
    const flown = flyDirect(liverpool);
    expect(flown.location).toMatchObject({ city_iata: "MAN", hub_iata: "LON" });
    expect(flown.event_location?.name).toBe("ליברפול");
    expect(directCityName(flown)).toBe("מנצ'סטר");
    const route = [flown, dylan];
    const dates = defaultTripDates(route);
    expect(tripLegs(route, dates, new Set()).map((l) => `${l.from}>${l.to}`)).toEqual(["TLV>MAN", "LON>TLV"]);
    expect(stays(route, dates)[0].point.name).toBe("ליברפול");
    expect(eventGrounds(route, new Set()).get(5)).toMatchObject({ from: "מנצ'סטר", to: "ליברפול" });
    // Home from Manchester when it closes the trip: the train back to the airport.
    const last = flyDirect(ev(8, "2026-12-12", LONDON, { event_location: LIVERPOOL, lodging_mode: "choice_split", lodging_default: "flight" }));
    expect(leaveGrounds([dylan, last], new Set()).get("ret")).toMatchObject({ from: "ליברפול", to: "מנצ'סטר" });
  });

  it("a Manchester match flown to directly still shares its hotel with the Liverpool match after it (Dor 09.11)", () => {
    const after = ev(10, "2026-12-15", LONDON, { event_location: LIVERPOOL, lodging_mode: "choice_split", lodging_default: "flight" });
    const route = [flyDirect(city), after];
    const dates = defaultTripDates(route);
    expect(stays(route, dates)).toHaveLength(1);
    expect(stays(route, dates)[0].point.name).toBe("מנצ'סטר");
    const choice = stayChoices(route).find((c) => c.event.id === 10);
    expect(choice?.current).toBe("shared");
    expect(choice?.options.map((o) => o.pick)).toEqual(["shared", "event", "flight"]);
    // The way out lands in Manchester, the way home leaves London - the Liverpool match is a day trip.
    expect(tripLegs(route, dates, new Set()).map((l) => `${l.from}>${l.to}`)).toEqual(["TLV>MAN", "LON>TLV"]);
  });

  it("a Liverpool match flown home from Manchester, in the Manchester match's hotel, says the return from Manchester", () => {
    const shared = [city, flyDirect(ev(9, "2026-12-15", LONDON, { event_location: LIVERPOOL, lodging_mode: "choice_split", lodging_default: "flight" }))];
    const dates = defaultTripDates(shared);
    expect(stays(shared, dates)).toHaveLength(1);
    expect(tripLegs(shared, dates, new Set()).map((l) => `${l.from}>${l.to}`)).toEqual(["TLV>LON", "MAN>TLV"]);
    expect(datePickSteps(shared, dates, new Set()).map((s) => s.label)).toEqual(["טיסה הלוך ללונדון", "חזרה ממנצ'סטר"]);
    expect(leaveGrounds(shared, new Set()).get("ret")).toBeUndefined();
  });

  it("makes the event one in its own city: legs and stay follow", () => {
    const route = [dylan, dortmund, flyDirect(city)];
    const dates = { depart: "2026-12-06", ret: "2026-12-14", moves: { "1>2": "2026-12-08", "2>3": "2026-12-10" } };
    expect(tripLegs(route, dates, new Set()).map((l) => `${l.from}>${l.to}`)).toEqual(["TLV>LON", "LON>DUS", "DUS>MAN", "MAN>TLV"]);
    const last = stays(route, dates)[2];
    expect(last.point.name).toBe("מנצ'סטר");
    expect(moves(route).map((m) => m.key)).toEqual(["1>2", "2>3"]);
  });

  it("applyDirect refuses what the route does not allow", () => {
    expect(applyDirect([dylan, city, londonAfter], [3])).toBeNull();
    expect(applyDirect([dylan, city], [3])?.[1].location.city_iata).toBe("MAN");
    expect(applyDirect([dylan, dortmund], [2])).toBeNull();
    expect(applyDirect([dylan, dortmund, city], [])).toEqual([dylan, dortmund, city]);
    expect(applyDirect([dylan, dortmund, city], [3])?.[2].location.city_iata).toBe("MAN");
  });

  it("a fresher row handed back already flown keeps the places of the row as sold", () => {
    const flown = { ...flyDirect(city), tickets_and_rates: [{ id: "t" }] } as unknown as Event;
    const origin = directOrigin(city, flown);
    expect(origin.event_location?.name).toBe("מנצ'סטר");
    expect(origin.location.city_iata).toBe("LON");
    expect(origin.tickets_and_rates).toEqual([{ id: "t" }]);
    // A flown Liverpool match keeps its own city - the row is still known as flown.
    const flownLiverpool = directOrigin(liverpool, flyDirect(liverpool));
    expect(flownLiverpool.location.city_iata).toBe("LON");
  });
});

describe("the reducer's setDirect", () => {
  const base: ItineraryState = {
    ...INITIAL_ITINERARY_STATE,
    step: "tickets",
    route: [dylan, dortmund, city],
    dates: { depart: "2026-12-06", ret: "2026-12-14", moves: { "1>2": "2026-12-08", "2>3": "2026-12-10" } },
    tickets: { 3: { id: "t" } as never },
    flightParts: { main: { id: "f" } as never },
    activeFlightPart: 1,
  };

  it("turns it on: travel is searched again, the tickets and the view stay", () => {
    const on = itineraryReducer(base, { type: "setDirect", id: 3, on: true });
    expect(on.route[2].location.city_iata).toBe("MAN");
    expect(on.directEvents[3]).toBe(city);
    expect(on.flightParts).toEqual({});
    expect(on.tickets[3]).toEqual({ id: "t" });
    expect(on.step).toBe("tickets");
    expect(on.activeFlightPart).toBe(1);
  });

  it("turns it off: the row as sold comes back", () => {
    const off = itineraryReducer(itineraryReducer(base, { type: "setDirect", id: 3, on: true }), { type: "setDirect", id: 3, on: false });
    expect(off.route[2]).toBe(city);
    expect(off.directEvents).toEqual({});
  });

  it("does nothing where it is not allowed", () => {
    const close = { ...base, route: [dylan, city, londonAfter], dates: { depart: "2026-12-06", ret: "2026-12-16", moves: {} } };
    expect(itineraryReducer(close, { type: "setDirect", id: 3, on: true })).toBe(close);
  });

  it("stays flown over a fresher row, and a change of route undoes it", () => {
    const on = itineraryReducer(base, { type: "setDirect", id: 3, on: true });
    const fresh = itineraryReducer(on, { type: "setEventData", event: { ...city, description: "new" } });
    expect(fresh.route[2].location.city_iata).toBe("MAN");
    expect(fresh.directEvents[3].description).toBe("new");
    const removed = itineraryReducer(on, { type: "removeEvent", id: 1 });
    expect(removed.directEvents).toEqual({});
    expect(removed.route.find((e) => e.id === 3)?.location.city_iata).toBe("LON");
  });
});
