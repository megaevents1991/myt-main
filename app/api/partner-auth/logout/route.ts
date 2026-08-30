import { NextResponse } from "next/server";
import {
  clearPortalSessionId,
  getPartnerSession,
  PARTNER_SESSION_COOKIE,
} from "@/lib/partner-auth";

export async function POST() {
  // Release the shared login id too (user_profiles.portal_session_id), so a
  // logout here also ends agent mode anywhere else that handed off from the
  // same login - the mirror of the backoffice's portal logout.
  try {
    const session = await getPartnerSession();
    if (session) await clearPortalSessionId(session.sub, session.sid);
  } catch (error) {
    // Never block the logout on bookkeeping - the cookie still dies below.
    console.error("partner logout: clearing the login id failed -", error);
  }

  const response = NextResponse.json({ ok: true });
  // Expire rather than delete so the browser definitely drops it.
  response.cookies.set(PARTNER_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
