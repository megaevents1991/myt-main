/**
 * "Build Your Euro Trip" - the catalog row the builder ships to the browser. Pure: no I/O.
 *
 * The builder page hands every eligible event to the client (~400 rows). A full row carries
 * every ticket category, descriptions, maps and campaign art the builder never reads: 1.6 MB of
 * RSC data. This keeps only what the builder reads - the rules (geo / lodging), the price
 * estimate and card price (`lib/events/price.ts`, the ready package), the kind (`isSportsEvent`),
 * sold-out, and the card art - and of the tickets only the cheapest one on sale (its id, category,
 * price, availability), which is all `computePackagePrice` / `cheapestAvailableTicketPrice` look at.
 * The tickets step loads the full rows of the route's own events (`setEventData`).
 */
import type { Event, EventTicket } from "@/lib/app.types";

/** Every field the builder reads; anything else stays on the server. */
const KEEP = [
  // identity, kind, search
  "id",
  "name",
  "name_english",
  "type",
  "date",
  "tags",
  // geography + lodging (lib/itinerary/geo.ts, lib/events/lodging.ts)
  "location",
  "event_location",
  "lodging_mode",
  "lodging_default",
  "lodging_note",
  "split_default_nights",
  // the package's own stay (estimateItinerary) and prices (lib/events/price.ts)
  "def_date_depart",
  "def_date_return",
  "base_flight_price",
  "base_hotel_price",
  "markup_ticket",
  "markup_flight",
  "markup_hotel",
  "skip_flight_markup",
  "skip_hotel_markup",
  "event_additional_markup",
  "package_mode",
  "ticket_only_markup",
  "ready_package_mode",
  "ready_package_price_usd",
  "ready_package_token",
  "locked_flight_sold_out",
  // card art (components/euro-trip/build/TripEventArt.tsx)
  "match_home_logo_url",
  "match_away_logo_url",
  "art_image_url",
  "card_image_url",
  "art_color_index",
  "art_shape_index",
  "art_image_scale",
  "art_bg_scale",
  "art_image_offset_x",
  "art_image_offset_y",
] as const satisfies readonly (keyof Event)[];

/** The cheapest ticket on sale (the first of equal prices), the same filter as `cheapestAvailableTicketPrice`. */
function cheapestOnSale(
  tickets: EventTicket[] | null | undefined,
): EventTicket | null {
  let best: EventTicket | null = null;
  for (const t of tickets ?? []) {
    if (t?.available === false) continue;
    if (!best || t.price < best.price) best = t;
  }
  return best;
}

/** `e` with only the fields the builder reads, and only its cheapest ticket on sale. */
export function slimTripEvent(e: Event): Event {
  const out: Record<string, unknown> = {};
  for (const k of KEEP) if (e[k] !== undefined) out[k] = e[k];
  const ticket = cheapestOnSale(e.tickets_and_rates);
  // Of that ticket only what the prices read (no description, map colour, VIP or supplier data).
  out.tickets_and_rates = ticket
    ? [
        {
          id: ticket.id,
          category: ticket.category,
          price: ticket.price,
          ...(ticket.available !== undefined && {
            available: ticket.available,
          }),
        },
      ]
    : [];
  // Cast once, at this boundary: a partial row the builder treats as an Event. Every field
  // the builder reads is above (lib/__tests__/itinerarySlim.test.ts checks the results match).
  return out as unknown as Event;
}
