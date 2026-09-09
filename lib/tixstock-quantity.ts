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
export function listingCanSatisfyQuantity(
  listing: TixStockListing,
  qty: number,
): boolean {
  if (!Number.isFinite(qty) || qty < 1) return false;

  const available = listing.number_of_tickets_for_sale?.quantity_available ?? 0;
  if (available < qty) return false;

  const splitType = (listing.ticket?.split_type ?? "").trim().toLowerCase();
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
