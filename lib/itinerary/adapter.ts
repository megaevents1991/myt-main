/**
 * "Build Your Euro Trip" - the tickets step's side of the live ticket step. Pure: no I/O, no clock.
 *
 * The trip renders the order flow's own `TicketSelection` (app/order/TicketSelection.tsx,
 * unchanged) once per event, inside an `OrderContext.Provider` whose value the trip builds
 * (components/euro-trip/build/orderContextAdapter.ts). These are the values that adapter hands
 * the step, and the rules around them: which ticket counts as picked, which rows the step may
 * open on, and which ids the Server Action that loads them accepts.
 */
import type { Event, OrderTicket } from "@/lib/app.types";
import type { OrderResume } from "@/lib/order/draft";
import { isItineraryEligible } from "./eligibility";

/**
 * A trip holds at most three events (settings' `max_events` is 2-3): the Server Action never
 * loads more in one call, and the tickets step never asks for more in one call - so the
 * action never cuts an ask short, and an id it did not answer really is gone.
 */
export const MAX_TRIP_LOAD = 3;

/**
 * What the ticket step reads from the order's context, for one event of the trip: the event,
 * its ticket, the trip's party size as the quantity - and a plain visit in every other respect
 * (no summary edit, no ready package, no person-page link).
 *
 * `held` = the ticket id this tab opened on. The step selects the cheapest ticket whenever it
 * mounts, unless the order context hands it a ticket to resume (`orderResume`, the refresh
 * draft's rule): so a tab the customer comes back to keeps their pick (while it still sells
 * for the party), and a hand pick inside the tab still wins over it. It must be read ONCE per
 * mount - a resume id that followed every pick would re-run the step's auto-select and undo
 * the pick.
 */
export function ticketAdapterFields(i: {
  event: Event;
  ticket: OrderTicket | undefined;
  pax: number;
  held?: string;
}): {
  event: Event;
  eventTicket: OrderTicket | undefined;
  numberOfEventTickets: number;
  returnToSummary: false;
  readyPackage: undefined;
  personLink: undefined;
  orderResume: Extract<OrderResume, { step: 1 }> | undefined;
} {
  return {
    event: i.event,
    eventTicket: i.ticket,
    numberOfEventTickets: i.pax,
    returnToSummary: false,
    readyPackage: undefined,
    personLink: undefined,
    orderResume: i.held ? { step: 1, ticketId: i.held } : undefined,
  };
}

/**
 * The ticket the step handed back, as the trip keeps it. When nothing sells at the quantity
 * the step writes a blank ticket (`id: ""`, quantity 0) to clear its order - for the trip
 * that is no ticket.
 */
export function ticketFromStep(t: OrderTicket | undefined): OrderTicket | undefined {
  return t?.id ? t : undefined;
}

/** A pick for this trip: a real ticket, bought for the trip's party size. */
export function ticketReady(t: OrderTicket | undefined, pax: number): boolean {
  return !!t?.id && t.quantity === pax;
}

/** Every event of the route has its ticket for the party - the tickets step may be left. */
export function allTicketsReady(
  route: Event[],
  tickets: Record<number, OrderTicket | undefined>,
  pax: number,
): boolean {
  return route.length > 0 && route.every((e) => ticketReady(tickets[e.id], pax));
}

/** The ids a caller asked for (untrusted - a Server Action's input): whole and positive, once each, at most three. */
export function tripEventIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const ids: number[] = [];
  for (const v of raw) {
    if (typeof v !== "number" || !Number.isSafeInteger(v) || v <= 0 || ids.includes(v)) continue;
    ids.push(v);
    if (ids.length === MAX_TRIP_LOAD) break;
  }
  return ids;
}

/**
 * The catalog's full rows for `ids`, in that order - only events a trip may hold today
 * (`isItineraryEligible`, the builder page's own filter). An id it leaves out is gone.
 */
export function pickTripEvents(events: Event[], ids: number[], todayIso: string): Event[] {
  const byId = new Map(events.map((e) => [e.id, e]));
  return ids.flatMap((id) => {
    const e = byId.get(id);
    return e && isItineraryEligible(e, todayIso) ? [e] : [];
  });
}

/**
 * The ids that left the catalog: asked, not in the answer - and still in the route NOW (the
 * answer can land after the customer took that event out; then there is nothing to say).
 */
export function goneIds(asked: number[], rows: Event[], routeIds: number[]): number[] {
  return asked.filter((id) => routeIds.includes(id) && !rows.some((r) => r.id === id));
}

/**
 * The step re-opens a tab on the ticket it held, but a category that cannot sell the party
 * (another size was picked meanwhile, or its seats went) falls back to the cheapest that
 * does: said in words, never swapped in silence. `picked` = the ticket the step put in on
 * its own (not a hand pick); null = nothing to say.
 */
export function categorySwapNotice(
  held: Pick<OrderTicket, "id" | "category" | "zoneLabel"> | undefined,
  picked: string | undefined,
  pax: number,
): string | null {
  if (!held?.id || !picked || picked === held.id) return null;
  const size = pax === 1 ? "לכרטיס אחד" : `ל-${pax} כרטיסים`;
  return `הקטגוריה שבחרתם (${held.zoneLabel || held.category}) לא זמינה ${size} - בחרנו את הזולה ביותר שזמינה. אפשר להחליף.`;
}

/**
 * The builder's catalog is slim (lib/itinerary/slim.ts: one ticket, no map), so the ticket
 * step may open only on a row the tickets step loaded whole. The mark is a symbol: it rides
 * along the step's own live-price write (`{ ...event, tickets_and_rates }`) and is dropped by
 * JSON, so a row that went through storage is loaded again rather than trusted.
 */
const FULL_ROW: unique symbol = Symbol("itinerary.fullRow");
type Marked = Event & { [FULL_ROW]?: true };

/** A copy of `e` marked as a whole row. */
export function asFullRow(e: Event): Event {
  const out: Marked = { ...e, [FULL_ROW]: true };
  return out;
}

/** Was this row loaded whole (and not a catalog row)? */
export function isFullRow(e: Event): boolean {
  return (e as Marked)[FULL_ROW] === true;
}
