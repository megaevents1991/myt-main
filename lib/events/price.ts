import { Event } from "@/lib/app.types";

/**
 * Default markup value for package pricing.
 * Can be overridden via NEXT_PUBLIC_MARKUP environment variable.
 */
const DEFAULT_MARKUP = 175;

/**
 * Gets the markup value from environment or falls back to default.
 * Parsed once and memoized.
 */
export function getMarkup(): number {
  return Number(process.env.NEXT_PUBLIC_MARKUP) || DEFAULT_MARKUP;
}

export function getEventAdditionalMarkup(event: Event): number {
  const additionalMarkup = Number(event.event_additional_markup ?? 0);
  return Number.isFinite(additionalMarkup) ? additionalMarkup : 0;
}

export function getMaxEventAdditionalMarkup(events: Event[]): number {
  return events.reduce(
    (max, event) => Math.max(max, getEventAdditionalMarkup(event)),
    0
  );
}

export function getTotalMarkup(event: Event, markup?: number): number {
  return (markup ?? getMarkup()) + getEventAdditionalMarkup(event);
}

export function getTotalMarkupForEvents(
  events: Event[],
  markup?: number
): number {
  return (markup ?? getMarkup()) + getMaxEventAdditionalMarkup(events);
}

/**
 * Computes the total package price for an event.
 * Returns null if the event has no available tickets.
 * 
 * Price calculation:
 * - Base flight price
 * - Base hotel price  
 * - Minimum ticket price (from available tickets only)
 * - Global markup
 * - Event-specific additional markup
 * 
 * @param event - The event to compute price for
 * @param markup - Optional markup override (defaults to env var or 175)
 * @returns The total package price, or null if no tickets available
 * 
 * @example
 * ```ts
 * const price = computePackagePrice(event);
 * if (price !== null) {
 *   console.log(`Package costs $${price.toLocaleString()}`);
 * } else {
 *   console.log('Sold out');
 * }
 * ```
 */
export function computePackagePrice(
  event: Event,
  markup?: number
): number | null {
  // Filter for available tickets only
  const availableTickets = (event.tickets_and_rates || []).filter(
    (ticket) => ticket?.available !== false
  );

  // If no available tickets, cannot compute price
  if (availableTickets.length === 0) {
    return null;
  }

  // Find minimum ticket price
  const minTicketPrice = Math.min(
    ...availableTickets.map((ticket) => ticket.price)
  );

  const effectiveMarkup = getTotalMarkup(event, markup);

  // Compute total package price
  return (
    event.base_flight_price +
    event.base_hotel_price +
    minTicketPrice +
    effectiveMarkup
  );
}

/**
 * Checks if an event has any available tickets.
 * 
 * @param event - The event to check
 * @returns true if at least one ticket is available
 */
export function hasAvailableTickets(event: Event): boolean {
  return (event.tickets_and_rates || []).some(
    (ticket) => ticket?.available !== false
  );
}

/**
 * Determines if an event should be treated as sold out.
 * An event is sold out if:
 * - It has the "Sold" tag, OR
 * - It has no available tickets
 * 
 * @param event - The event to check
 * @returns true if the event is sold out
 */
export function isEventSoldOut(event: Event): boolean {
  return !hasAvailableTickets(event) || event.tags === "Sold";
}
