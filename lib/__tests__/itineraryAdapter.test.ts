import { describe, expect, it } from "vitest";
import type { Event, OrderTicket } from "../app.types";
import { parseItinerarySettings } from "../itinerary/settings";
import {
  MAX_TRIP_LOAD,
  allTicketsReady,
  asFullRow,
  categorySwapNotice,
  forgetFullRow,
  goneIds,
  isFullRow,
  pickTripEvents,
  ticketAdapterFields,
  ticketFromStep,
  ticketReady,
  tripEventIds,
} from "../itinerary/adapter";

const TODAY = "2026-10-21";

const TICKET = { id: "t1", category: "A", price: 100, available: true, description: "", colorOnTheMap: "" };

const ev = (id: number, over: Record<string, unknown> = {}) =>
  ({
    id,
    name: `event ${id}`,
    type: "music_event",
    date: "2026-11-20T19:00:00",
    location: { name: "פריז, צרפת", latitude: 48.86, longitude: 2.35, city_iata: "PAR", country_code: "FR" },
    tickets_and_rates: [TICKET],
    ...over,
  }) as unknown as Event;

const ticket = (id: string, quantity: number) =>
  ({ id, category: "A", price: 100, description: "", vendor: "", quantity }) as unknown as OrderTicket;

describe("ticketAdapterFields", () => {
  it("hands the live ticket step a plain visit sized for the trip", () => {
    const event = ev(1);
    const f = ticketAdapterFields({ event, ticket: undefined, pax: 3 });
    expect(f.numberOfEventTickets).toBe(3);
    expect(f.returnToSummary).toBe(false);
    expect(f.readyPackage).toBeUndefined();
    expect(f.personLink).toBeUndefined();
    expect(f.orderResume).toBeUndefined();
    expect(f.eventTicket).toBeUndefined();
    expect(f.event).toBe(event);
  });

  it("passes the event's ticket through", () => {
    const t = ticket("t1", 2);
    expect(ticketAdapterFields({ event: ev(1), ticket: t, pax: 2 }).eventTicket).toBe(t);
  });

  it("re-opens a tab on the ticket it held (the step's own resume), not on the cheapest", () => {
    const f = ticketAdapterFields({ event: ev(1), ticket: ticket("t2", 2), pax: 2, held: "t2" });
    expect(f.orderResume).toEqual({ step: 1, ticketId: "t2" });
  });

  it("an empty held id resumes nothing", () => {
    expect(ticketAdapterFields({ event: ev(1), ticket: undefined, pax: 2, held: "" }).orderResume).toBeUndefined();
  });
});

describe("ticketFromStep", () => {
  it("drops the blank ticket the step writes when nothing sells", () => {
    expect(ticketFromStep(ticket("", 0))).toBeUndefined();
    expect(ticketFromStep(undefined)).toBeUndefined();
  });

  it("keeps a real pick as it is", () => {
    const t = ticket("t1", 2);
    expect(ticketFromStep(t)).toBe(t);
  });
});

describe("ticketReady / allTicketsReady", () => {
  it("a ticket is ready only for the trip's party size", () => {
    expect(ticketReady(ticket("t1", 2), 2)).toBe(true);
    expect(ticketReady(ticket("t1", 2), 3)).toBe(false);
    expect(ticketReady(ticket("", 2), 2)).toBe(false);
    expect(ticketReady(undefined, 2)).toBe(false);
  });

  it("every event of the route needs one", () => {
    const route = [ev(1), ev(2)];
    expect(allTicketsReady(route, { 1: ticket("a", 2), 2: ticket("b", 2) }, 2)).toBe(true);
    expect(allTicketsReady(route, { 1: ticket("a", 2) }, 2)).toBe(false);
    expect(allTicketsReady(route, { 1: ticket("a", 2), 2: ticket("b", 3) }, 2)).toBe(false);
  });

  it("an empty route is never ready", () => {
    expect(allTicketsReady([], {}, 2)).toBe(false);
  });
});

describe("tripEventIds", () => {
  it("keeps whole positive ids, once each, at most three", () => {
    expect(tripEventIds([5, 5, 7, 1.5, -2, 0, 9, 11])).toEqual([5, 7, 9]);
    expect(MAX_TRIP_LOAD).toBe(3);
  });

  it("anything else is no ids", () => {
    expect(tripEventIds("5,7")).toEqual([]);
    expect(tripEventIds(null)).toEqual([]);
    expect(tripEventIds([Number.NaN, "8", Infinity])).toEqual([]);
  });
});

describe("MAX_TRIP_LOAD", () => {
  it("is never below what staff may set as a trip's size (the action never cuts a route short)", () => {
    for (let n = 1; n <= 9; n++) {
      expect(parseItinerarySettings([{ key: "max_events", value: n }]).maxEvents).toBeLessThanOrEqual(MAX_TRIP_LOAD);
    }
  });
});

