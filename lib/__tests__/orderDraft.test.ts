import { describe, expect, it } from "vitest";
import {
  buildOrderDraft,
  buildOrderForm,
  fitPassengers,
  flightSearchDates,
  freshOrder,
  isBlankForm,
  isStale,
  ORDER_DRAFT_TTL_MS,
  ownedByLink,
  parseOrderDraft,
  parseOrderForm,
  resumeOrder,
  sameFlight,
  type OrderDraftState,
} from "../order/draft";
import type { Event, Flight, OrderHotel, OrderTicket } from "../app.types";

// Local-time ISO strings on purpose: the order compares local days, as the pickers do.
const NOW = new Date("2026-10-01T12:00:00").getTime();
const EVENT_ID = 717;

const event = (over: Partial<Event> = {}): Event =>
  ({
    id: EVENT_ID,
    name: "Liverpool - Chelsea",
    type: "tx_event",
    location: { name: "London", latitude: 51.5, longitude: -0.12, country_code: "GB" },
    event_location: null,
    skip_flight: false,
    package_mode: "package",
    tickets_and_rates: [
      { id: "t-cheap", category: "Upper", price: 200, description: "", colorOnTheMap: "" },
      { id: "t-main", category: "Main Stand", price: 320, description: "", colorOnTheMap: "" },
      { id: "t-gone", category: "Kop", price: 400, description: "", colorOnTheMap: "", available: false },
    ],
    ...over,
  }) as unknown as Event;

const ticket = (id = "t-main"): OrderTicket => ({
  id,
  category: "Main Stand",
  price: 320,
  description: "",
  quantity: 2,
});

const flight = (over: Partial<Flight> = {}): Flight =>
  ({
    id: "3",
    airline: "LY",
    price: 900,
    numOfTravelers: 2,
    outbound: {
      departureTime: "2026-10-29T06:10:00",
      arrivalTime: "2026-10-29T09:40:00",
      departureAirport: "TLV",
      arrivalAirport: "LHR",
      flightNumber: "LY315",
    },
    inbound: {
      departureTime: "2026-11-01T21:00:00",
      arrivalTime: "2026-11-02T04:10:00",
      departureAirport: "LHR",
      arrivalAirport: "TLV",
      flightNumber: "LY318",
    },
    ...over,
  }) as unknown as Flight;

const hotel = (over: Partial<OrderHotel> = {}): OrderHotel =>
  ({
    id: "h-1",
    name: "The Strand",
    price: "640",
    checkin: "2026-10-29",
    checkout: "2026-11-01",
    guests: [{ adults: 2, children: [] }],
    ...over,
  }) as unknown as OrderHotel;

const state = (over: Partial<OrderDraftState> = {}): OrderDraftState => ({
  step: 4,
  returnToSummary: false,
  numberOfEventTickets: 2,
  planeTickets: { adults: 2, children: 0 },
  currentMinTicketPrice: 200,
  eventTicket: ticket(),
  flight: flight(),
  flightSkipped: false,
  hotel: hotel(),
  skipHotel: false,
  skippedHotelPricePerGuest: null,
  lodgingCity: "flight",
  hotelSegments: null,
  splitNights: null,
  ...over,
});

const stored = (over: Partial<OrderDraftState> = {}, savedAt = NOW - 60_000) =>
  JSON.stringify(buildOrderDraft(EVENT_ID, state(over), savedAt));

const resumed = (over: Partial<OrderDraftState> = {}, ev: Event = event()) => {
  const draft = parseOrderDraft(stored(over), EVENT_ID, NOW);
  if (!draft) throw new Error("the fixture draft did not parse");
  return resumeOrder(draft, ev, NOW);
};

