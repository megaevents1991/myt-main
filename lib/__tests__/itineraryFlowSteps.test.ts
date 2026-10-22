import { describe, expect, it } from "vitest";
import type { Event, OrderTicket } from "../app.types";
import { flowSteps, stepForIndex, stepperIndex, ticketSubSteps } from "../itinerary/flowSteps";

const ev = (id: number, name = `e${id}`) =>
  ({ id, name, date: "2027-05-12T20:00:00", type: "music_event" }) as unknown as Event;
const ticket = (id: string, quantity: number) => ({ id, quantity }) as unknown as OrderTicket;

const three = [ev(1, "Coldplay"), ev(2, "Real Madrid - Barcelona"), ev(3, "Adele")];

describe("flowSteps", () => {
  it("four steps: one tickets step for the whole trip, then flights, hotels, summary", () => {
    expect(flowSteps()).toEqual(["כרטיסים", "טיסות", "מלונות", "סיום"]);
  });
});

describe("stepperIndex", () => {
  it("the planner is before the stepper: 0", () => {
    expect(stepperIndex({ step: "build" })).toBe(0);
  });

  it("tickets, flights, hotels, summary are 1-4 (1-based), whatever event is open", () => {
    expect(stepperIndex({ step: "tickets" })).toBe(1);
    expect(stepperIndex({ step: "flights" })).toBe(2);
    expect(stepperIndex({ step: "hotels" })).toBe(3);
    expect(stepperIndex({ step: "summary" })).toBe(4);
  });
});

describe("stepForIndex", () => {
  it("a click on each step (0-based) opens that step", () => {
    expect(stepForIndex(0)).toBe("tickets");
    expect(stepForIndex(1)).toBe("flights");
    expect(stepForIndex(2)).toBe("hotels");
    expect(stepForIndex(3)).toBe("summary");
  });

  it("the tickets step carries no event (a bare step): the caller keeps the one last open", () => {
    expect(typeof stepForIndex(0)).toBe("string");
  });

  it("out of range is null", () => {
    expect(stepForIndex(4)).toBeNull();
    expect(stepForIndex(-1)).toBeNull();
    expect(stepForIndex(1.5)).toBeNull();
    expect(stepForIndex(Number.NaN)).toBeNull();
  });

  it("is the inverse of stepperIndex (0-based vs 1-based)", () => {
    for (let i = 0; i < flowSteps().length; i++) {
      const step = stepForIndex(i);
      expect(step).not.toBeNull();
      expect(stepperIndex({ step: step! })).toBe(i + 1);
    }
  });
});

describe("ticketSubSteps", () => {
  const base = { route: three, tickets: {}, pax: 2, activeEvent: 0 };

  it("one item per event in trip order, labelled 'אירוע n' with the event's name", () => {
    const items = ticketSubSteps(base);
    expect(items.map((s) => s.index)).toEqual([0, 1, 2]);
    expect(items.map((s) => s.label)).toEqual(["אירוע 1", "אירוע 2", "אירוע 3"]);
    expect(items.map((s) => s.name)).toEqual(["Coldplay", "Real Madrid - Barcelona", "Adele"]);
  });

  it("no ticket picked: only the first event is enabled, none done", () => {
    const items = ticketSubSteps(base);
    expect(items.map((s) => s.done)).toEqual([false, false, false]);
    expect(items.map((s) => s.enabled)).toEqual([true, false, false]);
  });

  it("the first event done: the first two are enabled", () => {
    const items = ticketSubSteps({ ...base, tickets: { 1: ticket("a", 2) } });
    expect(items.map((s) => s.done)).toEqual([true, false, false]);
    expect(items.map((s) => s.enabled)).toEqual([true, true, false]);
  });

  it("the first and third done, the second open: all three enabled, the third done", () => {
    const items = ticketSubSteps({ ...base, tickets: { 1: ticket("a", 2), 3: ticket("c", 2) } });
    expect(items.map((s) => s.done)).toEqual([true, false, true]);
    expect(items.map((s) => s.enabled)).toEqual([true, true, true]);
  });

  it("every event done: all enabled", () => {
    const items = ticketSubSteps({
      ...base,
      tickets: { 1: ticket("a", 2), 2: ticket("b", 2), 3: ticket("c", 2) },
    });
    expect(items.every((s) => s.done && s.enabled)).toBe(true);
  });

  it("a ticket for another party size is not done (the quantity changed)", () => {
    const items = ticketSubSteps({ ...base, pax: 3, tickets: { 1: ticket("a", 2) } });
    expect(items[0].done).toBe(false);
    expect(items.map((s) => s.enabled)).toEqual([true, false, false]);
  });

  it("current follows activeEvent", () => {
    const all = { 1: ticket("a", 2), 2: ticket("b", 2) };
    expect(ticketSubSteps({ ...base, tickets: all, activeEvent: 1 }).map((s) => s.current)).toEqual([
      false,
      true,
      false,
    ]);
    expect(ticketSubSteps({ ...base, tickets: all, activeEvent: 2 }).map((s) => s.current)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it("current is clamped to the route", () => {
    expect(ticketSubSteps({ ...base, activeEvent: 9 }).map((s) => s.current)).toEqual([false, false, true]);
    expect(ticketSubSteps({ ...base, activeEvent: -1 }).map((s) => s.current)).toEqual([true, false, false]);
  });

  it("an empty route has no items", () => {
    expect(ticketSubSteps({ ...base, route: [] })).toEqual([]);
  });
});
