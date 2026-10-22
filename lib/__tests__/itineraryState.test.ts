import { describe, expect, it } from "vitest";
import type { Event, ItineraryFlight, OrderHotel, OrderTicket } from "../app.types";
import { DEFAULT_ITINERARY_SETTINGS as S } from "../itinerary/settings";
import {
  INITIAL_ITINERARY_STATE,
  MAX_TRAVELLERS,
  fitRoute,
  itineraryReducer as reduce,
  type ItineraryAction,
  type ItineraryState,
} from "../itinerary/state";

type City = { latitude: number; longitude: number; name: string; city_iata: string };

const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז, צרפת", city_iata: "PAR" };
const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון, בריטניה", city_iata: "LON" };
const AMSTERDAM: City = { latitude: 52.37, longitude: 4.9, name: "אמסטרדם, הולנד", city_iata: "AMS" };
const MADRID: City = { latitude: 40.42, longitude: -3.7, name: "מדריד, ספרד", city_iata: "MAD" };

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
const gracie = ev(896, "גרייסי אברמס", "2027-05-10", AMSTERDAM);
const arsenal = ev(656, "ארסנל - נוטינגהאם", "2027-05-15", LONDON, "sports_event");
const madrid = ev(717, "ריאל - ברסה", "2027-05-13", MADRID, "sports_event");

const ticket = (id: string) => ({ id, quantity: 2 }) as unknown as OrderTicket;
const flight = { id: "f1" } as unknown as ItineraryFlight;
const hotel = { id: "h1" } as unknown as OrderHotel;

const run = (state: ItineraryState, ...actions: ItineraryAction[]) => actions.reduce(reduce, state);
const add = (event: Event): ItineraryAction => ({ type: "addEvent", event, settings: S });

/** Paris -> London, with a flight and both hotels picked. */
const parisLondon = () =>
  run(
    INITIAL_ITINERARY_STATE,
    add(chelsea),
    add(celine),
    { type: "setTicket", eventId: 618, ticket: ticket("t618") },
    { type: "setTicket", eventId: 702, ticket: ticket("t702") },
    { type: "setFlight", flight },
    { type: "setHotel", stayKey: "618", hotel },
    { type: "setHotel", stayKey: "702", hotel },
  );

describe("initial state", () => {
  it("is an empty self-build on the build step for two travellers", () => {
    expect(INITIAL_ITINERARY_STATE).toMatchObject({
      step: "build",
      mode: "custom",
      route: [],
      pax: 2,
      flight: null,
      hotels: {},
      tickets: {},
      train: [],
    });
  });
});

describe("addEvent", () => {
  it("keeps the route in date order with default dates", () => {
    const s = run(INITIAL_ITINERARY_STATE, add(chelsea), add(celine));
    expect(s.route.map((e) => e.id)).toEqual([618, 702]);
    expect(s.dates).toEqual({ depart: "2027-05-11", ret: "2027-05-16", moves: { "618>702": "2027-05-13" } });
  });

  it("clears the flight and the hotels, keeps the tickets", () => {
    const s = reduce(parisLondon(), add(gracie));
    expect(s.flight).toBeNull();
    expect(s.hotels).toEqual({});
    expect(s.tickets[618]).toEqual(ticket("t618"));
  });

  it("refuses an event that cannot join (same day) and a duplicate - the state is untouched", () => {
    const s = parisLondon();
    expect(reduce(s, add(arsenal))).toBe(s);
    expect(reduce(s, add(celine))).toBe(s);
  });

  it("keeps a departure the customer moved while the first event stays first", () => {
    const s = run(
      INITIAL_ITINERARY_STATE,
      add(celine),
      { type: "setDates", dates: { depart: "2027-05-09", ret: "2027-05-13", moves: {} } },
      add(chelsea),
    );
    expect(s.dates.depart).toBe("2027-05-09");
    // A new last event: the return takes its default.
    expect(s.dates.ret).toBe("2027-05-16");
  });

  it("an earlier first event resets the departure to its default", () => {
    const s = run(
      INITIAL_ITINERARY_STATE,
      add(celine),
      { type: "setDates", dates: { depart: "2027-05-12", ret: "2027-05-13", moves: {} } },
      add(gracie),
    );
    expect(s.dates.depart).toBe("2027-05-09");
  });
});