describe("parseOrderDraft - what counts as a draft", () => {
  it("reads back what was built", () => {
    const draft = parseOrderDraft(stored(), EVENT_ID, NOW);
    expect(draft?.step).toBe(4);
    expect(draft?.eventTicket?.id).toBe("t-main");
    expect(draft?.flight?.id).toBe("3");
    expect(draft?.hotel?.id).toBe("h-1");
  });

  it("ignores nothing, junk, another event and another version", () => {
    expect(parseOrderDraft(null, EVENT_ID, NOW)).toBeNull();
    expect(parseOrderDraft("{not json", EVENT_ID, NOW)).toBeNull();
    expect(parseOrderDraft("[1,2]", EVENT_ID, NOW)).toBeNull();
    expect(parseOrderDraft(stored(), 999, NOW)).toBeNull();
    const old = JSON.stringify({ ...JSON.parse(stored()), v: 0 });
    expect(parseOrderDraft(old, EVENT_ID, NOW)).toBeNull();
  });

  it("drops a draft past its TTL, and one stamped in the future", () => {
    expect(parseOrderDraft(stored({}, NOW - ORDER_DRAFT_TTL_MS - 1), EVENT_ID, NOW)).toBeNull();
    expect(parseOrderDraft(stored({}, NOW - ORDER_DRAFT_TTL_MS + 1000), EVENT_ID, NOW)).not.toBeNull();
    expect(parseOrderDraft(stored({}, NOW + 10 * 60_000), EVENT_ID, NOW)).toBeNull();
  });

  it("refuses a step or a party size out of range", () => {
    expect(parseOrderDraft(stored({ step: 7 }), EVENT_ID, NOW)).toBeNull();
    expect(parseOrderDraft(stored({ numberOfEventTickets: 0 }), EVENT_ID, NOW)).toBeNull();
    expect(parseOrderDraft(stored({ numberOfEventTickets: 12 }), EVENT_ID, NOW)).toBeNull();
  });

  it("normalises what it can: flyers follow the tickets, an unknown city is the flight city", () => {
    const raw = JSON.stringify({
      ...JSON.parse(stored({ numberOfEventTickets: 4 })),
      planeTickets: { adults: "four" },
      lodgingCity: "moon",
    });
    const draft = parseOrderDraft(raw, EVENT_ID, NOW);
    expect(draft?.planeTickets).toEqual({ adults: 4, children: 0 });
    expect(draft?.lodgingCity).toBe("flight");
  });

  it("a split is all its segments or none: one segment, or a broken one, is no split", () => {
    expect(parseOrderDraft(stored({ hotelSegments: [hotel()] }), EVENT_ID, NOW)?.hotelSegments).toBeNull();
    const broken = JSON.stringify({
      ...JSON.parse(stored()),
      hotelSegments: [hotel(), { name: "no id" }],
    });
    expect(parseOrderDraft(broken, EVENT_ID, NOW)?.hotelSegments).toBeNull();
    const whole = stored({ hotelSegments: [hotel(), hotel({ id: "h-2" })] });
    expect(parseOrderDraft(whole, EVENT_ID, NOW)?.hotelSegments).toHaveLength(2);
  });

  it("an empty ticket ({}), flight or hotel reads as none", () => {
    const raw = JSON.stringify({ ...JSON.parse(stored()), eventTicket: {}, flight: {}, hotel: { id: "" } });
    const draft = parseOrderDraft(raw, EVENT_ID, NOW);
    expect(draft?.eventTicket).toBeNull();
    expect(draft?.flight).toBeNull();
    expect(draft?.hotel).toBeNull();
  });
});

