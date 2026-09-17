import type { EventTicket, EventType } from "@/lib/app.types";

/**
 * Ticket suppliers we can sell from on ONE event page.
 *
 * Historically the supplier was implied by `event.type` (a whole event was
 * TixStock or LiveTickets). A ticket now carries its own `supplier`, so one
 * event can mix several. Adding a supplier = add it here + write its live
 * adapter; nothing else in the order flow names suppliers.
 *
 * Synced with backoffice `lib/suppliers.ts`.
 */
export const SUPPLIERS = ["tixstock", "livetickets", "static"] as const;
export type TicketSupplier = (typeof SUPPLIERS)[number];

/** Suppliers whose price/stock we pull live on the order page. */
export const LIVE_SUPPLIERS = ["tixstock", "livetickets"] as const;
export type LiveSupplier = (typeof LIVE_SUPPLIERS)[number];

const isSupplier = (value: unknown): value is TicketSupplier =>
  typeof value === "string" &&
  (SUPPLIERS as readonly string[]).includes(value);

/**
 * The supplier of a ticket. Tickets saved before the per-ticket field existed
 * fall back to what their event type always meant.
 *
 * LiveTickets-typed events deliberately resolve to "static": their page never
 * pulled live prices (the backoffice cron keeps the DB price fresh), and that
 * behaviour stays unless a ticket opts in with an explicit `supplier`.
 */
export function ticketSupplier(
  ticket: Pick<EventTicket, "supplier">,
  eventType: EventType | undefined,
): TicketSupplier {
  if (isSupplier(ticket.supplier)) return ticket.supplier;
  return eventType === "tx_event" ? "tixstock" : "static";
}

/** The supplier's own event id for a supplier, read from that supplier's tickets. */
export function supplierEventId(
  tickets: EventTicket[],
  supplier: TicketSupplier,
  eventType: EventType | undefined,
): string | null {
  const ticket = tickets.find(
    (t) => t.eid && ticketSupplier(t, eventType) === supplier,
  );
  return ticket?.eid ?? null;
}
