import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import {
  dayDiff,
  eventDay,
  eventKind,
  eventPoint,
  haversineKm,
  sameCity,
  stayPoint,
} from "../itinerary/geo";
import { isItineraryEligible } from "../itinerary/eligibility";

const PARIS = { latitude: 48.86, longitude: 2.35 };
const LONDON = { latitude: 51.5, longitude: -0.13 };
const MADRID = { latitude: 40.42, longitude: -3.7 };
const MANCHESTER = { latitude: 53.48, longitude: -2.24 };

const TICKET = {
  id: "t1",
  category: "A",
  price: 100,
  available: true,
  description: "",
  colorOnTheMap: "",
};

const place = (name: string, p: { latitude: number; longitude: number }, cc = "GB") => ({
  name,
  ...p,
  city_iata: "XXX",
  country_code: cc,
});

/** A package event happening `days` from `today`, with an available ticket. */
const ev = (over: Record<string, unknown> = {}) =>
  ({
    id: 1,
    type: "sports_event",
    date: "2026-11-20T19:00:00",
    location: place("London, UK", LONDON),
    tickets_and_rates: [TICKET],
    ...over,
  }) as unknown as Event;

describe("haversineKm", () => {
  it("Paris to London is about 343 km", () => {
    const km = haversineKm(PARIS, LONDON);
    expect(Number.isInteger(km)).toBe(true);
    expect(Math.abs(km - 343)).toBeLessThanOrEqual(2);
  });

  it("Paris to Madrid is over 1000 km", () => {
    expect(haversineKm(PARIS, MADRID)).toBeGreaterThan(1000);
  });

  it("is zero for the same point and symmetric", () => {
    expect(haversineKm(PARIS, PARIS)).toBe(0);
    expect(haversineKm(PARIS, LONDON)).toBe(haversineKm(LONDON, PARIS));
  });
});

describe("eventPoint", () => {
  it("prefers event_location over location", () => {
    const e = ev({ event_location: place("Manchester, UK", MANCHESTER) });
    expect(eventPoint(e)).toBe(e.event_location);
  });

  it("falls back to location without an event city", () => {
    const e = ev();
    expect(eventPoint(e)).toBe(e.location);
    const n = ev({ event_location: null });
    expect(eventPoint(n)).toBe(n.location);
  });
});

describe("stayPoint", () => {
  it("is the flight city when the event has no second city", () => {
    const e = ev();
    const s = stayPoint(e);
    expect(s.city).toBe("flight");
    expect(s.point).toBe(e.location);
  });

  it("is the event city when the lodging default says so", () => {
    const e = ev({
      event_location: place("Manchester, UK", MANCHESTER),
      lodging_mode: "event_city_only",
    });
    const s = stayPoint(e);
    expect(s.city).toBe("event");
    expect(s.point.latitude).toBe(MANCHESTER.latitude);
  });
});

describe("sameCity", () => {
  it("is true for two London stay points 5 km apart", () => {
    const a = ev({ location: place("London, UK", LONDON) });
    // ~0.045 degrees of latitude is ~5 km
    const b = ev({
      id: 2,
      location: place("London, UK", { latitude: 51.545, longitude: -0.13 }),
    });
    const km = haversineKm(stayPoint(a).point, stayPoint(b).point);
    expect(km).toBeGreaterThanOrEqual(4);
    expect(km).toBeLessThanOrEqual(6);
    expect(sameCity(a, b)).toBe(true);
  });

  it("is false for London and Manchester", () => {
    const a = ev({ location: place("London, UK", LONDON) });
    const b = ev({ id: 2, location: place("Manchester, UK", MANCHESTER) });
    expect(sameCity(a, b)).toBe(false);
  });

  it("uses the stay point, not the flight city", () => {
    // Two shows in Manchester, one flies to London and stays in Manchester.
    const a = ev({
      location: place("London, UK", LONDON),
      event_location: place("Manchester, UK", MANCHESTER),
      lodging_mode: "event_city_only",
    });
    const b = ev({ id: 2, location: place("Manchester, UK", MANCHESTER) });
    expect(sameCity(a, b)).toBe(true);
  });
});

describe("eventDay and dayDiff", () => {
  it("eventDay takes the first ten characters", () => {
    expect(eventDay(ev({ date: "2026-11-20T19:00:00" }))).toBe("2026-11-20");
    expect(eventDay(ev({ date: "2026-11-20" }))).toBe("2026-11-20");
  });

  it("dayDiff is b minus a in whole days", () => {
    expect(dayDiff("2026-11-20", "2026-11-23")).toBe(3);
    expect(dayDiff("2026-11-23", "2026-11-20")).toBe(-3);
    expect(dayDiff("2026-11-20", "2026-11-20")).toBe(0);
  });

  it("dayDiff is whole days across a DST change and month ends", () => {
    expect(dayDiff("2026-10-24", "2026-10-26")).toBe(2);
    expect(dayDiff("2027-03-27", "2027-03-29")).toBe(2);
    expect(dayDiff("2026-11-28", "2026-12-02")).toBe(4);
    expect(dayDiff("2026-12-30", "2027-01-02")).toBe(3);
  });
});

describe("eventKind", () => {
  it("is music when the type contains music", () => {
    expect(eventKind(ev({ type: "music_event" }))).toBe("music");
    expect(eventKind(ev({ type: "music_live_event_dynamic" }))).toBe("music");
  });

  it("is football otherwise", () => {
    expect(eventKind(ev({ type: "sports_event" }))).toBe("football");
    expect(eventKind(ev({ type: "tx_event" }))).toBe("football");
  });
});

describe("isItineraryEligible", () => {
  const today = "2026-10-21";

  it("is true for a package event today + 30", () => {
    expect(isItineraryEligible(ev({ date: "2026-11-20T19:00:00" }), today)).toBe(true);
  });

  it("is true on the edge, today + 3", () => {
    expect(isItineraryEligible(ev({ date: "2026-10-24T19:00:00" }), today)).toBe(true);
  });

  it("is false for a ticket-only event", () => {
    expect(isItineraryEligible(ev({ package_mode: "ticket_only" }), today)).toBe(false);
  });

  it("is false for a US event", () => {
    const us = ev({ location: place("New York, USA", { latitude: 40.7, longitude: -74 }, "US") });
    expect(isItineraryEligible(us, today)).toBe(false);
  });

  it("is false when the event has no available ticket", () => {
    expect(isItineraryEligible(ev({ tickets_and_rates: [] }), today)).toBe(false);
    expect(
      isItineraryEligible(ev({ tickets_and_rates: [{ ...TICKET, available: false }] }), today),
    ).toBe(false);
  });

  it("is false when sold out by tag or locked flight", () => {
    expect(isItineraryEligible(ev({ tags: "Sold" }), today)).toBe(false);
    expect(isItineraryEligible(ev({ locked_flight_sold_out: true }), today)).toBe(false);
  });

  it("is false for an event today + 2", () => {
    expect(isItineraryEligible(ev({ date: "2026-10-23T19:00:00" }), today)).toBe(false);
  });

  it("is false for a past event", () => {
    expect(isItineraryEligible(ev({ date: "2026-10-01T19:00:00" }), today)).toBe(false);
  });
});
