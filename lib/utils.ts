import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Event, EventTicket } from "./app.types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Check if an event has any available tickets
 * A ticket is considered available if its `available` field is not explicitly set to `false`
 * (undefined or true both count as available)
 */
export function hasAvailableTickets(event: Event | undefined | null): boolean {
  if (!event?.tickets_and_rates || event.tickets_and_rates.length === 0) {
    return false;
  }
  
  return event.tickets_and_rates.some(
    (ticket: EventTicket) => ticket?.available !== false
  );
}

/**
 * Get all available tickets from an event
 * Filters out tickets where `available` is explicitly set to `false`
 */
export function getAvailableTickets(event: Event | undefined | null): EventTicket[] {
  if (!event?.tickets_and_rates) {
    return [];
  }
  
  return event.tickets_and_rates.filter(
    (ticket: EventTicket) => ticket?.available !== false
  );
}