describe("removeEvent", () => {
  it("drops the event's ticket, clamps the dates and clears flight + hotels", () => {
    const s = reduce(parisLondon(), { type: "removeEvent", id: 702 });
    expect(s.route.map((e) => e.id)).toEqual([618]);
    expect(s.tickets).toEqual({ 618: ticket("t618") });
    expect(s.dates).toEqual({ depart: "2027-05-11", ret: "2027-05-13", moves: {} });
    expect(s.flight).toBeNull();
    expect(s.hotels).toEqual({});
  });

  it("drops the train toggle of a move that is gone", () => {
    const s = run(parisLondon(), { type: "toggleTrain", key: "618>702" }, { type: "removeEvent", id: 702 });
    expect(s.train).toEqual([]);
  });

  it("walks back to the build step below two events", () => {
    const s = run(parisLondon(), { type: "goStep", step: "flights" }, { type: "removeEvent", id: 618 });
    expect(s.step).toBe("build");
  });

  it("an empty route has no dates", () => {
    const s = run(parisLondon(), { type: "removeEvent", id: 618 }, { type: "removeEvent", id: 702 });
    expect(s.route).toEqual([]);
    expect(s.dates).toEqual({ depart: "", ret: "", moves: {} });
  });
});

describe("setDates", () => {
  it("clamps every date into its range and clears flight + hotels", () => {
    const s = reduce(parisLondon(), {
      type: "setDates",
      dates: { depart: "2027-05-01", ret: "2027-06-01", moves: { "618>702": "2027-05-20" } },
    });
    expect(s.dates).toEqual({ depart: "2027-05-09", ret: "2027-05-18", moves: { "618>702": "2027-05-15" } });
    expect(s.flight).toBeNull();
    expect(s.hotels).toEqual({});
  });

  it("is a no-op when nothing moves", () => {
    const s = parisLondon();
    expect(reduce(s, { type: "setDates", dates: { ...s.dates } })).toBe(s);
  });

  it("is a no-op on an empty route", () => {
    expect(
      reduce(INITIAL_ITINERARY_STATE, { type: "setDates", dates: { depart: "2027-05-01", ret: "2027-05-02", moves: {} } }),
    ).toBe(INITIAL_ITINERARY_STATE);
  });
});

describe("setPax", () => {
  it("clamps to 1..9 and clears flight + hotels", () => {
    expect(reduce(parisLondon(), { type: "setPax", pax: 12 })).toMatchObject({ pax: MAX_TRAVELLERS, flight: null, hotels: {} });
    expect(reduce(parisLondon(), { type: "setPax", pax: 0 }).pax).toBe(1);
  });

  it("ignores the same count and a non-number", () => {
    const s = parisLondon();
    expect(reduce(s, { type: "setPax", pax: 2 })).toBe(s);
    expect(reduce(s, { type: "setPax", pax: Number.NaN })).toBe(s);
  });
});

describe("toggleTrain", () => {
  it("toggles a move of the route and clears flight + hotels", () => {
    const on = reduce(parisLondon(), { type: "toggleTrain", key: "618>702" });
    expect(on.train).toEqual(["618>702"]);
    expect(on.flight).toBeNull();
    expect(on.hotels).toEqual({});
    expect(reduce(on, { type: "toggleTrain", key: "618>702" }).train).toEqual([]);
  });

  it("ignores a key that is not a move of the route", () => {
    const s = parisLondon();
    expect(reduce(s, { type: "toggleTrain", key: "1>2" })).toBe(s);
  });
});

describe("clearTravel", () => {
  it("drops the flight and every hotel, keeps the trip and its tickets", () => {
    const s = parisLondon();
    const out = reduce(s, { type: "clearTravel" });
    expect(out.flight).toBeNull();
    expect(Object.keys(out.hotels)).toEqual([]);
    expect(out.route).toBe(s.route);
    expect(out.tickets).toBe(s.tickets);
    expect(out.pax).toBe(s.pax);
    expect(out.dates).toBe(s.dates);
  });

  it("leaves no empty hotel entry behind", () => {
    const half = reduce(parisLondon(), { type: "setHotel", stayKey: "618", hotel: undefined });
    expect(Object.keys(reduce(half, { type: "clearTravel" }).hotels)).toEqual([]);
  });

  it("changes nothing when there is nothing to clear", () => {
    const s = reduce(parisLondon(), { type: "clearTravel" });
    expect(reduce(s, { type: "clearTravel" })).toBe(s);
  });
});

