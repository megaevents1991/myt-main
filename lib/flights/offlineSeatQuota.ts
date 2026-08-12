export type AllocationRow = { flight_id: number; allocated_seats: number };
export type ConsumedRow = { flight_id: number; consumed_seats: number };

/**
 * Seats still sellable to ONE event, keyed by flight id. A flight absent from
 * the map has no allocation row and draws on the global pool - the
 * pre-allocation behaviour, deliberately preserved so existing links keep
 * working without a backfill.
 */
export function buildSeatQuota(
  allocations: AllocationRow[],
  consumed: ConsumedRow[],
): Map<number, number> {
  const consumedByFlight = new Map<number, number>(
    consumed.map((row) => [row.flight_id, row.consumed_seats]),
  );
  return new Map(
    allocations.map((allocation) => [
      allocation.flight_id,
      allocation.allocated_seats -
        (consumedByFlight.get(allocation.flight_id) ?? 0),
    ]),
  );
}

/**
 * Hard cap: an event with its own allocation may not sell past it, even when
 * the flight still has unallocated seats. No allocation → no extra restriction.
 */
export function hasSeatsForEvent(
  quota: Map<number, number>,
  flightId: number,
  travelers: number,
): boolean {
  const remaining = quota.get(flightId);
  if (remaining === undefined) return true;
  return remaining >= travelers;
}
