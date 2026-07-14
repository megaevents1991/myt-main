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

/** Per-event component markups, all per ticket (USD). */
export type ComponentMarkups = {
  ticket: number;
  flight: number;
  hotel: number;
  skipFlight: number;
  skipHotel: number;
};

const asAmount = (v: number | null | undefined): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Composed pricing is ON for an event when ANY of the three component
 * markups is set in the backoffice. With all three empty the event prices
 * exactly as before (global markup + env hotel-skip fee + skip_flight_markup).
 */
export function hasComponentMarkups(event: Event): boolean {
  return (
    event.markup_ticket != null ||
    event.markup_flight != null ||
    event.markup_hotel != null
  );
}

/**
 * Ticket-only override amount, or null when not configured. When non-null AND
 * the customer skips BOTH flight and hotel, the price is exactly
 * ticket_cost + this value — no other markup of any kind. Wins over legacy
 * and composed pricing. 0 is a valid value (sell at cost + 0).
 */
export function getTicketOnlyMarkup(event: Event): number | null {
  const v = event.ticket_only_markup;
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** The ticket-only override applies only when BOTH components are skipped. */
export function isTicketOnlyOverride(
  event: Event,
  flightSkipped: boolean,
  hotelSkipped: boolean,
): boolean {
  return flightSkipped && hotelSkipped && getTicketOnlyMarkup(event) != null;
}

export function getComponentMarkups(event: Event): ComponentMarkups {
  return {
    ticket: asAmount(event.markup_ticket),
    flight: asAmount(event.markup_flight),
    hotel: asAmount(event.markup_hotel),
    skipFlight: asAmount(event.skip_flight_markup),
    skipHotel: asAmount(event.skip_hotel_markup),
  };
}

/**
 * FULL-PACK markup per ticket (catalog cards, package base price).
 * Composed mode: ticket + flight + hotel markups. Legacy: the global 175.
 * `event_additional_markup` adds on top in both modes. An explicit `markup`
 * argument forces the legacy formula with that value (test/override hook).
 */
export function getTotalMarkup(event: Event, markup?: number): number {
  if (markup == null && hasComponentMarkups(event)) {
    const m = getComponentMarkups(event);
    return m.ticket + m.flight + m.hotel + getEventAdditionalMarkup(event);
  }
  return (markup ?? getMarkup()) + getEventAdditionalMarkup(event);
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
  markup?: number,
): number | null {
  // Filter for available tickets only
  const availableTickets = (event.tickets_and_rates || []).filter(
    (ticket) => ticket?.available !== false,
  );

  // If no available tickets, cannot compute price
  if (availableTickets.length === 0) {
    return null;
  }

  // Find minimum ticket price
  const minTicketPrice = Math.min(
    ...availableTickets.map((ticket) => ticket.price),
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
    (ticket) => ticket?.available !== false,
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
