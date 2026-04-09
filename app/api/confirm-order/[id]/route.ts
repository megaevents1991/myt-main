import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * @deprecated
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Extract only payment_info from the request
    const { payment_info } = await request.json();

    // Only update the payment_info field
    const { data, error } = await supabase
      .from("reservations")
      .update({ payment_info })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error confirming order:", error);
    return NextResponse.json(
      { error: "Failed to confirm order" },
      { status: 500 }
    );
  }
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", id)
      .limit(1)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching order data:", error);
    return NextResponse.json(
      { error: "Failed to fetch order data", orderId: id },
      { status: 200 }
    );
  }
}
