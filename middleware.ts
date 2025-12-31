import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MONDIAL2026_LEGACY_FOOTBALL_ID = "2LyfVQ6jREeMTm0ds66d1l";
const MONDIAL2026_EXTERNAL_URL = "https://mondial2026.mega-events.co.il/mondial2026";

export function middleware(request: NextRequest) {
  // Hard redirect legacy Mondial 2026 football team page to the dedicated site.
  // Doing this in middleware avoids ISR/browser caching issues and works reliably on Vercel.
  if (request.nextUrl.pathname === `/football/${MONDIAL2026_LEGACY_FOOTBALL_ID}`) {
    const target = new URL(MONDIAL2026_EXTERNAL_URL);
    target.search = request.nextUrl.search; // preserve query string

    const redirectResponse = NextResponse.redirect(target, 308);
    redirectResponse.headers.set('Cache-Control', 'no-store');
    return redirectResponse;
  }

  const response = NextResponse.next();
  
  // Add cache control headers for HTML pages to ensure browsers respect revalidation
  // This prevents aggressive browser caching that ignores server updates
  const pathname = request.nextUrl.pathname;
  
  // For HTML pages (not static assets), set reasonable cache control
  if (
    !pathname.startsWith('/_next/') && 
    !pathname.startsWith('/api/') &&
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
