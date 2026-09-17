/**
 * Quantity rules of a LiveTickets category, the counterpart of
 * `lib/tixstock-quantity.ts`.
 *
 * LiveTickets sells by category, not by seller listing, so the rules are flat:
 *  - `maxPerOrder` (their `maxTicketAmount`): most tickets one order may hold.
 *  - `seatingGroupMax` (their `seatingGroupMAXSize`): how many of those are
 *    seated together. null = the category makes no seating promise.
 */
export type LiveTicketsQuantityRules = {
  maxPerOrder: number;
  seatingGroupMax: number | null;
};

export function categoryCanSatisfyQuantity(
  rules: LiveTicketsQuantityRules,
  qty: number,
): boolean {
  if (!Number.isFinite(qty) || qty < 1) return false;
  return qty <= rules.maxPerOrder;
}

/**
 * How the party is seated for `qty` tickets:
 *  - "together": the whole party sits together.
 *  - "groups":   more tickets than one seating group - split into groups.
 *  - "none":     the category gives no seating promise.
 */
export function seatingForQuantity(
  rules: LiveTicketsQuantityRules,
  qty: number,
): "together" | "groups" | "none" {
  if (!rules.seatingGroupMax || rules.seatingGroupMax < 2) return "none";
  return qty <= rules.seatingGroupMax ? "together" : "groups";
}
