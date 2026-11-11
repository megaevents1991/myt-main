// The real reads of the customer's ticket page (lib/tixstock-booking/ticket-page.ts): the booking by its token, the
// event's name and date from the reservation, the booking's files. Server only.
import { supabase } from "@/lib/supabase";
import { isBookingStatus } from "./rules";
import type { TicketPageDeps } from "./ticket-page";

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

export function realTicketPageDeps(): TicketPageDeps {
  return {
    async loadBookingByToken(token) {
      const { data, error } = await supabase
        .from("ticket_bookings")
        .select("id, reservation_id, status, quantity, listing, released_to_customer_at")
        .eq("customer_token", token)
        .maybeSingle();
      if (error) throw new Error(`ticket_bookings read failed: ${error.message}`);
      if (!data || !isBookingStatus(data.status)) return null;
      return {
        id: String(data.id),
        reservation_id: Number(data.reservation_id),
        status: data.status,
        quantity: Number(data.quantity),
        listing: data.listing,
        released_to_customer_at: text(data.released_to_customer_at),
      };
    },

    async loadEvent(reservationId) {
      const { data, error } = await supabase
        .from("reservations")
        .select("event_order_info")
        .eq("id", reservationId)
        .maybeSingle();
      if (error) throw new Error(`reservations read failed: ${error.message}`);
      const info: { name?: unknown; date?: unknown } = data?.event_order_info ?? {};
      return { name: text(info.name) ?? "", date: text(info.date) ?? "" };
    },

    async loadFiles(bookingId) {
      const { data, error } = await supabase
        .from("ticket_booking_files")
        .select("id, kind, row, seat, url")
        .eq("booking_id", bookingId)
        .order("received_at", { ascending: true });
      if (error) throw new Error(`ticket_booking_files read failed: ${error.message}`);
      return (data ?? []).map((f) => ({
        id: String(f.id),
        kind: String(f.kind),
        row: text(f.row),
        seat: text(f.seat),
        url: text(f.url),
      }));
    },
  };
}
