/**
 * Auth for the /product-feed admin page — the SAME identity provider as the
 * backoffice: Supabase Auth (Google OAuth) + the shared `user_profiles` table.
 * Only pre-created, active STAFF users (superadmin/admin/editor) may enter;
 * there is no self-signup. Unlike the backoffice (own HMAC cookie), here the
 * Supabase session cookies themselves are kept — this app has no session
 * secret env, and one gated page doesn't justify adding one.
 *
 * Server-only: uses the service-role envs this app already has.
 */
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { supabase } from "@/lib/supabase";

/** Mirrors backoffice `types/auth.types.ts` STAFF_ROLES. */
const STAFF_ROLES = ["superadmin", "admin", "editor"];

export type FeedUser = {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
};

export type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Supabase auth client bound to the request cookies. In route handlers pass a
 * `setCookies` sink and copy its entries onto the response; in server
 * components omit it (RSCs cannot write cookies — expired sessions just read
 * as logged-out).
 */
export async function createFeedAuthClient(setCookies?: CookieToSet[]) {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_SECRET_SUPABASE_URL!,
    process.env.NEXT_SECRET_SUPABASE_SERVICE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          if (setCookies) setCookies.push(...toSet);
        },
      },
    }
  );
}

/** The signed-in staff user, or null (not signed in / not staff / inactive). */
export async function getFeedUser(): Promise<FeedUser | null> {
  try {
    const auth = await createFeedAuthClient();
    const { data, error } = await auth.auth.getUser();
    if (error || !data.user?.email) return null;

    const { data: profile, error: profErr } = await supabase
      .from("user_profiles")
      .select("id,email,display_name,role,is_active")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profErr) {
      console.error("[feed-auth] profile lookup failed:", JSON.stringify(profErr));
      return null;
    }
    if (!profile || !profile.is_active || !STAFF_ROLES.includes(profile.role)) {
      return null;
    }
    return {
      id: profile.id,
      email: profile.email,
      display_name: profile.display_name,
      role: profile.role,
    };
  } catch (e) {
    console.error("[feed-auth] getFeedUser failed:", e);
    return null;
  }
}
