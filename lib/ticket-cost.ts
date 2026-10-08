/**
 * The supplier cost of the ticket on a new order, snapshotted into
 * `reservations.ticket_cost_usd` / `ticket_cost_source = 'live'` (backoffice migration
 * 20261008120000; the marketing P&L reads it). Only where the cost is in reach at confirm
 * time: LiveTickets (the live offer) and TixStock (the live feed, re-read on the server).
 * Anything else returns null and the backoffice estimates it overnight. Never throws -
 * a cost we could not read must never fail a checkout.
 */
import { getLiveTicketsOffers } from "@/lib/livetickets";
import { seatingSplit } from "@/lib/livetickets-quantity";
import { cheapestListingCostUsd } from "@/lib/tixstock-feed";

export type TicketCostSnapshot = { ticket_cost_usd: number; ticket_cost_source: "live" } | null;

/** How long confirm-order waits for the snapshot before saving the order without it. */
export const TICKET_COST_DEADLINE_MS = 3_000;

/**
 * The promise's value, or null once `ms` have passed - whichever comes first. The
 * promise itself keeps running (a read, nothing to undo); its late answer is dropped.
 * Used so a slow supplier can never hold a checkout up: the nightly estimate in the
 * backoffice covers a miss.
 */
export function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[ticket-cost] gave up after ${ms} ms, saving the order without a cost`);
      resolve(null);
    }, ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

export async function snapshotTicketCost(
  info: {
    supplier?: string;
    supplier_event_id?: string;
    id?: string;
    number_of_ticket?: number;
    /** The live-matching key of a TixStock ticket (`EventTicket.category`). */
    category?: string;
    supplier_category?: string;
    seating_choice?: string;
  },
  eventId: number,
  deps = { getLiveTicketsOffers, cheapestListingCostUsd },
): Promise<TicketCostSnapshot> {
  try {
    const qty = Math.max(1, Number(info.number_of_ticket) || 1);
    const round = (n: number) => Math.round(n * 100) / 100;
    if (info.supplier === "livetickets" && info.supplier_event_id) {
      const offers = await deps.getLiveTicketsOffers(info.supplier_event_id);
      const offer = offers?.find((o) => o.id === info.id);
      if (!offer || !(offer.costUsd > 0)) return null;
      // An odd party seated in a triple also carries LiveTickets' group fee on
      // that triple's three tickets - the same rule the price is built with
      // (`liveTicketsPriceForQuantity`), here on the cost side.
      const tripleFee = seatingSplit(offer, qty)?.includes(3) ? (offer.tripleFeeCostUsd || 0) * 3 : 0;
      return { ticket_cost_usd: round(offer.costUsd * qty + tripleFee), ticket_cost_source: "live" };
    }
    if (info.supplier === "tixstock" && info.supplier_event_id) {
      const perTicket = await deps.cheapestListingCostUsd({
        tixstockEventId: info.supplier_event_id,
        eventId,
        ticketId: info.id ?? null,
        category: info.category ?? info.supplier_category ?? null,
        quantity: qty,
        together: info.seating_choice === "together",
      });
      return perTicket !== null && perTicket > 0 ? { ticket_cost_usd: round(perTicket * qty), ticket_cost_source: "live" } : null;
    }
    return null;
  } catch (error) {
    console.warn("[ticket-cost] snapshot skipped:", error instanceof Error ? error.message : String(error));
    return null;
  }
}
