/**
 * "Build Your Euro Trip" - the stepper's steps. Pure: no I/O, no clock.
 * The flow is the order flow's: one ticket step PER EVENT of the route, then flights, hotels and
 * the summary. The planner (`build`) is before the stepper, so it has no index.
 *
 * Mantine's `Stepper` counts from 0 (`onStepClick(index)`), the live `Stepper` wrapper's
 * `currentStep` from 1: `stepperIndex` answers the 1-based one, `stepForIndex` takes the 0-based
 * one the click hands back.
 */
import type { Event } from "@/lib/app.types";
import type { ItineraryState, ItineraryStep } from "./state";

/** `["אירוע 1", ..., "אירוע N", "טיסות", "מלונות", "סיום"]`. */
export function flowSteps(route: Event[]): string[] {
  return [...route.map((_, i) => `אירוע ${i + 1}`), "טיסות", "מלונות", "סיום"];
}

/**
 * Where the flow stands on the stepper, 1-based: tickets of event `i` = `i + 1`, then flights
 * N + 1, hotels N + 2, summary N + 3. The planner is 0 (not on the stepper). A `activeEvent`
 * past the route stays on the last ticket step.
 */
export function stepperIndex(s: Pick<ItineraryState, "step" | "activeEvent" | "route">): number {
  const n = s.route.length;
  switch (s.step) {
    case "build":
      return 0;
    case "tickets":
      return Math.max(0, Math.min(s.activeEvent, n - 1)) + 1;
    case "flights":
      return n + 1;
    case "hotels":
      return n + 2;
    case "summary":
      return n + 3;
  }
}

/**
 * The step a click on the stepper's `index0` (0-based) opens; `null` when there is no such step.
 * Only a ticket step has an event of its own: every other step answers `activeEvent: 0`.
 */
export function stepForIndex(index0: number, route: Event[]): { step: ItineraryStep; activeEvent: number } | null {
  const n = route.length;
  if (!Number.isInteger(index0) || index0 < 0 || index0 >= n + 3) return null;
  if (index0 < n) return { step: "tickets", activeEvent: index0 };
  const after: ItineraryStep[] = ["flights", "hotels", "summary"];
  return { step: after[index0 - n], activeEvent: 0 };
}
