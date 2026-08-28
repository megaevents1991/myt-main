import { NextResponse } from "next/server";
import { getPartnerSession } from "@/lib/partner-auth";

// Tiny cookie→JSON bridge for client components: the partner_session cookie
// is httpOnly, and reading it server-side in the ROOT layout would force every
// page dynamic (killing ISR on event pages) - so the header badge asks here
// after hydration instead (V2 spec 2026-08-27: "על התפריט העליון יהיה לו
// אזכור שהוא מחובר"). Returns only display fields, never the signed cookie.
export const dynamic = "force-dynamic";

export async function GET() {
  const noStore = { headers: { "Cache-Control": "no-store" } };
  try {
    const session = await getPartnerSession();
    if (!session) return NextResponse.json({ connected: false }, noStore);
    return NextResponse.json(
      {
        connected: true,
        role: session.role,
        name: session.display_name ?? null,
        code: session.partner_code,
      },
      noStore,
    );
  } catch (error) {
    console.error("partner-session read failed:", error);
    return NextResponse.json({ connected: false }, noStore);
  }
}
