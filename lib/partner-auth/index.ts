// NOTE: no `server-only` guard - the package isn't a dependency here. This
// module reads the service-role client and a signing secret, so it must never
// be imported from a "use client" file. `lib/partner-auth/session.ts` is the
// Edge/middleware-safe half and carries no Supabase import.
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import {
  PARTNER_SESSION_COOKIE,
  verifyPartnerSession,
  type PartnerRole,
  type PartnerSession,
} from "./session";

/**
 * Partner identity for the agent/influencer area.
 *
 * Supabase Auth is the identity provider - the same `auth.users` +
 * `user_profiles` rows the backoffice creates, so an agent has ONE account
 * across both apps. `partners.password` (plain text) is never consulted.
 */

export type VerifyResult =
  | { ok: true; userId: string }
  // Separated on purpose: a rate limit from a shared office IP is not a wrong
  // password, and telling the partner it is sends them to reset a good one.
  | { ok: false; reason: "invalid" | "transient" };

export async function verifyPassword(
  email: string,
  password: string,
): Promise<VerifyResult> {
  const url = process.env.NEXT_SECRET_SUPABASE_URL;
  // Server-side only, so no NEXT_PUBLIC_ prefix. This app previously had no
  // anon key at all - feedAuth builds its client from the service key.
  const anonKey = process.env.NEXT_SECRET_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error("verifyPassword: Supabase URL or anon key is not configured");
    return { ok: false, reason: "transient" };
  }

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data, error } = await anon.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      const status = (error as { status?: number }).status;
      const transient =
        status === 429 || (status !== undefined && status >= 500);
      if (transient)
        console.error("verifyPassword transient:", status, error.message);
      return { ok: false, reason: transient ? "transient" : "invalid" };
    }
    if (!data.user) return { ok: false, reason: "invalid" };
    return { ok: true, userId: data.user.id };
  } catch (e) {
    // Network failure is not a credentials verdict.
    console.error("verifyPassword network failure:", e);
    return { ok: false, reason: "transient" };
  }
}

export type PartnerProfile = {
  id: string;
  email: string;
  display_name: string | null;
  role: PartnerRole;
  partner_tracking_code: string;
  logo_url: string | null;
  is_active: boolean;
};

/**
 * The partner profile for a signed-in user, or null when they are not a
 * partner. Staff are deliberately excluded: this area is scoped by
 * `partner_code`, and staff have none.
 */
export async function getPartnerProfile(
  userId: string,
): Promise<PartnerProfile | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("user_profiles")
    .select(
      "id,email,display_name,role,partner_tracking_code,logo_url,is_active",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("getPartnerProfile:", JSON.stringify(error));
    return null;
  }
  if (!data) return null;
  if (data.role !== "agent" && data.role !== "affiliate") return null;
  if (!data.partner_tracking_code) return null;
  return data as PartnerProfile;
}

/** The verified session from the request cookie, or null. */
export async function getPartnerSession(): Promise<PartnerSession | null> {
  const store = await cookies();
  return verifyPartnerSession(store.get(PARTNER_SESSION_COOKIE)?.value);
}

/**
 * Throws for anyone who is not a signed-in, still-active partner.
 *
 * The cookie lasts a week, so it is NOT the last word: the profile is re-read
 * on every call. Trusting the cookie alone would leave a partner who was
 * deactivated, demoted, or moved to a different tracking code with full access
 * for up to seven days after the change.
 */
export async function requirePartner(): Promise<PartnerSession> {
  const session = await getPartnerSession();
  if (!session) throw new Error("Unauthorized");

  const profile = await getPartnerProfile(session.sub);
  if (
    !profile ||
    !profile.is_active ||
    profile.role !== session.role ||
    profile.partner_tracking_code !== session.partner_code
  ) {
    throw new Error("Unauthorized");
  }
  return session;
}

/**
 * Throws unless the caller is an AGENT.
 *
 * Quotes, booking on a customer's behalf and voucher payment are agent tools -
 * an influencer shares a link and never prices or books for a named customer.
 */
export async function requireAgent(): Promise<PartnerSession> {
  const session = await requirePartner();
  if (session.role !== "agent") throw new Error("Unauthorized");
  return session;
}

export { PARTNER_SESSION_COOKIE, verifyPartnerSession };
export type { PartnerSession, PartnerRole };