describe("goneIds", () => {
  it("an asked id the answer lacks is gone", () => {
    expect(goneIds([1, 2, 3], [ev(1), ev(3)], [1, 2, 3])).toEqual([2]);
  });

  it("not when the customer already took it out of the route meanwhile", () => {
    expect(goneIds([1, 2], [ev(1)], [1])).toEqual([]);
  });

  it("only what was asked - an id never asked is never gone", () => {
    expect(goneIds([1], [ev(1)], [1, 2, 3])).toEqual([]);
  });
});

describe("categorySwapNotice", () => {
  const held = { ...ticket("kat1", 2), category: "Kat. 1" } as OrderTicket;

  it("says so when the step put another category in place of the one the tab held", () => {
    expect(categorySwapNotice(held, "kat2", 3)).toBe(
      "הקטגוריה שבחרתם (Kat. 1) לא זמינה ל-3 כרטיסים - בחרנו את הזולה ביותר שזמינה. אפשר להחליף.",
    );
  });

  it("names the zone when the ticket has one, and a single ticket in words", () => {
    const zoned = { ...held, zoneLabel: "יציע מזרח" } as OrderTicket;
    expect(categorySwapNotice(zoned, "kat2", 1)).toBe(
      "הקטגוריה שבחרתם (יציע מזרח) לא זמינה לכרטיס אחד - בחרנו את הזולה ביותר שזמינה. אפשר להחליף.",
    );
  });

  it("nothing when the same category came back, nothing was held, or nothing sells", () => {
    expect(categorySwapNotice(held, "kat1", 3)).toBeNull();
    expect(categorySwapNotice(undefined, "kat2", 3)).toBeNull();
    expect(categorySwapNotice(held, undefined, 3)).toBeNull();
  });
});

describe("pickTripEvents", () => {
  const catalog = [ev(1), ev(2), ev(3), ev(4, { tags: "Sold" }), ev(5, { date: "2026-10-22T19:00:00" })];

  it("returns the asked rows whole, in the order asked", () => {
    const out = pickTripEvents(catalog, [3, 1], TODAY);
    expect(out.map((e) => e.id)).toEqual([3, 1]);
    expect(out[0]).toBe(catalog[2]);
  });

  it("leaves out what a trip may not hold today and what is not in the catalog", () => {
    expect(pickTripEvents(catalog, [4, 5, 99, 2], TODAY).map((e) => e.id)).toEqual([2]);
  });

  it("leaves out US and ticket-only events", () => {
    const us = ev(6, {
      location: { name: "New York", latitude: 40.7, longitude: -74, city_iata: "NYC", country_code: "US" },
    });
    const ticketOnly = ev(7, { package_mode: "ticket_only" });
    expect(pickTripEvents([us, ticketOnly], [6, 7], TODAY)).toEqual([]);
  });

  it("m2 - leaves out events that are not listed (hidden until approved, QA, deactivated), whatever the catalog let through", () => {
    const rows = [ev(8, { is_hidden: true }), ev(9, { is_test: true }), ev(10, { deactivated_reason: "tx_no_category" }), ev(11)];
    expect(pickTripEvents(rows, [8, 9, 10, 11], TODAY).map((e) => e.id)).toEqual([11]);
  });
});

describe("asFullRow / isFullRow", () => {
  it("a catalog row is not full until the tickets step loaded it", () => {
    const slim = ev(1);
    expect(isFullRow(slim)).toBe(false);
    const full = asFullRow(slim);
    expect(isFullRow(full)).toBe(true);
    // A copy with the same fields; the row it was made from is left as it was.
    expect(full).not.toBe(slim);
    expect(Object.keys(full)).toEqual(Object.keys(slim));
    expect(full.tickets_and_rates).toBe(slim.tickets_and_rates);
    expect(isFullRow(slim)).toBe(false);
  });

  it("stays full through the ticket step's live price write ({ ...event, tickets_and_rates })", () => {
    const full = asFullRow(ev(1));
    expect(isFullRow({ ...full, tickets_and_rates: [] })).toBe(true);
  });

  it("is not carried by JSON (a stored draft re-loads its rows)", () => {
    expect(isFullRow(JSON.parse(JSON.stringify(asFullRow(ev(1)))))).toBe(false);
  });

  it("forgetFullRow: the same data without the mark, so the tickets step loads it again", () => {
    const full = asFullRow(ev(1));
    const again = forgetFullRow(full);
    expect(isFullRow(again)).toBe(false);
    expect(again).toEqual(ev(1));
    // The full row itself keeps its mark; a catalog row comes back as it is.
    expect(isFullRow(full)).toBe(true);
    const slim = ev(2);
    expect(forgetFullRow(slim)).toBe(slim);
  });
});