describe("resumeOrder - what a draft may bring back today", () => {
  it("a complete order comes back whole, on the summary", () => {
    const order = resumed();
    expect(order.step).toBe(4);
    expect(order.eventTicket?.id).toBe("t-main");
    expect(order.flight?.id).toBe("3");
    expect(order.hotel?.id).toBe("h-1");
    expect(order.currentMinTicketPrice).toBe(200);
    expect(order.resume).toBeNull();
  });

  it("a ticket no longer on sale restarts at step 1 and keeps only the party size", () => {
    for (const id of ["t-gone", "t-never-existed"]) {
      const order = resumed({ eventTicket: ticket(id), numberOfEventTickets: 4 });
      expect(order).toEqual(freshOrder(event(), 4));
    }
  });

  it("step 1 keeps the pick as a hint for the ticket step", () => {
    const order = resumed({ step: 1, flight: null, hotel: null });
    expect(order.step).toBe(1);
    expect(order.resume).toEqual({ step: 1, ticketId: "t-main" });
  });

  it("step 2 hands the flight to the flight step as a hint", () => {
    const order = resumed({ step: 2, hotel: null });
    expect(order.step).toBe(2);
    expect(order.resume?.step).toBe(2);
    expect(order.resume && "flight" in order.resume && order.resume.flight.id).toBe("3");
  });

  it("no flight yet: never past the flight step, and no hotel without a flight", () => {
    const order = resumed({ flight: null });
    expect(order.step).toBe(2);
    expect(order.hotel).toBeNull();
    expect(order.resume).toBeNull();
  });

  it("a departed flight is dropped", () => {
    const gone = flight({
      outbound: { ...flight().outbound, departureTime: "2026-09-30T06:10:00" },
    });
    const order = resumed({ flight: gone });
    expect(order.flight).toBeNull();
    expect(order.step).toBe(2);
  });

  it("no hotel yet: the hotel step at most", () => {
    const order = resumed({ hotel: null });
    expect(order.step).toBe(3);
    expect(order.flight?.id).toBe("3");
  });

  it("a hotel whose check-in has passed is dropped; today's check-in stays", () => {
    expect(resumed({ hotel: hotel({ checkin: "2026-09-30" }) }).step).toBe(3);
    expect(resumed({ hotel: hotel({ checkin: "2026-10-01" }) }).step).toBe(4);
  });

  it("a skipped hotel is a settled hotel", () => {
    const order = resumed({ hotel: null, skipHotel: true, skippedHotelPricePerGuest: 97.5 });
    expect(order.step).toBe(4);
    expect(order.skipHotel).toBe(true);
    expect(order.skippedHotelPricePerGuest).toBe(97.5);
  });

  it("a skipped flight counts only where the event allows skipping", () => {
    const skipped = { flight: null, flightSkipped: true };
    expect(resumed(skipped).step).toBe(2);
    expect(resumed(skipped).flightSkipped).toBe(false);
    const allowed = resumed(skipped, event({ skip_flight: true }));
    expect(allowed.step).toBe(4);
    expect(allowed.flightSkipped).toBe(true);
  });

  it("a US event has no hotel step: flight is enough for the summary", () => {
    const us = event({
      location: { name: "Miami", latitude: 25.7, longitude: -80.2, country_code: "US" },
    } as Partial<Event>);
    const order = resumed({ hotel: null }, us);
    expect(order.step).toBe(4);
    expect(order.hotel).toBeNull();
  });

  it("a ticket-only event is step 1 or the summary, both parts skipped", () => {
    const only = event({ package_mode: "ticket_only" } as Partial<Event>);
    const atSummary = resumed({ step: 4, flight: null, hotel: null }, only);
    expect(atSummary.step).toBe(4);
    expect(atSummary.flightSkipped && atSummary.skipHotel).toBe(true);
    expect(resumed({ step: 2, flight: null, hotel: null }, only).step).toBe(1);
  });

  it("a split stay comes back with its segments, first segment = the hotel", () => {
    const segments = [hotel(), hotel({ id: "h-2", checkin: "2026-10-30" })];
    const nights = [
      { date: "2026-10-29", city: "flight" as const },
      { date: "2026-10-30", city: "event" as const },
    ];
    const order = resumed({ hotelSegments: segments, splitNights: nights });
    expect(order.step).toBe(4);
    expect(order.hotelSegments).toHaveLength(2);
    expect(order.splitNights).toEqual(nights);
  });

  it("a split that lost its first hotel takes the hotel choice with it", () => {
    const segments = [hotel({ id: "h-other" }), hotel({ id: "h-2" })];
    const order = resumed({ hotelSegments: segments });
    expect(order.hotel).toBeNull();
    expect(order.hotelSegments).toBeNull();
    expect(order.step).toBe(3);
  });

  it("the event city is kept only while the event still has one", () => {
    expect(resumed({ lodgingCity: "event" }).lodgingCity).toBe("flight");
    const twoCities = event({
      event_location: { name: "Liverpool", latitude: 53.4, longitude: -2.98 },
      lodging_mode: "choice",
    } as Partial<Event>);
    expect(resumed({ lodgingCity: "event" }, twoCities).lodgingCity).toBe("event");
  });

  it("edit-from-summary survives only while the order is still complete", () => {
    expect(resumed({ step: 2, returnToSummary: true }).returnToSummary).toBe(true);
    expect(resumed({ step: 2, returnToSummary: true, hotel: null }).returnToSummary).toBe(false);
    expect(resumed({ step: 4, returnToSummary: true }).returnToSummary).toBe(false);
  });
});

