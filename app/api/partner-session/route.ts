import { NextResponse } from "next/server";
import {
  PARTNER_SESSION_COOKIE,
  getPartnerSession,
  requirePartner,
} from "@/lib/partner-auth";

// Tiny cookie→JSON bridge for client components: the partner_session cookie
// is httpOnly, and reading it server-side in the ROOT layout would force every
// page dynamic (killing ISR on event pages) - so the header badge asks here
// after hydration instead (V2 spec 2026-08-27: "על התפריט העליון יהיה לו
// אזכור שהוא מחובר"). Returns only display fields, never the signed cookie.
export const dynamic = "force-dynamic";

export async function GET() {
  const noStore = { headers: { "Cache-Control": "no-store" } };
  try {
    // requirePartner, not getPartnerSession: since 2026-08-30 the badge must
    // reflect the BACKOFFICE login, so the profile (is_active, tracking code
    // and the portal login id) is re-read here rather than trusting the
    // cookie. A partner who signed out of the portal, or signed in as someone
    // else, stops being "connected" on the very next page view - doc items
    // 1-3, "סוכן שלא מחובר בבק אופיס אם גולש באתר זה לא כסוכן".
    const session = await requirePartner();
    return NextResponse.json(
      {
        connected: true,
        role: session.role,
        name: session.display_name ?? null,
        code: session.partner_code,
      },
      noStore,
    );
  } catch {
    // Not connected. If a cookie is still sitting there, drop it so the
    // browser stops sending a session nothing will honor again.
    const response = NextResponse.json({ connected: false }, noStore);
    try {
      if (await getPartnerSession()) {
        response.cookies.set(PARTNER_SESSION_COOKIE, "", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 0,
          path: "/",
        });
      }
    } catch {
      // A malformed cookie verifies to null - nothing to clear.
    }
    return response;
  }
}

/**
 * "יציאה ממצב סוכן" - leave agent mode in THIS browser (the badge's exit
 * button). Deliberately does NOT release the shared portal login id: the agent
 * is still signed in to the backoffice, and clearing it would break their next
 * handoff. Only the cookie here dies.
 */
export async function DELETE() {
  const response = NextResponse.json(
    { connected: false },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(PARTNER_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
