import { NextResponse } from "next/server";
import { createFeedAuthClient, type CookieToSet } from "@/lib/feed/feedAuth";

/**
 * Starts Google sign-in for the /product-feed page — same Supabase Auth
 * Google provider the backoffice uses. Mirrors the backoffice
 * `app/api/auth/google/route.ts` origin derivation: in serverless,
 * new URL(request.url).origin can be an internal host, which makes Supabase
 * reject redirect_to and bounce to its Site URL.
 */
export async function GET(request: Request) {
  const toSet: CookieToSet[] = [];
  const supabaseAuth = await createFeedAuthClient(toSet);

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : new URL(request.url).origin;

  const { data, error } = await supabaseAuth.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/api/feed-auth/callback` },
  });

  if (error || !data.url) {
    console.error("[feed-auth] Google OAuth init error:", error);
    return NextResponse.redirect(new URL("/product-feed?error=oauth", request.url));
  }

  const redirect = NextResponse.redirect(data.url);
  // Persist the PKCE code-verifier cookies Supabase generated.
  toSet.forEach(({ name, value, options }) =>
    redirect.cookies.set(name, value, options as Parameters<typeof redirect.cookies.set>[2])
  );
  return redirect;
}