describe("tickets, flight, hotels, steps", () => {
  it("a ticket for an event outside the route is ignored", () => {
    const s = parisLondon();
    expect(reduce(s, { type: "setTicket", eventId: 1, ticket: ticket("x") })).toBe(s);
  });

  it("a hotel for a stay the trip does not have is ignored", () => {
    const s = parisLondon();
    expect(reduce(s, { type: "setHotel", stayKey: "999", hotel })).toBe(s);
  });

  it("the flow leaves the build step only with two events or more", () => {
    const one = reduce(INITIAL_ITINERARY_STATE, add(celine));
    expect(reduce(one, { type: "goStep", step: "tickets" })).toBe(one);
    expect(reduce(parisLondon(), { type: "goStep", step: "tickets" }).step).toBe("tickets");
  });

  it("active tabs stay inside the route and its stays", () => {
    const s = parisLondon();
    expect(reduce(s, { type: "setActiveEvent", index: 5 }).activeEvent).toBe(1);
    expect(reduce(s, { type: "setActiveStay", index: -3 }).activeStay).toBe(0);
  });

  it("leaving the hotels step opens it on its first city next time", () => {
    const atHotels = run(parisLondon(), { type: "goStep", step: "hotels" }, { type: "setActiveStay", index: 1 });
    expect(atHotels.activeStay).toBe(1);
    expect(reduce(atHotels, { type: "goStep", step: "summary" }).activeStay).toBe(0);
    expect(reduce(atHotels, { type: "goStep", step: "flights" }).activeStay).toBe(0);
    // The summary's "שינוי המלון ב..." still opens the step on its city.
    const summary = reduce(atHotels, { type: "goStep", step: "summary" });
    const back = run(summary, { type: "setActiveStay", index: 1 }, { type: "goStep", step: "hotels" });
    expect(back.step).toBe("hotels");
    expect(back.activeStay).toBe(1);
  });

  it("fresh event data keeps the picks when the event did not move", () => {
    const s = parisLondon();
    const fresh = { ...celine, tickets_and_rates: [] } as unknown as Event;
    const next = reduce(s, { type: "setEventData", event: fresh });
    expect(next.route[0]).toBe(fresh);
    expect(next.flight).toBe(flight);
    expect(next.hotels).toEqual(s.hotels);
  });

  it("fresh event data that moves the stay (coordinates only) re-fits the trip", () => {
    // Same day, same flight city, same place name - but the venue is now in Paris: no move left.
    const moved = { ...chelsea, location: { ...chelsea.location, latitude: 48.86, longitude: 2.35 } } as unknown as Event;
    const next = reduce(parisLondon(), { type: "setEventData", event: moved });
    expect(next.dates.moves).toEqual({});
    expect(next.flight).toBeNull();
    expect(next.hotels).toEqual({});
    expect(next.tickets[702]).toEqual(ticket("t702"));
  });

  it("fresh event data on another day re-fits the dates and clears flight + hotels", () => {
    const moved = { ...celine, date: "2027-05-11T20:00:00" } as unknown as Event;
    const next = reduce(parisLondon(), { type: "setEventData", event: moved });
    expect(next.dates.depart).toBe("2027-05-10");
    expect(next.flight).toBeNull();
  });
});

