/**
 * El Al "with checked bag" variant.
 *
 * For every El Al offer that has no checked bag, the flight search adds a twin
 * offer - same itinerary, same times - priced this much higher PER TRAVELER
 * with the bag included (`virtualOfferType: true`). The two cards used to
 * differ only by a small luggage icon, so an agent building a package in the
 * backoffice portal and a customer building the same one on the site could
 * land on different twins without noticing: $300 apart for two travelers
 * (2026-09-17). The card now says so in words - see FlightTicketCard.
 *
 * Client-safe (no server imports). Mirrored in myt-backoffice
 * `app/portal/packages/new/flight-step.tsx` - keep the two in step.
 */
export const ELAL_CHECKED_BAG_VARIANT_USD = 150;
