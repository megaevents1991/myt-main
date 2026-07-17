import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createFeedAuthClient, type CookieToSet } from "@/lib/feed/feedAuth";

/** Signs out of the /product-feed page and clears the Supabase auth cookies. */
export async function GET(request: Request) {
  const toSet: CookieToSet[] = [];
  try {
    const supabaseAuth = await createFeedAuthClient(toSet);
    await supabaseAuth.auth.signOut().catch(() => {});
  } catch (e) {
    console.error("[feed-auth] logout failed:", e);
  }

  const redirect = NextResponse.redirect(new URL("/product-feed", request.url));
  toSet.forEach(({ name, value, options }) =>
    redirect.cookies.set(name, value, options as Parameters<typeof redirect.cookies.set>[2])
  );
  // Belt-and-braces: drop any lingering Supabase cookies.
  const cookieStore = await cookies();
  cookieStore.getAll().forEach(({ name }) => {
    if (name.startsWith("sb-")) redirect.cookies.delete(name);
  });
  return redirect;
}