describe("load", () => {
  it("opens a route from the URL with default dates", () => {
    const s = reduce(INITIAL_ITINERARY_STATE, { type: "load", route: [chelsea, celine], mode: "route" });
    expect(s.mode).toBe("route");
    expect(s.route.map((e) => e.id)).toEqual([618, 702]);
    expect(s.dates.depart).toBe("2027-05-11");
  });

  it("load in route mode with two events opens the tickets of event 1", () => {
    const s = reduce(INITIAL_ITINERARY_STATE, { type: "load", route: [chelsea, celine], mode: "route" });
    expect(s.step).toBe("tickets");
    expect(s.activeEvent).toBe(0);
  });

  it("load in custom mode stays on build", () => {
    const s = reduce(INITIAL_ITINERARY_STATE, { type: "load", route: [chelsea, celine], mode: "custom" });
    expect(s.mode).toBe("custom");
    expect(s.step).toBe("build");
    expect(s.route.map((e) => e.id)).toEqual([618, 702]);
  });

  it("load in route mode with one event stays on build", () => {
    const s = reduce(INITIAL_ITINERARY_STATE, { type: "load", route: [celine], mode: "route" });
    expect(s.step).toBe("build");
    expect(s.route.map((e) => e.id)).toEqual([618]);
  });

  it("a load over a trip already in the flow starts its tickets again from event 1", () => {
    const deep = reduce(parisLondon(), { type: "goStep", step: "hotels" });
    const s = reduce(deep, { type: "load", route: [chelsea, celine], mode: "custom" });
    expect(s.step).toBe("build");
    const r = reduce({ ...deep, activeEvent: 1 }, { type: "load", route: [chelsea, celine], mode: "route" });
    expect(r.step).toBe("tickets");
    expect(r.activeEvent).toBe(0);
  });
});

describe("fitRoute", () => {
  it("adds the events in date order and refuses the ones that cannot join", () => {
    const { route, refused } = fitRoute([chelsea, arsenal, celine], S);
    expect(route.map((e) => e.id)).toEqual([618, 656]);
    expect(refused.map((r) => r.event.id)).toEqual([702]);
    expect(refused[0].compat.reason.code).toBe("same_day");
  });

  it("refuses a pair too far apart", () => {
    const { route, refused } = fitRoute([gracie, madrid], S);
    expect(route.map((e) => e.id)).toEqual([896]);
    expect(refused[0].compat.reason.code).toBe("too_far");
  });
});

describe("setFlight keeps only the hotels still on their stay's nights", () => {
  // Paris -> London: depart 11/05, move 13/05, return 16/05.
  const seg = (departureTime: string, arrivalTime: string) => ({
    departureTime,
    arrivalTime,
    departureAirport: "AAA",
    arrivalAirport: "BBB",
    stops: [],
    duration: "PT2H",
    checkBagsIncluded: true,
    cabinBagsIncluded: true,
  });
  const offer = (id: string, outLands: string) => {
    const legs = [
      seg("2027-05-11T01:00:00", outLands),
      seg("2027-05-13T13:05:00", "2027-05-13T13:25:00"),
      seg("2027-05-16T22:40:00", "2027-05-17T05:20:00"),
    ];
    return { id, outbound: legs[0], inbound: legs[2], legs, trainLegs: [] } as unknown as ItineraryFlight;
  };
  const guests = [{ adults: 2, children: [] }];
  const paris = { id: "p", checkin: "2027-05-11", checkout: "2027-05-13", guests } as unknown as OrderHotel;
  const london = { id: "l", checkin: "2027-05-13", checkout: "2027-05-16", guests } as unknown as OrderHotel;
  const picked = () =>
    run(
      parisLondon(),
      { type: "setFlight", flight: offer("f2", "2027-05-11T09:55:00") },
      { type: "setHotel", stayKey: "618", hotel: paris },
      { type: "setHotel", stayKey: "702", hotel: london },
    );

  it("another offer on the same nights keeps both hotels", () => {
    const s = picked();
    const out = reduce(s, { type: "setFlight", flight: offer("f3", "2027-05-11T11:00:00") });
    expect(out.flight?.id).toBe("f3");
    expect(out.hotels).toBe(s.hotels);
  });

  it("an offer landing at 06:30 moves Paris' check-in to the 10th: Paris' hotel goes, London's stays", () => {
    const out = reduce(picked(), { type: "setFlight", flight: offer("f4", "2027-05-11T06:30:00") });
    expect(out.hotels).toEqual({ "702": london });
  });

  it("no flight (a new search answer) keeps the hotels: no dates to judge them by", () => {
    const s = picked();
    const out = reduce(s, { type: "setFlight", flight: null });
    expect(out.flight).toBeNull();
    expect(out.hotels).toBe(s.hotels);
  });
});
