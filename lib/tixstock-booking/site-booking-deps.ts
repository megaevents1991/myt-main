// The real dependencies of the site's sandbox booking (lib/tixstock-booking/site-booking.ts): the events row, the
// SANDBOX client, and the `ticket_bookings` table. Server only. Kept apart from the rules so their tests load no
// database client. Only an order that carries a listing id ever reaches a function here - a real order never does.
import { randomBytes } from "node:crypto";
import type { EventTicket, EventType } from "@/lib/app.types";
import { supabase } from "@/lib/supabase";
import { supplierEventId } from "@/lib/suppliers";
import type { TixStockListing } from "@/lib/tixstock.types";
import type { TixstockCall } from "./client";
import { isBookingStatus } from "./rules";
import type { SiteBookingRow, SiteHoldDeps, SitePaymentDeps } from "./site-booking";
import { sandboxClient } from "./site-env";
import { sendTicketLinkEmail } from "./ticket-link-email";

const NO_CLIENT = { ok: false, kind: "no_answer", detail: "no sandbox client (env not set)" } as const;

export function realSiteHoldDeps(): SiteHoldDeps {
  return {
    async loadEventFlags(eventId) {
      // Read from the row, never from the cached catalog: a flag staff just turned off must stop the next hold.
      const { data, error } = await supabase
        .from("events")
        .select("is_test, tixstock_booking, type, tickets_and_rates, tx_excluded_sections")
        .eq("id", eventId)
        .maybeSingle();
      if (error) {
        console.error("[tixstock-site-booking] events read failed:", JSON.stringify(error));
        return null;
      }
      if (!data) return null;
      const tickets: EventTicket[] = Array.isArray(data.tickets_and_rates) ? data.tickets_and_rates : [];
      const type: EventType | undefined = data.type ?? undefined;
      return {
        is_test: data.is_test === true,
        tixstock_booking: typeof data.tixstock_booking === "string" ? data.tixstock_booking : null,
        tixEventId: supplierEventId(tickets.filter((t) => t?.available !== false), "tixstock", type),
        excludedSections: Array.isArray(data.tx_excluded_sections) ? data.tx_excluded_sections : [],
      };
    },

    async listings(tixEventId) {
      const client = sandboxClient();
      if (!client) return null;
      const answer = await client.listings(tixEventId);
      // The client hands the feed's listings on as it received them; the site's own listing type reads them.
      return answer.ok ? (answer.data as unknown as TixStockListing[]) : null;
    },

    async venueCountry(tixEventId): Promise<TixstockCall<string | null>> {
      const client = sandboxClient();
      return client ? client.eventVenueCountry(tixEventId) : NO_CLIENT;
    },

    async hold(listingId, qty) {
      const client = sandboxClient();
      return client ? client.hold(listingId, qty) : NO_CLIENT;
    },

    async release(holdId, qty) {
      const client = sandboxClient();
      return client ? client.release(holdId, qty) : NO_CLIENT;
    },

    async insertBooking(row) {
      const { error } = await supabase.from("ticket_bookings").insert(row);
      return { error: error ? JSON.stringify(error) : null };
    },

    newToken: () => randomBytes(32).toString("base64url"),
  };
}

const SITE_BOOKING_COLUMNS =
  "id, reservation_id, status, hold_id, listing_id, quantity, listing, price_per_ticket, buyer, attendees, customer_token, link_email_sent_at";

export function realSitePaymentDeps(): SitePaymentDeps {
  return {
    now: () => new Date(),

    async loadSiteBooking(reservationId) {
      const { data, error } = await supabase
        .from("ticket_bookings")
        .select(SITE_BOOKING_COLUMNS)
        .eq("reservation_id", reservationId)
        .eq("source", "site")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`ticket_bookings read failed: ${error.message}`);
      if (!data) return null;
      if (!isBookingStatus(data.status)) throw new Error(`ticket_bookings row ${String(data.id)} has an unknown status`);
      const row: SiteBookingRow = {
        id: String(data.id),
        reservation_id: Number(data.reservation_id),
        status: data.status,
        hold_id: typeof data.hold_id === "string" ? data.hold_id : null,
        listing_id: String(data.listing_id),
        quantity: Number(data.quantity),
        listing: data.listing,
        // A numeric column arrives as a number or a string, by the driver's mood.
        price_per_ticket: data.price_per_ticket === null ? null : Number(data.price_per_ticket),
        buyer: data.buyer,
        attendees: data.attendees,
        customer_token: String(data.customer_token),
        link_email_sent_at: typeof data.link_email_sent_at === "string" ? data.link_email_sent_at : null,
      };
      return row;
    },

    async moveStatus(id, from, to, atIso, patch) {
      const { data, error } = await supabase
        .from("ticket_bookings")
        .update({ ...(patch ?? {}), status: to, updated_at: atIso, ...(to === "approved" ? { approved_at: atIso } : {}) })
        .eq("id", id)
        .eq("status", from)
        .select("id");
      if (error) throw new Error(`ticket_bookings status change failed: ${error.message}`);
      return (data ?? []).length > 0;
    },

    async hold(listingId, qty) {
      const client = sandboxClient();
      return client ? client.hold(listingId, qty) : NO_CLIENT;
    },

    async release(holdId, qty) {
      const client = sandboxClient();
      return client ? client.release(holdId, qty) : NO_CLIENT;
    },

    async addOrder(holdId, qty, body) {
      const client = sandboxClient();
      return client ? client.addOrder(holdId, qty, body) : NO_CLIENT;
    },

    async updateOrder(orderId, body) {
      const client = sandboxClient();
      return client ? client.updateOrder(orderId, body) : NO_CLIENT;
    },

    async loadEventName(reservationId) {
      const { data, error } = await supabase
        .from("reservations")
        .select("event_order_info")
        .eq("id", reservationId)
        .maybeSingle();
      if (error) console.error("[tixstock-site-booking] reservation read failed:", JSON.stringify(error));
      const name: unknown = data?.event_order_info?.name;
      return typeof name === "string" ? name : "";
    },

    async claimLinkEmail(id, atIso) {
      const { data, error } = await supabase
        .from("ticket_bookings")
        .update({ link_email_sent_at: atIso })
        .eq("id", id)
        .is("link_email_sent_at", null)
        .select("id");
      if (error) throw new Error(`ticket_bookings link email claim failed: ${error.message}`);
      return (data ?? []).length > 0;
    },

    async unclaimLinkEmail(id, atIso) {
      const { error } = await supabase
        .from("ticket_bookings")
        .update({ link_email_sent_at: null })
        .eq("id", id)
        .eq("link_email_sent_at", atIso);
      if (error) console.error("[tixstock-site-booking] link email unclaim failed:", JSON.stringify(error));
    },

    sendTicketLinkEmail,
  };
}
