// The real dependencies of the site's sandbox booking (lib/tixstock-booking/site-booking.ts): the events row, the
// SANDBOX client, and the `ticket_bookings` table. Server only. Kept apart from the rules so their tests load no
// database client. Only an order that carries a listing id ever reaches a function here - a real order never does.
import { randomBytes } from "node:crypto";
import type { EventTicket, EventType } from "@/lib/app.types";
import { supabase } from "@/lib/supabase";
import { supplierEventId } from "@/lib/suppliers";
import type { TixStockListing } from "@/lib/tixstock.types";
import type { TixstockCall } from "./client";
import type { SiteHoldDeps } from "./site-booking";
import { sandboxClient } from "./site-env";

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
