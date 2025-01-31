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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error?.code === "23503") {
      return NextResponse.json({ success: false });
    }
    return NextResponse.json(
      { error: "Failed to track affiliate event" },
      { status: 500 }
    );
  }
}