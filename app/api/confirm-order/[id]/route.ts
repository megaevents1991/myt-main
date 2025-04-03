import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PATCH(request: NextRequest) {
  try {
    // Extract ID from the URL path - Yakov This is not tested yet
    const id = request.url.split('/').pop();
    
    // Extract only payment_info from the request
    const { payment_info } = await request.json();
    
    // Only update the payment_info field
    const { data, error } = await supabase
      .from("reservations")
      .update({ payment_info })
      .eq("id", parseInt(id as string, 10))
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error confirming order:", error);
    return NextResponse.json({ error: "Failed to confirm order" }, { status: 500 });
  }
}