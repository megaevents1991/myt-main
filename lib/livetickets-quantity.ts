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
 * The seating we PROMISE for `qty` tickets (Dor, 2026-09-18): pairs, plus one
 * triple when the quantity is odd - [2, 2] for 4, [2, 3] for 5, [3] for 3.
 * Pairs are what LiveTickets seats at the listed price; a bigger group sitting
 * together is a different product on their side (their `seatingGroupFee`), so
 * four people are promised two pairs, not "all together". Never a lone seat.
 * null = no promise: the category makes none, the party is one person, or an
 * odd party needs a triple the category's group size cannot hold.
 */
export function seatingSplit(
  rules: LiveTicketsQuantityRules,
  qty: number,
): number[] | null {
  if (!rules.seatingGroupMax || rules.seatingGroupMax < 2) return null;
  if (!Number.isInteger(qty) || qty < 2) return null;
  const odd = qty % 2 === 1;
  if (odd && rules.seatingGroupMax < 3) return null;
  const pairs = (qty - (odd ? 3 : 0)) / 2;
  return [...Array<number>(pairs).fill(2), ...(odd ? [3] : [])];
}

/**
 * How the party is seated for `qty` tickets:
 *  - "together": one group - a pair or a triple sits together.
 *  - "groups":   several groups (see `seatingSplit`).
 *  - "none":     no seating promise.
 */
export function seatingForQuantity(
  rules: LiveTicketsQuantityRules,
  qty: number,
): "together" | "groups" | "none" {
  const split = seatingSplit(rules, qty);
  if (!split) return "none";
  return split.length === 1 ? "together" : "groups";
}
