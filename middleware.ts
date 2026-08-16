import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  PARTNER_SESSION_COOKIE,
  verifyPartnerSession,
} from "@/lib/partner-auth/session";
import {
  UTM_COOKIE,
  UTM_COOKIE_MAX_AGE,
  applyUtmCapture,
  parseUtmCookie,
  parseUtmParams,
  sameTouch,
  serializeUtmCookie,
  utmCookieFits,
} from "@/lib/utm";

/** The signed-in agent/influencer area. */
const PARTNER_AREA = "/agent";
const PARTNER_LOGIN = "/agent/login";

/**
 * Is this utm_source a marketing partner (influencer/agent)?
 * Fast path: our own link builders stamp utm_medium=influencer - no lookup.
 * Fallback (old links in the wild): one indexed REST read against partners.
 * Hard 400ms timeout; ANY failure → false (the marker path already ran).
 * Runs only when a NEW source lands (not on every page - see the sameTouch
 * short-circuit in the capture block).
 */
async function classifyInfluencer(
  source: string | null,
  medium: string | null,
): Promise<boolean> {
  if (medium === "influencer") return true;
  if (!source) return false;
  const url = process.env.NEXT_SECRET_SUPABASE_URL;
  const key = process.env.NEXT_SECRET_SUPABASE_SERVICE_KEY;
  if (!url || !key) return false;
  try {
    const res = await fetch(
      `${url}/rest/v1/partners?partner_tracking_code=eq.${encodeURIComponent(source)}` +
        `&type=in.(agent,affiliate)&select=partner_tracking_code&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(400),
      },
    );
    if (!res.ok) return false;
    const rows: unknown = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch (e) {
    console.error("utm classify lookup failed:", e);
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Gate the partner area before anything else. Verified here rather than only
  // in the pages so an unauthenticated request never reaches a route that
  // queries partner data - the cookie is HMAC-signed, so this is a real check
  // and not a "is a cookie present" one.
  if (pathname === PARTNER_AREA || pathname.startsWith(`${PARTNER_AREA}/`)) {
    if (pathname !== PARTNER_LOGIN) {
      const session = await verifyPartnerSession(
        request.cookies.get(PARTNER_SESSION_COOKIE)?.value,
      );
      if (!session) {
        const url = request.nextUrl.clone();
        url.pathname = PARTNER_LOGIN;
        // Send them back where they were headed once they sign in.
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }
    }
    // Never cache a partner's own data at the edge.
    const authed = NextResponse.next();
    authed.headers.set("Cache-Control", "private, no-store");
    return authed;
  }

  const response = NextResponse.next();

  // Add cache control headers for HTML pages to ensure browsers respect revalidation
  // This prevents aggressive browser caching that ignores server updates

  // For HTML pages (not static assets), set reasonable cache control
  if (
    !pathname.startsWith("/_next/") &&
    !pathname.startsWith("/api/") &&
    // Feed routes set their own Cache-Control (Meta fetches them on a schedule).
    !pathname.startsWith("/feeds/") &&
    !pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)
  ) {
    // Allow browser to cache but must revalidate with server
    // This ensures users get fresh content after revalidation
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400, must-revalidate",
    );

    // Add timestamp header for debugging
    response.headers.set("X-Page-Generated", new Date().toISOString());
  }

  // UTM capture (spec: backoffice docs/superpowers/specs/2026-08-16-utm-capture-design.md).
  // Server-set so Safari's 7-day cap on JS cookies doesn't apply. Fully
  // fail-open: ANY error and the page ships exactly as it would without this.
  try {
    const isPage =
      !pathname.startsWith("/api/") &&
      !pathname.startsWith("/feeds/") &&
      !pathname.startsWith("/_next/") &&
      !pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/);
    if (isPage) {
      const incoming = parseUtmParams(request.nextUrl.searchParams);
      if (incoming) {
        const existing = parseUtmCookie(request.cookies.get(UTM_COOKIE)?.value);
        // Same set as the current primary → skip the partner lookup entirely,
        // just refresh the rolling 90-day window.
        const inf =
          existing && sameTouch(existing.p, incoming)
            ? existing.p.inf
            : await classifyInfluencer(incoming.s, incoming.m);
        const next = applyUtmCapture(existing, incoming, inf, new Date().toISOString());
        const serialized = serializeUtmCookie(next);
        // A primary-only payload that still exceeds the encoded budget would be
        // silently dropped by the browser - skip the write (and the cache
        // downgrade) instead of shipping a dead Set-Cookie.
        if (utmCookieFits(serialized)) {
          response.cookies.set(UTM_COOKIE, serialized, {
            maxAge: UTM_COOKIE_MAX_AGE,
            path: "/",
            sameSite: "lax",
            secure: true,
            httpOnly: false,
          });
          // Never publicly cache a Set-Cookie response (overrides the block above).
          response.headers.set("Cache-Control", "private, no-store");
        }
      }
    }
  } catch (e) {
    console.error("utm capture failed:", e);
  }

  return response;
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
