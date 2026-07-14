import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Conversion stages the tracker legitimately reports. Reject anything else so
// the public endpoint can't be used to forge arbitrary funnel stages or spam
// junk rows into affiliates_tracking (the stats/commission feed reads this).
// Must match the OrderStage union in app/hooks/Affiliate.tsx.
const VALID_STAGES = new Set([
  "VISIT",
  "EVENT_SELECTED",
  "TICKET_SELECTED",
  "FLIGHT_SELECTED",
  "HOTEL_SELECTED",
  "CONFIRMED",
]);
const MAX_DATA_BYTES = 4096;

export async function POST(request: Request) {
  const { affId, userId, stage, data } = await request.json();

  if (typeof affId !== "string" || affId.length === 0 || affId.length > 200) {
    return NextResponse.json({ error: "Invalid affId" }, { status: 400 });
  }
  // The tracker sends a UUID; cap it so the endpoint can't be used to stuff
  // arbitrarily large junk into the table.
  if (userId != null && (typeof userId !== "string" || userId.length > 200)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }
  if (stage != null && !VALID_STAGES.has(stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }
  if (data != null && JSON.stringify(data).length > MAX_DATA_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

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