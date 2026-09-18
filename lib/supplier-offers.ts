import type { EventTicket, EventType } from "@/lib/app.types";
import type { TixStockListing } from "@/lib/tixstock.types";
import type { LiveTicketsOffer } from "@/lib/livetickets";
import { ticketSupplier } from "@/lib/suppliers";
import { normalizeTxCategory } from "@/lib/tixstock-category";
import { listingCanSatisfyQuantity } from "@/lib/tixstock-quantity";
import {
  categoryCanSatisfyQuantity,
  seatingForQuantity,
} from "@/lib/livetickets-quantity";

/**
 * Turns an event's tickets into what the customer can actually buy for a
 * given quantity, when the tickets come from several suppliers.
 *
 * Every supplier prices ONLY its own tickets: TixStock by (normalized)
 * category name among TixStock tickets, LiveTickets by category id among
 * LiveTickets tickets. "Category 1" exists at both - matching across
 * suppliers would cross-price them.
 *
 * Pure - no React, no fetch. The order page feeds it the live answers.
 */

/**
 * How a party of the requested size is seated:
 *  - "together": the whole party sits together (LiveTickets, within one group)
 *  - "pairs":    seated in pairs/triples - TixStock's promise, never "all together"
 *  - "groups":   split into seating groups of `seatingGroupMax`
 *  - "none":     no seating promise
 */
export type Seating = "together" | "pairs" | "groups" | "none";

export type PricedTicket = EventTicket & {
  seating?: Seating;
  /** Size of one seating group, when `seating` is "groups". */
  seatingGroupMax?: number;
};

/**
 * Live state of one supplier:
 *  - "none":    the event has no tickets of this supplier
 *  - "loading": first answer still in flight
 *  - "live":    supplier answered
 *  - "down":    supplier unreachable - sell its tickets on the buffered DB price
 */
export type SupplierStatus = "none" | "loading" | "live" | "down";

export type SupplierLiveData = {
  tixstock: { status: SupplierStatus; listings: TixStockListing[] };
  livetickets: { status: SupplierStatus; offers: LiveTicketsOffer[] };
};

const buffered = (ticket: EventTicket, multiplier: number): PricedTicket => ({
  ...ticket,
  price: Math.ceil(ticket.price * multiplier),
});

/** Cheapest live TixStock price for a category at `qty`, or null. */
export function tixstockPriceForCategory(
  listings: TixStockListing[],
  category: string,
  qty: number,
): number | null {
  const wanted = normalizeTxCategory(category);
  if (!wanted) return null;

  let best: number | null = null;
  for (const listing of listings) {
    if (normalizeTxCategory(listing.seat_details?.category) !== wanted) continue;
    if (!listingCanSatisfyQuantity(listing, qty)) continue;
    const amount = parseFloat(listing.proceed_price?.amount ?? "NaN");
    if (!Number.isFinite(amount)) continue;
    if (best === null || amount < best) best = amount;
  }
  return best === null ? null : Math.ceil(best);
}

function priceTixstockTicket(
  ticket: EventTicket,
  live: SupplierLiveData["tixstock"],
  qty: number,
  fallbackMultiplier: number,
): PricedTicket | null {
  // No listings = live pricing unavailable (error, timeout, zero listings, or
  // the fetch still in flight): sell on the buffered DB price so neither an
  // outage nor a fast "continue" can undercut the true live price.
  if (live.listings.length === 0) return buffered(ticket, fallbackMultiplier);

  const price = tixstockPriceForCategory(live.listings, ticket.category, qty);
  if (price === null) return null; // category can't fulfil this quantity
  // TixStock guarantees pairs/triples, not the whole party together.
  return { ...ticket, price, seating: "pairs" };
}

function priceLiveTicketsTicket(
  ticket: EventTicket,
  live: SupplierLiveData["livetickets"],
  qty: number,
  fallbackMultiplier: number,
): PricedTicket | null {
  if (live.status === "loading") return null;
  if (live.status !== "live") return buffered(ticket, fallbackMultiplier);

  const offer = live.offers.find((o) => o.id === ticket.id);
  // Not in the live answer = sold out or no longer instant-confirm.
  if (!offer) return null;
  if (!categoryCanSatisfyQuantity(offer, qty)) return null;

  const seating = seatingForQuantity(offer, qty);
  return {
    ...ticket,
    price: offer.priceUsd,
    seating,
    seatingGroupMax:
      seating === "groups" ? (offer.seatingGroupMax ?? undefined) : undefined,
  };
}

/** Tickets the customer can buy at `qty`, each priced by its own supplier. */
export function priceTicketsForQuantity(
  tickets: EventTicket[],
  eventType: EventType | undefined,
  qty: number,
  live: SupplierLiveData,
  fallbackMultiplier: number,
): PricedTicket[] {
  return tickets.reduce<PricedTicket[]>((priced, ticket) => {
    const supplier = ticketSupplier(ticket, eventType);
    const result =
      supplier === "tixstock"
        ? priceTixstockTicket(ticket, live.tixstock, qty, fallbackMultiplier)
        : supplier === "livetickets"
          ? priceLiveTicketsTicket(
              ticket,
              live.livetickets,
              qty,
              fallbackMultiplier,
            )
          : ticket; // static tickets are never live-priced
    if (result) priced.push(result);
    return priced;
  }, []);
}

/**
 * Ids of the tickets that win their zone: the cheapest offer in a zone that
 * is sold by MORE than one supplier. A zone with a single supplier has no
 * competition, so nothing is badged there.
 */
export function bestPriceTicketIds(
  tickets: EventTicket[],
  eventType: EventType | undefined,
): Set<string> {
  const byZone = new Map<string, EventTicket[]>();
  for (const ticket of tickets) {
    if (!ticket.zoneId) continue;
    const zone = byZone.get(ticket.zoneId) ?? [];
    zone.push(ticket);
    byZone.set(ticket.zoneId, zone);
  }

  const winners = new Set<string>();
  for (const zone of byZone.values()) {
    const suppliers = new Set(zone.map((t) => ticketSupplier(t, eventType)));
    if (suppliers.size < 2) continue;
    const cheapest = zone.reduce((min, t) => (t.price < min.price ? t : min));
    winners.add(cheapest.id);
  }
  return winners;
}
