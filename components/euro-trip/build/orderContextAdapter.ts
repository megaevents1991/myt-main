import type { ContextType } from "react";

import type { OrderContext } from "@/app/app.context";
import type { Event, OrderTicket } from "@/lib/app.types";
import { ticketAdapterFields } from "@/lib/itinerary/adapter";

type OrderContextValue = ContextType<typeof OrderContext>;

/** What the trip does with the ticket step's writes, for one event. */
export type TicketStepCallbacks = {
  setTicket: (t: OrderTicket | undefined) => void;
  setPax: (n: number) => void;
  setEvent: (e: Event) => void;
  /** Flight and hotels were searched for the old party - they go. */
  clearTravel: () => void;
};

/** The step's minimum-price write is for the order page's own price line; the trip has its own. */
const ignoreMinTicketPrice = (): void => {};

/**
 * The order's context, as the live ticket step (app/order/TicketSelection.tsx) reads it, for
 * one event of the trip. The step reads exactly these fields - `eventTicket, setEventTicket,
 * event, setEvent, setCurrentMinTicketPrice, personLink, returnToSummary, readyPackage,
 * numberOfEventTickets, setNumberOfEventTickets, setPlaneTickets, setFlight, setHotel,
 * orderResume` - and none of the components it draws reads the context. Every other field is
 * left out: nothing on the trip's page reads it.
 *
 * The setters are `cb`'s own functions, not wrappers: the step lists `setEvent`,
 * `setEventTicket` and `setCurrentMinTicketPrice` in its effects' dependencies, so a setter that
 * changed identity on every render would re-run its live-price fetch and its auto-select (which
 * picks the cheapest ticket again, undoing the customer's pick). Keep `cb` stable per event.
 */
export function adapterForEvent(
  i: Parameters<typeof ticketAdapterFields>[0],
  cb: TicketStepCallbacks,
): OrderContextValue {
  const value: Partial<OrderContextValue> = {
    ...ticketAdapterFields(i),
    setEventTicket: cb.setTicket,
    setEvent: cb.setEvent,
    // One party size for the whole trip: the quantity on any card is the trip's travellers.
    setNumberOfEventTickets: cb.setPax,
    setCurrentMinTicketPrice: ignoreMinTicketPrice,
    // The step clears the flight and the hotel when the party changes, and syncs the flight's
    // travellers - for the trip, both mean the flight and the hotels were priced for another party.
    setPlaneTickets: cb.clearTravel,
    setFlight: cb.clearTravel,
    setHotel: cb.clearTravel,
  };
  // The one cast: a partial context the ticket step reads in full (the fields above).
  return value as OrderContextValue;
}
