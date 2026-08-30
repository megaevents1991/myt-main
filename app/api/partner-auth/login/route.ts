import { NextResponse } from "next/server";
import {
  verifyPassword,
  getPartnerProfile,
  newPortalSessionId,
  setPortalSessionId,
  PARTNER_SESSION_COOKIE,
  toEffectiveRole,
} from "@/lib/partner-auth";
import {
  createPartnerSession,
  PARTNER_SESSION_MAX_AGE,
} from "@/lib/partner-auth/session";
import {
  checkLoginRateLimit,
  getRequestIp,
  recordFailedLogin,
} from "@/lib/partner-auth/rate-limit";

/**
 * Partner sign-in for the agent/influencer area.
 *
 * Replaces `/api/affiliate/login`, which selected `*` from a credentials table
 * and compared `partners.password` in plain text with `.eq()`. There was no
 * session at all - the client flipped a boolean, so a refresh logged you out
 * and no server route ever knew who was calling.
 *
 * Identity is Supabase Auth, the same account the backoffice creates.
 */
export async function POST(request: Request) {
  let email: string;
  let password: string;
  try {
    const body = await request.json();
    email = String(body?.email ?? "")
      .trim()
      .toLowerCase();
    password = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json(
      { error: "יש להזין אימייל וסיסמה" },
      { status: 400 },
    );
  }

  const ip = getRequestIp(request);
  const rateLimit = await checkLoginRateLimit(email, ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "יותר מדי ניסיונות התחברות. נסו שוב מאוחר יותר." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const verified = await verifyPassword(email, password);
  if (!verified.ok) {
    if (verified.reason === "transient") {
      // Not a credentials verdict - say so, or the partner resets a good password.
      return NextResponse.json(
        { error: "השירות עמוס כרגע. נסו שוב בעוד רגע." },
        { status: 429 },
      );
    }
    await recordFailedLogin(email, ip);
    return NextResponse.json(
      { error: "אימייל או סיסמה שגויים" },
      { status: 401 },
    );
  }

  const profile = await getPartnerProfile(verified.userId);
  // Same message for "not a partner", "no profile" and "disabled": a login form
  // must not confirm which accounts exist or what role they hold.
  if (!profile || !profile.is_active) {
    await recordFailedLogin(email, ip);
    return NextResponse.json(
      { error: "אימייל או סיסמה שגויים" },
      { status: 401 },
    );
  }

  // office_manager is the backoffice's manager-of-agents role; on main it IS
  // an agent - map it before minting the session, or a direct office_manager
  // login would encode role "office_manager" into the cookie and
  // verifyPartnerSession would then reject it on the very next request
  // (PARTNER_ROLES only allows "agent" | "affiliate").
  const effectiveRole = toEffectiveRole(profile.role);

  // Signing throws when NEXT_SECRET_SESSION_SECRET is unset. Unwrapped it
  // becomes a 500 that the form reports as "login failed", sending everyone
  // to check their password over a missing env var.
  // One live partner login at a time, across BOTH apps: this claims the same
  // `user_profiles.portal_session_id` the backoffice portal writes, and
  // requirePartner refuses any session whose id is no longer the current one.
  const sid = newPortalSessionId();
  await setPortalSessionId(profile.id, sid);

  let cookieValue: string;
  try {
    cookieValue = await createPartnerSession({
      sub: profile.id,
      email: profile.email,
      role: effectiveRole,
      partner_code: profile.partner_tracking_code,
      display_name: profile.display_name,
      sid,
    });
  } catch (e) {
    console.error("partner login: cannot sign session -", e);
    return NextResponse.json(
      { error: "ההתחברות אינה זמינה כרגע. פנו אלינו." },
      { status: 503 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    role: effectiveRole,
    display_name: profile.display_name,
  });
  response.cookies.set(PARTNER_SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: PARTNER_SESSION_MAX_AGE,
    path: "/",
  });
  return response;
}