describe("sameFlight / flightSearchDates - the flight step after a refresh", () => {
  it("recognises the itinerary under a new offer id and price", () => {
    expect(sameFlight(flight(), flight({ id: "11", price: 955 }))).toBe(true);
  });

  it("another airline, another time or an offline twin is another flight", () => {
    expect(sameFlight(flight(), flight({ airline: "BA" }))).toBe(false);
    const later = flight({ inbound: { ...flight().inbound, departureTime: "2026-11-01T23:30:00" } });
    expect(sameFlight(flight(), later)).toBe(false);
    expect(sameFlight(flight(), flight({ isOffline: true, offlineId: 5 }))).toBe(false);
    expect(sameFlight(flight(), null)).toBe(false);
  });

  it("gives the two departure days, or nothing when the flight leaves too soon", () => {
    const min = new Date("2026-10-02T00:00:00");
    const dates = flightSearchDates(flight(), min);
    expect(dates?.[0].getDate()).toBe(29);
    expect(dates?.[1].getDate()).toBe(1);
    // Midnight, like the picker's own values - not the flight's hour.
    expect(dates?.[0].getHours()).toBe(0);
    expect(dates?.[1].getHours()).toBe(0);
    expect(flightSearchDates(flight(), new Date("2026-10-30T00:00:00"))).toBeNull();
    expect(flightSearchDates(null, min)).toBeNull();
  });
});

describe("the passenger form", () => {
  const filled = { firstName: "דור", lastName: "אזורי", phone: "050-0000000", email: "a@b.co" };

  it("round-trips the four fields, the terms tick and the coupon - and nothing else", () => {
    const raw = JSON.stringify(
      buildOrderForm(
        { passengers: [{ ...filled, passport: "X123" }, {}], termsAccepted: true, coupon: " AVIRAN30 " },
        NOW,
      ),
    );
    expect(raw).not.toContain("X123");
    const form = parseOrderForm(raw, NOW + 1000);
    expect(form?.passengers[0]).toEqual(filled);
    expect(form?.passengers[1]).toEqual({ firstName: "", lastName: "", phone: "", email: "" });
    expect(form?.termsAccepted).toBe(true);
    expect(form?.coupon).toBe("AVIRAN30");
  });

  it("expires with the same TTL as the order", () => {
    const raw = JSON.stringify(
      buildOrderForm({ passengers: [filled], termsAccepted: false, coupon: null }, NOW),
    );
    expect(parseOrderForm(raw, NOW + ORDER_DRAFT_TTL_MS + 1)).toBeNull();
    expect(isStale(raw, NOW + ORDER_DRAFT_TTL_MS + 1)).toBe(true);
    expect(isStale(raw, NOW + 1000)).toBe(false);
    expect(isStale("{broken", NOW)).toBe(true);
  });

  it("fits the saved travellers to the party: extra rows dropped, missing ones blank", () => {
    expect(fitPassengers([filled, filled, filled], 2)).toHaveLength(2);
    const grown = fitPassengers([filled], 3);
    expect(grown[0]).toEqual(filled);
    expect(grown[2].firstName).toBe("");
    expect(fitPassengers(null, 2)).toHaveLength(2);
  });

  it("knows an untouched form", () => {
    expect(isBlankForm({ passengers: fitPassengers(null, 2), termsAccepted: false, coupon: null })).toBe(true);
    expect(isBlankForm({ passengers: [filled], termsAccepted: false, coupon: null })).toBe(false);
    expect(isBlankForm({ passengers: fitPassengers(null, 1), termsAccepted: true, coupon: null })).toBe(false);
  });
});

describe("ownedByLink - orders that arrive from the server", () => {
  it("a held order and a prepared package own their composition", () => {
    expect(ownedByLink("?orderId=5521")).toBe(true);
    expect(ownedByLink("?utm_source=aviran&pkg=abc123")).toBe(true);
    expect(ownedByLink("?utm_source=aviran")).toBe(false);
    expect(ownedByLink("")).toBe(false);
  });
});
