import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  PARTNER_SESSION_COOKIE,
  verifyPartnerSession,
} from '@/lib/partner-auth/session';

/** The signed-in agent/influencer area. */
const PARTNER_AREA = '/agent';
const PARTNER_LOGIN = '/agent/login';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Gate the partner area before anything else. Verified here rather than only
  // in the pages so an unauthenticated request never reaches a route that
  // queries partner data — the cookie is HMAC-signed, so this is a real check
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
        url.searchParams.set('next', pathname);
        return NextResponse.redirect(url);
      }
    }
    // Never cache a partner's own data at the edge.
    const authed = NextResponse.next();
    authed.headers.set('Cache-Control', 'private, no-store');
    return authed;
  }

  const response = NextResponse.next();

  // Add cache control headers for HTML pages to ensure browsers respect revalidation
  // This prevents aggressive browser caching that ignores server updates

  // For HTML pages (not static assets), set reasonable cache control
  if (
    !pathname.startsWith('/_next/') &&
    !pathname.startsWith('/api/') &&
    // Feed routes set their own Cache-Control (Meta fetches them on a schedule).
    !pathname.startsWith('/feeds/') &&
    !pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)
  ) {
    // Allow browser to cache but must revalidate with server
    // This ensures users get fresh content after revalidation
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=86400, must-revalidate'
    );
    
    // Add timestamp header for debugging
    response.headers.set('X-Page-Generated', new Date().toISOString());
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
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
