import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  createFeedAuthClient,
  STAFF_ROLES,
  type CookieToSet,
} from "@/lib/feed/feedAuth";

/**
 * Email+password login for /product-feed — verified against the SAME
 * Supabase Auth users the backoffice uses (no separate credentials, no
 * self-signup). Only pre-created ACTIVE staff profiles get a session;
 * everyone else is signed out and bounced with an error.
 */
export async function POST(request: Request) {
  const back = (error: string) =>
    NextResponse.redirect(new URL(`/product-feed?error=${error}`, request.url), 303);

  try {
    const form = await request.formData();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) return back("missing");

    const toSet: CookieToSet[] = [];
    const supabaseAuth = await createFeedAuthClient(toSet);
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) return back("credentials");

    const { data: profile, error: profErr } = await supabase
      .from("user_profiles")
      .select("id,role,is_active")
      .eq("id", data.user.id)
      .maybeSingle();
    const isStaff =
      !profErr && profile?.is_active && STAFF_ROLES.includes(profile.role);
    if (!isStaff) {
      await supabaseAuth.auth.signOut().catch(() => {});
      return back("no-account");
    }

    const redirect = NextResponse.redirect(new URL("/product-feed", request.url), 303);
    toSet.forEach(({ name, value, options }) =>
      redirect.cookies.set(name, value, options as Parameters<typeof redirect.cookies.set>[2])
    );
    return redirect;
  } catch (e) {
    console.error("[feed-auth] password login failed:", e);
    return back("oauth");
  }
}
