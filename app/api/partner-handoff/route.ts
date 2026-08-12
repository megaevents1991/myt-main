import { NextResponse } from "next/server";
import {
  getPartnerProfile,
  PARTNER_SESSION_COOKIE,
  verifyPartnerSession,
} from "@/lib/partner-auth";
import {
  createPartnerSession,
  PARTNER_SESSION_MAX_AGE,
} from "@/lib/partner-auth/session";

/**
 * Lands a backoffice-portal agent here WITH their identity: the portal mints a
 * short-lived token in this app's exact `partner_session` format (signed with
 * the SAME `NEXT_SECRET_SESSION_SECRET` - see the backoffice's
 * lib/auth/partner-handoff.ts), this route swaps it for our own week-long
 * httpOnly cookie and redirects into the order flow.
 *
 * Why: agent-mode settlement (`agent_card`/`voucher` in confirm-order's
 * resolveAgentSettlement) requires `requireAgent()` - a live session on THIS
 * domain. Partners sign in only to the backoffice since the portal moved back
 * there (2026-08-02), so without this bridge both agent-paid methods are
 * always rejected.
 *
 * Failure mode is deliberately soft: a bad/expired token still redirects to
 * `next` - the page works as a plain package link, only the agent-paid
 * settlement stays unavailable. The token itself is already a signed,
 * minutes-lived session value, so verification + the same live-profile
 * re-check the login route does are the whole gate.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const next = url.searchParams.get("next") || "/";

  // Same-origin relative paths only - never an open redirect. Backslash is the
  // classic bypass: the WHATWG URL parser treats "\" like "/" for http(s), so
  // "/\evil.com" resolves to https://evil.com. Belt-and-braces: sanitize, then
  // verify the RESOLVED origin is still ours.
  let safeNext = "/";
  if (next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")) {
    try {
      if (new URL(next, url.origin).origin === url.origin) safeNext = next;
    } catch {
      safeNext = "/";
    }
  }
  const redirectTo = new URL(safeNext, url.origin);

  const session = await verifyPartnerSession(token);
  if (!session) {
    if (token) {
      // A present-but-unverifiable token is almost always secret drift between
      // the two Vercel projects - say so, or the failure is invisible (the
      // redirect still lands on a working plain package link).
      console.error(
        "partner-handoff: token present but failed verification - check NEXT_SECRET_SESSION_SECRET parity between backoffice and main",
      );
    }
    return NextResponse.redirect(redirectTo);
  }

  // Re-verify against the live profile, exactly like login: a deactivated or
  // re-coded partner must not be able to replay a still-unexpired token.
  const profile = await getPartnerProfile(session.sub);
  if (
    !profile ||
    !profile.is_active ||
    profile.role !== session.role ||
    profile.partner_tracking_code !== session.partner_code
  ) {
    return NextResponse.redirect(redirectTo);
  }

  let cookieValue: string;
  try {
    cookieValue = await createPartnerSession({
      sub: profile.id,
      email: profile.email,
      role: profile.role,
      partner_code: profile.partner_tracking_code,
      display_name: profile.display_name,
    });
  } catch (e) {
    console.error("partner-handoff: cannot sign session -", e);
    return NextResponse.redirect(redirectTo);
  }

  const response = NextResponse.redirect(redirectTo);
  response.cookies.set(PARTNER_SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: PARTNER_SESSION_MAX_AGE,
    path: "/",
  });
  return response;
}
