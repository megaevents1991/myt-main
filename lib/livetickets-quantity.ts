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

/** `seatingMethodId` 3 = "doubles": seated in pairs, with no group size given. */
const DOUBLES_SEATING_METHOD = 3;

/**
 * `seatingGroupMax` of a LiveTickets category. A "doubles" category sends no
 * `seatingGroupMAXSize` but seats in pairs - read as 2, so a pair is promised
 * together and four as two pairs; an odd party gets no promise (no triple in a
 * pairs category, Dor 28.09). Without it Real Madrid-Barcelona (717) promised
 * nothing at all (Alon 28.09). Same rule in backoffice
 * lib/services/livetickets-offers.ts.
 */
export const seatingGroupMaxOf = (category: {
  seatingMethodId?: number;
  seatingGroupMAXSize?: number | null;
}): number | null =>
  category.seatingGroupMAXSize ??
  (category.seatingMethodId === DOUBLES_SEATING_METHOD ? 2 : null);

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
 * A "doubles" category (`seatingGroupMax` 2) and an odd party: pairs plus one
 * seat of its own - [2, 1] for three, [2, 2, 1] for five. LiveTickets sells no
 * triple in a doubles category and publishes no fee for one (29.09: 0 of 3,070
 * doubles categories across 1,061 future events carry a `seatingGroupFee`; the
 * group categories that do are priced by `liveTicketsPriceForQuantity`), so
 * the price stays the listed one. The card says so out loud, and a zone offer
 * that seats the whole party together becomes its other side (Alon + Dor
 * 29.09, `zoneOffers`). null for anything else.
 */
export function pairsPlusSingle(
  rules: LiveTicketsQuantityRules,
  qty: number,
): number[] | null {
  if (rules.seatingGroupMax !== 2) return null;
  if (!Number.isInteger(qty) || qty < 3 || qty % 2 === 0) return null;
  return [...Array<number>((qty - 1) / 2).fill(2), 1];
}

/**
 * Price per ticket for `qty` tickets (Dor, 2026-09-19: a fee LiveTickets
 * charges us is simply folded into the ticket price). Pairs sell at the listed
 * price; the ONE triple an odd party is promised costs us their
 * `seatingGroupFee` on its three tickets, so that fee is spread over the whole
 * party - every ticket of the order carries the same price. No triple in the
 * split (even party, or no seating promise) = the listed price.
 * `tripleFeeUsd` is the fee on ONE ticket of a triple, in USD, unrounded.
 */
export function liveTicketsPriceForQuantity(
  offer: LiveTicketsQuantityRules & { priceUsd: number; tripleFeeUsd: number },
  qty: number,
): number {
  const split = seatingSplit(offer, qty);
  if (!split?.includes(3) || !(offer.tripleFeeUsd > 0)) return offer.priceUsd;
  return offer.priceUsd + Math.ceil((offer.tripleFeeUsd * 3) / qty);
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
