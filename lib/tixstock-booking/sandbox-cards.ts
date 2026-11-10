// The ticket cards of the hidden SANDBOX checkout (TixStock's health check; an `is_test` event with
// `tixstock_booking` set). One card per category: the cheapest listing that can sell the party, with that
// listing's OWN details - the customer buys exactly this listing, so its id travels with the card to the pay
// click, where it is held.
//
// A real event's ticket step never comes here: it keeps `lib/supplier-offers.ts` and the production feed.
// The rules that decide whether a listing can sell are the site's own, imported and never re-written here:
// `listingCanSatisfyQuantity` (split rules), `hasObstructedViewRestriction`, `normalizeTxCategory`.
// Test: lib/__tests__/tixstockSandboxCards.test.ts.
import { normalizeTxCategory } from "@/lib/tixstock-category";
import { hasObstructedViewRestriction } from "@/lib/tixstock-feed";
import { listingCanSatisfyQuantity, listingSeatsTogether } from "@/lib/tixstock-quantity";
import type { TixStockListing } from "@/lib/tixstock.types";

export type SandboxCard = {
  /** The category as the feed spells it. */
  category: string;
  /** The listing this card sells - the one that is held at the pay click. */
  listingId: string;
  /** What the customer sees per ticket: the listing's price rounded up to a whole dollar. */
  pricePerTicketUsd: number;
  /** The listing's price exactly as the feed gave it - what TixStock is told in orders/add. */
  listingAmountUsd: number;
  ticketType: string;
  splitType: string;
  /** The seller sells single seats: the party may not sit together. */
  singleSeats: boolean;
  restrictions: string[];
  deliveryDate: string | null;
  instantDownload: boolean;
  /** How many the customer may buy of it: the seller's display quantity when set, else what is on sale. */
  available: number;
};

/** The feed sends booleans as strings ("false" / "true" / "1" / "Yes"): the string "false" must read as false. */
const flag = (v: unknown): boolean =>
  v === true || v === 1 || (typeof v === "string" && ["true", "1", "yes"].includes(v.trim().toLowerCase()));

/** Fields the sandbox feed carries that the shared listing type does not name. */
type FeedExtras = {
  requires_lead_booker?: unknown;
  restrictions_benefits?: { options?: unknown; other?: unknown } | null;
};

/** How many of a listing the customer may buy. */
const shownQuantity = (listing: TixStockListing): number => {
  const available = Number(listing.number_of_tickets_for_sale?.quantity_available ?? 0) || 0;
  const display = Number(listing.number_of_tickets_for_sale?.display_quantity ?? 0) || 0;
  return display > 0 ? Math.min(display, available) : available;
};

/** Same reading as the ticket step's debug panel (app/order/TicketSelection.tsx), as a list instead of one line. */
const restrictionsOf = (listing: TixStockListing): string[] => {
  const rb = (listing as unknown as FeedExtras).restrictions_benefits;
  const options = Array.isArray(rb?.options) ? rb.options : [];
  const out = options.map((opt) =>
    typeof opt === "string" ? opt : `${(opt as { name?: string })?.name ?? ""}: ${(opt as { value?: string })?.value ?? ""}`,
  );
  const other = Array.isArray(rb?.other) ? rb.other : [rb?.other];
  for (const line of other) if (typeof line === "string") out.push(line);
  return out.map((s) => s.trim()).filter((s) => s !== "" && s !== ":");
};

const toCard = (listing: TixStockListing, amount: number): SandboxCard => {
  const splitType = (listing.ticket?.split_type ?? "").trim();
  const delivery = (listing.delivery?.shipped_date_or_date_in_hand ?? "").trim();
  return {
    category: (listing.seat_details?.category ?? "").trim(),
    listingId: String(listing.id),
    pricePerTicketUsd: Math.ceil(amount),
    listingAmountUsd: amount,
    ticketType: (listing.ticket?.type ?? "").trim(),
    splitType,
    singleSeats: splitType.toLowerCase().includes("single"),
    restrictions: restrictionsOf(listing),
    deliveryDate: delivery === "" ? null : delivery,
    instantDownload: flag(listing.ticket?.instant_download),
    available: shownQuantity(listing),
  };
};

/**
 * The cards for a party of `qty`, cheapest category first. A listing gets no card when it cannot sell the party
 * (split rules, display quantity), has a restricted view, needs a lead booker, or has no price. A tie on price
 * goes to the listing whose seats sit together, as on a real event.
 */
export function sandboxCards(listings: TixStockListing[], qty: number): SandboxCard[] {
  if (!Number.isInteger(qty) || qty < 1) return [];

  const best = new Map<string, { listing: TixStockListing; amount: number; together: boolean }>();
  for (const listing of listings) {
    const key = normalizeTxCategory(listing.seat_details?.category);
    if (!key) continue;
    if (flag((listing as unknown as FeedExtras).requires_lead_booker)) continue;
    if (hasObstructedViewRestriction(listing)) continue;
    if (qty > shownQuantity(listing) || !listingCanSatisfyQuantity(listing, qty)) continue;
    const amount = Number.parseFloat(listing.proceed_price?.amount ?? "");
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const together = listingSeatsTogether(listing);
    const seen = best.get(key);
    if (!seen || amount < seen.amount || (amount === seen.amount && together && !seen.together)) {
      best.set(key, { listing, amount, together });
    }
  }

  return [...best.values()]
    .map(({ listing, amount }) => toCard(listing, amount))
    .sort((a, b) => a.pricePerTicketUsd - b.pricePerTicketUsd || a.category.localeCompare(b.category));
}
