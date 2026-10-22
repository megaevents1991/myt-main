import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import { flowSteps, stepForIndex, stepperIndex } from "../itinerary/flowSteps";

const ev = (id: number) => ({ id, name: `e${id}`, date: "2027-05-12T20:00:00", type: "music_event" }) as unknown as Event;

const two = [ev(1), ev(2)];
const three = [ev(1), ev(2), ev(3)];

describe("flowSteps", () => {
  it("two events: one ticket step each, then flights, hotels, summary", () => {
    expect(flowSteps(two)).toEqual(["אירוע 1", "אירוע 2", "טיסות", "מלונות", "סיום"]);
  });

  it("three events: a sixth step", () => {
    expect(flowSteps(three)).toEqual(["אירוע 1", "אירוע 2", "אירוע 3", "טיסות", "מלונות", "סיום"]);
  });
});

describe("stepperIndex", () => {
  it("the planner is before the stepper: 0", () => {
    expect(stepperIndex({ step: "build", activeEvent: 0, route: three })).toBe(0);
  });

  it("a ticket step is its event's number (1-based)", () => {
    expect(stepperIndex({ step: "tickets", activeEvent: 0, route: three })).toBe(1);
    expect(stepperIndex({ step: "tickets", activeEvent: 1, route: three })).toBe(2);
    expect(stepperIndex({ step: "tickets", activeEvent: 2, route: three })).toBe(3);
  });

  it("flights, hotels and summary follow the events", () => {
    expect(stepperIndex({ step: "flights", activeEvent: 0, route: three })).toBe(4);
    expect(stepperIndex({ step: "hotels", activeEvent: 0, route: three })).toBe(5);
    expect(stepperIndex({ step: "summary", activeEvent: 0, route: three })).toBe(6);
    expect(stepperIndex({ step: "summary", activeEvent: 0, route: two })).toBe(5);
  });

  it("a stale activeEvent past the route cannot step outside the ticket steps", () => {
    expect(stepperIndex({ step: "tickets", activeEvent: 9, route: two })).toBe(2);
  });
});

describe("stepForIndex", () => {
  it("a ticket index is that event's tickets step", () => {
    expect(stepForIndex(0, three)).toEqual({ step: "tickets", activeEvent: 0 });
    expect(stepForIndex(1, three)).toEqual({ step: "tickets", activeEvent: 1 });
    expect(stepForIndex(2, three)).toEqual({ step: "tickets", activeEvent: 2 });
  });

  it("the steps after the events", () => {
    expect(stepForIndex(3, three)).toEqual({ step: "flights", activeEvent: 0 });
    expect(stepForIndex(4, three)).toEqual({ step: "hotels", activeEvent: 0 });
    expect(stepForIndex(5, three)).toEqual({ step: "summary", activeEvent: 0 });
    expect(stepForIndex(2, two)).toEqual({ step: "flights", activeEvent: 0 });
    expect(stepForIndex(4, two)).toEqual({ step: "summary", activeEvent: 0 });
  });

  it("out of range is null", () => {
    expect(stepForIndex(6, three)).toBeNull();
    expect(stepForIndex(5, two)).toBeNull();
    expect(stepForIndex(-1, three)).toBeNull();
    expect(stepForIndex(1.5, three)).toBeNull();
  });

  it("is the inverse of stepperIndex (0-based vs 1-based)", () => {
    for (let i = 0; i < flowSteps(three).length; i++) {
      const target = stepForIndex(i, three);
      expect(target).not.toBeNull();
      expect(stepperIndex({ ...target!, route: three })).toBe(i + 1);
    }
  });
});
