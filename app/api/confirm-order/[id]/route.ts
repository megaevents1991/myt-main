import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// NOTE: The deprecated, unauthenticated PATCH handler was removed — it let anyone
// overwrite any reservation's payment_info by sequential id. Payment status is
// written server-side only by /api/payment/[id]/[txId]/[promoCode].
//
// The GET below still backs the post-payment confirmation page. It is keyed by a
// sequential id (IDOR surface), so it returns ONLY the order-summary fields the
// confirmation page renders — never main_contact/passenger PII or the raw
// CreditGuard payment_info blob. Full fix: gate by an unguessable per-order token
// (not the sequential id) — tracked as a follow-up.

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { data, error } = await supabase
      .from("reservations")
      .select(
        "event_id, event_order_info, flight_order_info, hotel_order_info, booking_reference, aff_partner_tracking_code, final_purchase_price_ils, payment_info"
      )
      .eq("id", id)
      .limit(1)
      .single();

    if (error) throw error;

    // The confirmation page only checks whether payment_info is non-empty (to
    // label the method Phone vs CreditCard). Collapse the raw gateway response to
    // a boolean marker so the CreditGuard payload never leaves the server.
    const isPaid =
      !!data.payment_info && Object.keys(data.payment_info).length > 0;

    return NextResponse.json({
      ...data,
      payment_info: isPaid ? { paid: true } : {},
    });
  } catch (error) {
    console.error("Error fetching order data:", error);
    return NextResponse.json(
      { error: "Failed to fetch order data", orderId: id },
      { status: 200 }
    );
  }
}
