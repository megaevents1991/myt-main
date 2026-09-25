import type { TixStockListing } from "@/lib/tixstock.types";

/**
 * Can a TixStock listing fulfil a purchase of `qty` tickets?
 *
 * TixStock encodes the seller's split rules in two places:
 *  - `ticket.split_type`: "No Preferences" | "Avoid Leaving One Ticket" |
 *    "Sell Together" (all-or-nothing) | "Multiples"/"Sell in multiples"
 *  - `number_of_tickets_for_sale.split_quantity`: the multiple to sell in
 *    (0 = no multiple constraint - which is what the feed returns for the
 *    vast majority of listings).
 *
 * The old rule treated `split_quantity === 0` as "cannot split", so a single
 * ticket only qualified when a listing had exactly one ticket left - which
 * hid every category for qty=1 on events like 1095 (Sienna Spiro) even though
 * TixStock itself happily sells one.
 */
const splitTypeOf = (listing: TixStockListing): string =>
  (listing.ticket?.split_type ?? "").trim().toLowerCase();

/**
 * Whether the seats of a listing sit together - a stronger promise than the
 * pairs/triples we make for any other listing the seller lets us split:
 *  - an all-or-nothing listing ("All Together" / "Sell Together") is one block
 *    of seats bought whole;
 *  - sellers who do not publish the row write "TOGETHER" in it (often
 *    "*TOGETHER*") - their own promise that the seats are side by side. On
 *    event 1130 (25.09) 28 of 32 listings carried it and the other 4 were
 *    "All Together"; reading only the split type showed every party of four
 *    as two pairs (Alon 25.09).
 */
const ROW_SAYS_TOGETHER = /\btogether\b/i;

export const listingSeatsTogether = (listing: TixStockListing): boolean =>
  splitTypeOf(listing).includes("together") ||
  ROW_SAYS_TOGETHER.test(listing.seat_details?.row ?? "");

export function listingCanSatisfyQuantity(
  listing: TixStockListing,
  qty: number,
): boolean {
  if (!Number.isFinite(qty) || qty < 1) return false;

  const available = listing.number_of_tickets_for_sale?.quantity_available ?? 0;
  if (available < qty) return false;

  const splitType = splitTypeOf(listing);
  const splitQty = listing.number_of_tickets_for_sale?.split_quantity ?? 0;

  // All-or-nothing listings.
  if (splitType.includes("together") || splitType.includes("no split")) {
    return qty === available;
  }

  // Seller won't leave a single orphan ticket behind.
  if (splitType.includes("avoid") && available - qty === 1) {
    return false;
  }

  // Sell-in-multiples listings (split_quantity is the multiple).
  if (splitQty > 0 && qty % splitQty !== 0) {
    return false;
  }

  return true;
}
