import { supabase } from "@/lib/supabase";
import type { Event } from "@/lib/app.types";
import {
  hasOwnStock,
  seatsHeldByTicket,
  stockLeft,
  type StockReservation,
} from "@/lib/own-stock";

/**
 * Seats held per ticket id, per event, by live reservations - the count our
 * own tickets' stock is measured against (lib/own-stock.ts). Soft-deleted
 * reservations hold nothing.
 *
 * @returns null when the read failed - callers decide which way to fail.
 */
export async function loadSeatsHeld(
  eventIds: number[],
): Promise<Map<number, Map<string, number>> | null> {
  if (eventIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("reservations")
    .select("event_id, status, event_order_info")
    .in("event_id", eventIds)
    .is("is_deleted", null);
  if (error) {
    console.error("[OwnStock] reservations read failed:", JSON.stringify(error));
    return null;
  }

  const byEvent = new Map<number, StockReservation[]>();
  for (const row of (data ?? []) as (StockReservation & { event_id: number })[]) {
    const list = byEvent.get(row.event_id) ?? [];
    list.push(row);
    byEvent.set(row.event_id, list);
  }
  return new Map(
    eventIds.map((id) => [id, seatsHeldByTicket(byEvent.get(id) ?? [])]),
  );
}

/**
 * Our own tickets whose seats are all taken go off sale in the catalog, so a
 * sold-out one never sets an event's "from" price or keeps a sold-out event
 * looking bookable. Runs once per events load (inside the hourly cache) and
 * costs nothing when no event holds own stock. The order page and
 * confirm-order re-count fresh - this is the catalog's view, up to an hour old.
 *
 * Fails open: a failed read leaves every ticket as the backoffice saved it.
 */
export async function markOwnStockSoldOut(events: Event[]): Promise<Event[]> {
  const stocked = events.filter((event) =>
    (event.tickets_and_rates ?? []).some(hasOwnStock),
  );
  if (stocked.length === 0) return events;

  const held = await loadSeatsHeld(stocked.map((event) => event.id));
  if (!held) return events;

  return events.map((event) => {
    const eventHeld = held.get(event.id);
    if (!eventHeld) return event;
    let changed = false;
    const tickets = event.tickets_and_rates.map((ticket) => {
      if (ticket.available === false || stockLeft(ticket, eventHeld) !== 0) {
        return ticket;
      }
      changed = true;
      return { ...ticket, available: false };
    });
    return changed ? { ...event, tickets_and_rates: tickets } : event;
  });
}
