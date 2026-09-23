import type { EventTicket, EventType } from "@/lib/app.types";
import type { TixStockListing } from "@/lib/tixstock.types";
import type { LiveTicketsOffer } from "@/lib/livetickets";
import { ticketSupplier, type TicketSupplier } from "@/lib/suppliers";
import { normalizeTxCategory } from "@/lib/tixstock-category";
import {
  listingCanSatisfyQuantity,
  listingSeatsTogether,
} from "@/lib/tixstock-quantity";
import {
  categoryCanSatisfyQuantity,
  liveTicketsPriceForQuantity,
  seatingForQuantity,
  seatingSplit,
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
 *  - "together": the whole party sits together (LiveTickets within one group,
 *                or a TixStock listing that is sold whole)
 *  - "pairs":    seated in pairs/triples - a TixStock listing the seller splits
 *  - "groups":   split into seating groups of `seatingGroupMax`
 *  - "none":     no seating promise
 */
export type Seating = "together" | "pairs" | "groups" | "none";

export type PricedTicket = EventTicket & {
  seating?: Seating;
  /** Size of one seating group, when `seating` is "groups". */
  seatingGroupMax?: number;
  /** LiveTickets: the groups the party is promised, e.g. [2, 3] for five (`seatingSplit`). */
  seatingSplit?: number[];
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

/**
 * The cheapest live TixStock listing of a category that can sell `qty`, or
 * null. `together` = that listing is sold whole, so the party sits together.
 */
export function cheapestTixstockListing(
  listings: TixStockListing[],
  category: string,
  qty: number,
): { price: number; together: boolean } | null {
  const wanted = normalizeTxCategory(category);
  if (!wanted) return null;

  let best: { amount: number; together: boolean } | null = null;
  for (const listing of listings) {
    if (normalizeTxCategory(listing.seat_details?.category) !== wanted) continue;
    if (!listingCanSatisfyQuantity(listing, qty)) continue;
    const amount = parseFloat(listing.proceed_price?.amount ?? "NaN");
    if (!Number.isFinite(amount)) continue;
    if (best === null || amount < best.amount) {
      best = { amount, together: listingSeatsTogether(listing) };
    }
  }
  return best && { price: Math.ceil(best.amount), together: best.together };
}

/** Cheapest live TixStock price for a category at `qty`, or null. */
export function tixstockPriceForCategory(
  listings: TixStockListing[],
  category: string,
  qty: number,
): number | null {
  return cheapestTixstockListing(listings, category, qty)?.price ?? null;
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

  const best = cheapestTixstockListing(live.listings, ticket.category, qty);
  if (!best) return null; // category can't fulfil this quantity
  // A listing sold whole seats the party together (2026-09-19); one the seller
  // lets us split promises pairs/triples, never the whole party.
  return {
    ...ticket,
    price: best.price,
    seating: best.together && qty > 1 ? "together" : "pairs",
  };
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
  // Not in the live answer = sold out / no longer sellable.
  if (!offer) return null;
  // Not instant-confirm: sold only when the backoffice attached it as such.
  if (!offer.instant && !ticket.nonInstant) return null;
  if (!categoryCanSatisfyQuantity(offer, qty)) return null;

  const seating = seatingForQuantity(offer, qty);
  const split = seatingSplit(offer, qty) ?? undefined;
  return {
    ...ticket,
    price: liveTicketsPriceForQuantity(offer, qty),
    seating,
    seatingSplit: split,
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
 * One supplier per zone (Dor, 2026-09-18: "אם יש קטגוריה זהה לשני הספקים, נציג
 * את הספק הזול יותר"). The same zone sold by two suppliers is the same seat
 * bought twice over, so the customer sees only the supplier whose cheapest
 * offer there is lower - at the prices of THIS quantity, which is why it runs
 * on the priced list: a supplier that cannot seat the party is already gone
 * and the other one simply stays. A tie keeps the first in the list.
 * Tickets with no zone, and zones a single supplier sells, pass untouched -
 * "exactly the same category" is a shared `zoneId`, nothing looser.
 * The caller applies it only while every supplier is priced live: a buffered
 * estimate must not hide a real offer.
 */
export function cheapestSupplierPerZone<T extends EventTicket>(
  tickets: T[],
  eventType: EventType | undefined,
): T[] {
  const winnerByZone = new Map<string, { supplier: TicketSupplier; price: number }>();
  for (const ticket of tickets) {
    if (!ticket.zoneId) continue;
    const best = winnerByZone.get(ticket.zoneId);
    if (!best || ticket.price < best.price) {
      winnerByZone.set(ticket.zoneId, {
        supplier: ticketSupplier(ticket, eventType),
        price: ticket.price,
      });
    }
  }
  return tickets.filter(
    (ticket) =>
      !ticket.zoneId ||
      winnerByZone.get(ticket.zoneId)?.supplier ===
        ticketSupplier(ticket, eventType),
  );
}

/**
 * Below this premium (percent over the split price) "all together" is the
 * option the card opens on; above it the cheaper split is (Dor, 23.09).
 */
export const TOGETHER_DEFAULT_MAX_PREMIUM_PCT = 15;

export const preferTogether = (togetherPrice: number, splitPrice: number) =>
  splitPrice > 0 &&
  ((togetherPrice - splitPrice) / splitPrice) * 100 <
    TOGETHER_DEFAULT_MAX_PREMIUM_PCT;

/** The two ways one zone can seat the party, when two suppliers differ on it. */
export type SeatingOptions<T extends PricedTicket = PricedTicket> = {
  together: T;
  split: T;
};

export type ZoneOffer<T extends PricedTicket = PricedTicket> = T & {
  seatingOptions?: SeatingOptions<T>;
};

const isSplit = (ticket: PricedTicket) =>
  ticket.seating === "groups" || ticket.seating === "pairs";

/**
 * What the ticket list shows: one supplier per zone (`cheapestSupplierPerZone`),
 * except when the party is bigger than a pair and the zone's cheapest offer
 * SPLITS it (LiveTickets' pairs + a triple) while another supplier seats it
 * all TOGETHER for more (a TixStock listing sold whole) - then the customer
 * chooses (Alon 23.09): one card, a together / split toggle, both prices.
 * The card opens on "together" when it costs under
 * `TOGETHER_DEFAULT_MAX_PREMIUM_PCT` more, else on the cheaper split. The
 * option shown is the ticket in the list; `seatingOptions` carries both.
 */
export function zoneOffers<T extends PricedTicket>(
  tickets: T[],
  eventType: EventType | undefined,
  qty: number,
): ZoneOffer<T>[] {
  const kept = cheapestSupplierPerZone(tickets, eventType);
  if (qty <= 2) return kept;

  return kept.map((ticket) => {
    if (!ticket.zoneId || !isSplit(ticket)) return ticket;
    const zone = tickets.filter((t) => t.zoneId === ticket.zoneId);
    const cheapest = zone.reduce((min, t) => (t.price < min.price ? t : min));
    // Only the zone's cheapest offer gets the choice - once.
    if (cheapest.id !== ticket.id) return ticket;
    const supplier = ticketSupplier(ticket, eventType);
    const together = zone
      .filter(
        (t) =>
          t.seating === "together" &&
          t.price > ticket.price &&
          ticketSupplier(t, eventType) !== supplier,
      )
      .reduce<T | null>((min, t) => (!min || t.price < min.price ? t : min), null);
    if (!together) return ticket;

    const seatingOptions = { together, split: ticket };
    const shown = preferTogether(together.price, ticket.price) ? together : ticket;
    return { ...shown, seatingOptions };
  });
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
