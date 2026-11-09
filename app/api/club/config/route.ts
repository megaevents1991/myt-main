import { NextResponse } from "next/server";
import { getClubSettings } from "@/lib/club/settings-server";

export const dynamic = "force-dynamic";

/**
 * What the order summary needs before it decides between the club and today's popup. The amount is NOT here:
 * the visitor learns it only after joining (Dor, 09.11). An unreadable setting answers enabled: false.
 */
export async function GET() {
  const s = await getClubSettings();
  return NextResponse.json(
    { enabled: s.enabled, popupDelaySeconds: s.popup_delay_seconds },
    { headers: { "Cache-Control": "no-store" } },
  );
}
