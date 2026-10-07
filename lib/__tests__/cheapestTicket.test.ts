import { describe, expect, it } from "vitest";
import {
  cheapestAvailableTicketPrice,
  computePackagePrice,
} from "@/lib/events/price";
import type { Event, EventTicket } from "@/lib/app.types";

const ticket = (id: string, price: number, available?: boolean): EventTicket => ({
  id,
  category: id,
  price,
  description: "",
  colorOnTheMap: "#000",
  ...(available === undefined ? {} : { available }),
});

const event = (tickets: EventTicket[], overrides: Partial<Event> = {}): Event =>
  ({
    id: 1,
    name: "Test",
    name_english: "Test",
    date: "2027-01-15",
    type: "tx_event",
    base_flight_price: 500,
    base_hotel_price: 300,
    tickets_and_rates: tickets,
    ...overrides,
  }) as Event;

/** One ticket's price rewritten - what a live price sync does to the stored tickets. */
const reprice = (tickets: EventTicket[], id: string, price: number) =>
  tickets.map((t) => (t.id === id ? { ...t, price } : t));

const moved = (before: EventTicket[], after: EventTicket[]) =>
  cheapestAvailableTicketPrice(before) !== cheapestAvailableTicketPrice(after);

describe("cheapestAvailableTicketPrice", () => {
  it("is the cheapest ticket still on sale", () => {
    expect(
      cheapestAvailableTicketPrice([ticket("a", 512), ticket("b", 329), ticket("c", 575)]),
    ).toBe(329);
  });

  it("skips a ticket taken off sale, and counts one that never said", () => {
    expect(
      cheapestAvailableTicketPrice([
        ticket("off", 100, false),
        ticket("on", 400, true),
        ticket("unsaid", 350),
      ]),
    ).toBe(350);
  });

  it("has no price when nothing is on sale", () => {
    expect(cheapestAvailableTicketPrice([])).toBeNull();
    expect(cheapestAvailableTicketPrice(null)).toBeNull();
    expect(cheapestAvailableTicketPrice(undefined)).toBeNull();
    expect(cheapestAvailableTicketPrice([ticket("off", 100, false)])).toBeNull();
  });
});

describe("a live price sync and the price a card shows", () => {
  const stored = [ticket("a", 512), ticket("b", 329), ticket("c", 575)];

  it("a dearer ticket changing price leaves the card where it was", () => {
    const after = reprice(reprice(stored, "a", 530), "c", 596);
    expect(moved(stored, after)).toBe(false);
    expect(computePackagePrice(event(after))).toBe(computePackagePrice(event(stored)));
  });

  it("the cheapest ticket changing price moves the card by the same amount", () => {
    const after = reprice(stored, "b", 338);
    expect(moved(stored, after)).toBe(true);
    expect(computePackagePrice(event(after))! - computePackagePrice(event(stored))!).toBe(9);
  });

  it("another ticket dropping under the cheapest moves the card", () => {
    const after = reprice(stored, "a", 300);
    expect(moved(stored, after)).toBe(true);
    expect(computePackagePrice(event(after))! - computePackagePrice(event(stored))!).toBe(-29);
  });

  it("the cheapest ticket rising past the next one moves the card to the next one", () => {
    const after = reprice(stored, "b", 600);
    expect(moved(stored, after)).toBe(true);
    expect(computePackagePrice(event(after))! - computePackagePrice(event(stored))!).toBe(512 - 329);
  });

  it("a ticket that is off sale never moves the card, however cheap it gets", () => {
    const withOff = [...stored, ticket("off", 900, false)];
    const after = reprice(withOff, "off", 50);
    expect(moved(withOff, after)).toBe(false);
    expect(computePackagePrice(event(after))).toBe(computePackagePrice(event(withOff)));
  });

  it("says the same as the card on a ticket-only event", () => {
    const ticketOnly = { package_mode: "ticket_only", ticket_only_markup: 200 } as Partial<Event>;
    const dearer = reprice(stored, "c", 596);
    const cheapest = reprice(stored, "b", 338);
    expect(moved(stored, dearer)).toBe(false);
    expect(computePackagePrice(event(dearer, ticketOnly))).toBe(
      computePackagePrice(event(stored, ticketOnly)),
    );
    expect(moved(stored, cheapest)).toBe(true);
    expect(
      computePackagePrice(event(cheapest, ticketOnly))! -
        computePackagePrice(event(stored, ticketOnly))!,
    ).toBe(9);
  });

  it("whenever the card's price differs, the cheapest ticket differs", () => {
    // Every single-ticket rewrite over a spread of prices: the card may only move when
    // the helper says so - a miss here would leave a stale price on the listings.
    for (const id of ["a", "b", "c"]) {
      for (const price of [1, 200, 328, 329, 330, 511, 512, 513, 575, 800]) {
        const after = reprice(stored, id, price);
        const cardMoved =
          computePackagePrice(event(after)) !== computePackagePrice(event(stored));
        expect(moved(stored, after)).toBe(cardMoved);
      }
    }
  });
});
