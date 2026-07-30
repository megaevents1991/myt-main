"use server";

import { requirePartner } from "@/lib/partner-auth";
import { supabase } from "@/lib/supabase";
import { getEvents } from "@/lib/eventsData";
import { partnerLink } from "@/lib/agent-links";
import type { Flight, OrderHotel, OrderTicket } from "@/lib/app.types";

/**
 * Prepared packages — a partner picks a specific ticket+flight+hotel
 * combination through the site's own order flow, then saves it here to get
 * a shareable link that lands a follower on that exact package.
 *
 * This is never a financial commitment on its own — the actual booking still
 * goes through confirm-order's own full validation (price floor, agent
 * settlement, etc.). But confirm-order's price floor deliberately excludes
 * flight/hotel and only floors the ticket against the cheapest category
 * overall, so a saved package is a real, standalone place a partner could
 * otherwise plant a manipulated price with nothing else ever catching it — a
 * package can be opened long after it was made, unlike a normal order where
 * the ticket price came from TicketSelection moments before submitting. So
 * this re-derives the ticket price from the live event rather than trusting
 * the client, and rejects offline flight/hotel prices below their known true
 * inventory cost. A live (Amadeus/Ratehawk) offer has no equivalent ground
 * truth short of a full re-search — same limitation /api/package/[id]
 * documents on the read side — so it's trusted as-is, same as there.
 */

export interface SavePackageInput {
  eventId: number;
  ticket: OrderTicket;
  numberOfEventTickets: number;
  flight?: Flight | null;
  flightSkipped: boolean;
  hotel?: OrderHotel | null;
  hotelSkipped: boolean;
}

export type SavePackageResult = { ok: true; link: string } | { ok: false; error: string };

export async function savePreparedPackage(input: SavePackageInput): Promise<SavePackageResult> {
  const session = await requirePartner();

  const eventId = Number(input.eventId);
  if (!Number.isFinite(eventId)) {
    return { ok: false, error: "אירוע לא תקין" };
  }

  // Re-fetch the live event — never trust the client for whether it still
  // exists at all, even though the ticket/flight/hotel values themselves
  // come from the same selection UI a real customer would use.
  const { events } = await getEvents(eventId);
  const event = events?.[0];
  if (!event) {
    return { ok: false, error: "האירוע לא נמצא או שאינו זמין יותר" };
  }

  const qty = Math.max(1, Math.min(999, Math.floor(input.numberOfEventTickets || 1)));
  if (!input.ticket || typeof input.ticket.category !== "string" || !input.ticket.category) {
    return { ok: false, error: "יש לבחור כרטיס לפני השמירה" };
  }

  // Re-derive both the category's existence AND its price from the live
  // event — never the client-submitted ticket. This is the one component a
  // full, exact revalidation is possible for.
  const liveTicket = (event.tickets_and_rates || []).find(
    (t) => t.category === input.ticket.category && t.available !== false,
  );
  if (!liveTicket) {
    return { ok: false, error: "סוג הכרטיס שנבחר אינו זמין יותר" };
  }

  if (
    !input.flightSkipped &&
    input.flight?.isOffline &&
    input.flight.offlineRawPrice != null &&
    input.flight.price < input.flight.offlineRawPrice
  ) {
    return { ok: false, error: "מחיר הטיסה שנבחרה אינו תקין" };
  }
  if (
    !input.hotelSkipped &&
    input.hotel?.isOffline &&
    input.hotel.offlineRawPrice != null &&
    Number(input.hotel.price) < input.hotel.offlineRawPrice
  ) {
    return { ok: false, error: "מחיר המלון שנבחר אינו תקין" };
  }

  const eventOrderInfo = {
    event_id: event.id,
    date: event.date,
    name: event.name,
    location_name: event.location?.name ?? "",
    number_of_ticket: qty,
    category: liveTicket.category,
    event_type: event.type,
    price_per_ticket: liveTicket.price,
    total_tickets_price: liveTicket.price * qty,
    vendor: liveTicket.vendor,
    id: liveTicket.id,
  };

  // Opaque, unguessable — used in the link and looked up on read instead of
  // the row's sequential id, so packages can't be enumerated.
  const shareToken = crypto.randomUUID();

  const row = {
    share_token: shareToken,
    partner_tracking_code: session.partner_code,
    created_by: session.sub,
    event_id: event.id,
    event_order_info: eventOrderInfo,
    flight_order_info: input.flightSkipped ? null : input.flight ?? null,
    flight_skipped: input.flightSkipped,
    hotel_order_info: input.hotelSkipped ? null : input.hotel ?? null,
    hotel_skipped: input.hotelSkipped,
    num_travelers: qty,
  };

  const { data, error } = await supabase
    .from("prepared_packages")
    .insert(row)
    .select("share_token")
    .single();

  if (error || !data) {
    // error?.message/.code/etc all came back undefined last round, which
    // only happens if error itself is null/undefined (optional chaining
    // short-circuits every property the same way) — meaning !data, not
    // error, is what's tripping this branch. Dump everything raw, including
    // non-enumerable own properties, to settle it in one shot.
    console.error(
      "savePreparedPackage: error=",
      error ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : error,
      "data=",
      JSON.stringify(data),
      "row=",
      JSON.stringify(row),
    );
    return { ok: false, error: "שמירת החבילה נכשלה. נסו שוב." };
  }

  return { ok: true, link: partnerLink(session.partner_code, event.id, data.share_token) };
}
