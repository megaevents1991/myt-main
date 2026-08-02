export type LockedFlightInventory = {
  id: number;
  initial_quantity: number;
  consumed_quantity: number;
  is_deleted: string | null;
};

/**
 * Seats a locked package can still sell, or 0 when it can sell none.
 *
 * Two gates, the same two the flight search applies, in the same order:
 *  - the flight's own pool (`initial_quantity - consumed_quantity`), which is
 *    what hid flight 30 when it reached 16/16;
 *  - the event's allocation, when it has one — a hard cap that can bite while
 *    the flight still has unallocated seats elsewhere.
 *
 * A locked flight that is missing, soft-deleted, or unknown counts as zero:
 * the package promises that one flight and there is deliberately no fallback
 * to a dynamic search, so there is nothing left to sell.
 */
export function lockedSeatsRemaining(
  lockedFlightId: number | null | undefined,
  flight: LockedFlightInventory | undefined,
  allocationRemaining: number | undefined,
): number {
  if (!lockedFlightId) return Number.POSITIVE_INFINITY; // not a locked package
  if (!flight || flight.is_deleted) return 0;

  const pool = flight.initial_quantity - flight.consumed_quantity;
  const remaining =
    allocationRemaining === undefined ? pool : Math.min(pool, allocationRemaining);
  return Math.max(0, remaining);
}

/**
 * Does a locked package have nothing left to sell? Drives the catalog card's
 * sold-out badge, so the listing agrees with what the order page will do
 * instead of sending the customer to a dead end.
 */
export function isLockedPackageSoldOut(
  lockedFlightId: number | null | undefined,
  flight: LockedFlightInventory | undefined,
  allocationRemaining: number | undefined,
): boolean {
  return lockedSeatsRemaining(lockedFlightId, flight, allocationRemaining) < 1;
}
