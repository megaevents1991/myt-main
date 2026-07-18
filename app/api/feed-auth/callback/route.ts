import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  createFeedAuthClient,
  STAFF_ROLES,
  type CookieToSet,
} from "@/lib/feed/feedAuth";

/**
 * Google OAuth callback for /product-feed. Exchanges the PKCE code, verifies
 * the user is a pre-created ACTIVE staff profile (shared `user_profiles`
 * table — same accounts as the backoffice), and keeps the Supabase session
 * cookies. Non-staff get signed out immediately.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/product-feed?error=oauth", request.url));
  }

  try {
    const toSet: CookieToSet[] = [];
    const supabaseAuth = await createFeedAuthClient(toSet);

    const { data, error } = await supabaseAuth.auth.exchangeCodeForSession(code);
    if (error || !data.user?.email) {
      console.error("[feed-auth] OAuth exchange error:", error);
      return NextResponse.redirect(new URL("/product-feed?error=oauth", request.url));
    }

    const { data: profile, error: profErr } = await supabase
      .from("user_profiles")
      .select("id,role,is_active")
      .eq("id", data.user.id)
      .maybeSingle();
    const isStaff =
      !profErr && profile?.is_active && STAFF_ROLES.includes(profile.role);

    if (!isStaff) {
      await supabaseAuth.auth.signOut().catch(() => {});
      const redirect = NextResponse.redirect(
        new URL("/product-feed?error=no-account", request.url)
      );
      toSet.forEach(({ name, value, options }) =>
        redirect.cookies.set(name, value, options as Parameters<typeof redirect.cookies.set>[2])
      );
      return redirect;
    }

    const redirect = NextResponse.redirect(new URL("/product-feed", request.url));
    toSet.forEach(({ name, value, options }) =>
      redirect.cookies.set(name, value, options as Parameters<typeof redirect.cookies.set>[2])
    );
    return redirect;
  } catch (e) {
    console.error("[feed-auth] OAuth callback error:", e);
    return NextResponse.redirect(new URL("/product-feed?error=oauth", request.url));
  }
}
