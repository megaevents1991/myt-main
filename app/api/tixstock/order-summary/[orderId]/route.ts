/**
 * What the confirmation page of a TixStock SANDBOX test order shows about its tickets:
 * `GET /api/tixstock/order-summary/<orderId>` -> `{ state, ticketType, restrictions, deliveryDate }`.
 *
 * Answers only for a reservation the SITE booked (`ticket_bookings.source = 'site'` - the hidden test checkout);
 * every other order id, every real one included, is a 404. It hands out no token, no link and no file: the ticket
 * page link goes to the customer by e-mail only.
 */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isBookingStatus, readListingSnapshot } from "@/lib/tixstock-booking/rules";
import { summaryState } from "@/lib/tixstock-booking/ticket-page";

export const dynamic = "force-dynamic";

const answer = (body: Record<string, unknown>, status: number) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }): Promise<Response> {
  const { orderId } = await params;
  const reservationId = Number(orderId);
  if (!/^\d{1,12}$/.test(orderId) || !Number.isInteger(reservationId) || reservationId < 1) return answer({ error: "not_found" }, 404);

  try {
    const { data, error } = await supabase
      .from("ticket_bookings")
      .select("status, listing, link_email_sent_at")
      .eq("reservation_id", reservationId)
      .eq("source", "site")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[tixstock-order-summary] read failed:", JSON.stringify(error));
      return answer({ error: "internal" }, 500);
    }
    if (!data || !isBookingStatus(data.status)) return answer({ error: "not_found" }, 404);

    const listing = readListingSnapshot(data.listing);
    return answer(
      {
        state: summaryState(data.status, typeof data.link_email_sent_at === "string" ? data.link_email_sent_at : null),
        ticketType: listing.ticketType,
        restrictions: listing.restrictions,
        deliveryDate: listing.deliveryDate,
      },
      200,
    );
  } catch (e) {
    console.error("[tixstock-order-summary] failed:", e instanceof Error ? e.message : String(e));
    return answer({ error: "internal" }, 500);
  }
}
