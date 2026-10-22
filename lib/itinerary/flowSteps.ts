/**
 * "Build Your Euro Trip" - the stepper's steps. Pure: no I/O, no clock.
 * The stepper is the order flow's four steps: ONE tickets step for the whole trip, then flights,
 * hotels and the summary. The trip's events are sub-steps INSIDE the tickets step
 * (`ticketSubSteps`, drawn by TicketSubSteps under the stepper) - Dor, 22.10: six steps on the
 * stepper ("אירוע 1 | אירוע 2 | ...") wrapped on a phone and read as six separate stages.
 * The planner (`build`) is before the stepper, so it has no index.
 *
 * Mantine's `Stepper` counts from 0 (`onStepClick(index)`), the live `Stepper` wrapper's
 * `currentStep` from 1: `stepperIndex` answers the 1-based one, `stepForIndex` takes the 0-based
 * one the click hands back.
 */
import { ticketReady } from "./adapter";
import type { ItineraryState, ItineraryStep } from "./state";

const FLOW_STEPS = ["כרטיסים", "טיסות", "מלונות", "סיום"];

/** The stepper's labels: `["כרטיסים", "טיסות", "מלונות", "סיום"]`. */
export function flowSteps(): string[] {
  return [...FLOW_STEPS];
}

/** The steps on the stepper, in its order (the planner is not one). */
type FlowStep = Exclude<ItineraryStep, "build">;
const ON_STEPPER: FlowStep[] = ["tickets", "flights", "hotels", "summary"];

/**
 * Where the flow stands on the stepper, 1-based: tickets 1, flights 2, hotels 3, summary 4 -
 * whichever event the tickets step has open. The planner is 0 (not on the stepper).
 */
export function stepperIndex(s: Pick<ItineraryState, "step">): number {
  return s.step === "build" ? 0 : ON_STEPPER.indexOf(s.step) + 1;
}

/**
 * The step a click on the stepper's `index0` (0-based) opens; `null` when there is no such step.
 * A bare step: "כרטיסים" reopens the tickets step on the event the customer last had open
 * (`state.activeEvent` is the caller's to keep).
 */
export function stepForIndex(index0: number): FlowStep | null {
  if (!Number.isInteger(index0) || index0 < 0 || index0 >= ON_STEPPER.length) return null;
  return ON_STEPPER[index0];
}

/** One event of the trip as a sub-step of the tickets step. */
export type TicketSubStep = {
  /** The event's place in the route (0-based) - `setActiveEvent`'s argument. */
  index: number;
  /** `"אירוע <n>"`, 1-based. */
  label: string;
  /** The event's name. */
  name: string;
  /** Its ticket is picked for the whole party. */
  done: boolean;
  /** The event the tickets step has open (`activeEvent`, clamped to the route). */
  current: boolean;
  /**
   * May be opened: a done event, or any up to the first event without a ready ticket - going
   * back to a done one is fine, skipping ahead past an open one is not (the continue bar walks
   * the events in order).
   */
  enabled: boolean;
};

/** The tickets step's sub-steps: one per event of the route, in trip order. */
export function ticketSubSteps(
  s: Pick<ItineraryState, "route" | "tickets" | "pax" | "activeEvent">,
): TicketSubStep[] {
  const { route, tickets, pax } = s;
  if (!route.length) return [];
  const done = route.map((e) => ticketReady(tickets[e.id], pax));
  const firstOpen = done.indexOf(false);
  const reach = firstOpen < 0 ? route.length - 1 : firstOpen;
  const current = Math.max(0, Math.min(s.activeEvent, route.length - 1));
  return route.map((e, index) => ({
    index,
    label: `אירוע ${index + 1}`,
    name: e.name,
    done: done[index],
    current: index === current,
    enabled: done[index] || index <= reach,
  }));
}
