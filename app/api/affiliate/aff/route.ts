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

// utm_source doubles as the partner code, so plain marketing sources
// ("facebook", "google", "ig"...) land here too - ~1,600 inserts a day that
// could only ever fail the partners FK (measured 2026-09-17). A code that
// failed the FK is remembered per instance and skipped without touching the DB;
// the TTL is short so a partner created in the backoffice starts tracking
// within minutes.
const NON_PARTNER_TTL_MS = 10 * 60_000;
const NON_PARTNER_MAX = 500;
const nonPartnerUntil = new Map<string, number>();

function isKnownNonPartner(code: string): boolean {
  const until = nonPartnerUntil.get(code);
  if (until === undefined) return false;
  if (until > Date.now()) return true;
  nonPartnerUntil.delete(code);
  return false;
}

function rememberNonPartner(code: string): void {
  if (nonPartnerUntil.size >= NON_PARTNER_MAX) nonPartnerUntil.clear();
  nonPartnerUntil.set(code, Date.now() + NON_PARTNER_TTL_MS);
}

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

  if (isKnownNonPartner(affId)) {
    return NextResponse.json({ success: false });
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
      rememberNonPartner(affId);
      return NextResponse.json({ success: false });
    }
    return NextResponse.json(
      { error: "Failed to track affiliate event" },
      { status: 500 }
    );
  }
}