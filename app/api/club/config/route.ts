import { NextResponse } from "next/server";
import { getClubSettings } from "@/lib/club/settings-server";

export const dynamic = "force-dynamic";

/**
 * What the order summary needs: the switch and, since D16 (the one-tick card), the member price per ticket - the card
 * says "חסכו $X בהזמנה הזאת" before joining. An unreadable setting answers enabled: false.
 */
export async function GET() {
  const s = await getClubSettings();
  return NextResponse.json(
    { enabled: s.enabled, amountPerTicket: s.enabled ? s.discount_per_traveler_usd : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
