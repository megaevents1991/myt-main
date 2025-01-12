import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { affId, userId, stage, data } = await request.json();

  try {
    const { error } = await supabase
      .from('affiliates_tracking')
      .insert({
        affiliate_id: affId,
        user_id: userId,
        stage,
        data
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to track affiliate event:", error);
    return NextResponse.json(
      { error: "Failed to track affiliate event" },
      { status: 500 }
    );
  }
}