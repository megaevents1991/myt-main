import { hasSeatsForEvent } from "./offlineSeatQuota";

export type LockedFlightOutcome =
  | { mode: "unlocked" }
  | { mode: "locked"; flightId: number }
  | { mode: "sold_out"; flightId: number };

/**
 * Decides how a search should behave for one event.
 *  - unlocked  → normal Amadeus + offline merge
 *  - locked    → offer ONLY this flight, no Amadeus call
 *  - sold_out  → offer nothing; deliberately NO Amadeus fallback, because a
 *                fallback would change the package price behind the customer.
 *
 * A locked flight with no allocation row stays "locked": the global inventory
 * check in the route is then the only gate, exactly as before.
 */
export function resolveLockedFlight(
  lockedFlightId: number | null | undefined,
  quota: Map<number, number>,
  travelers: number,
): LockedFlightOutcome {
  if (!lockedFlightId) return { mode: "unlocked" };
  return hasSeatsForEvent(quota, lockedFlightId, travelers)
    ? { mode: "locked", flightId: lockedFlightId }
    : { mode: "sold_out", flightId: lockedFlightId };
}
