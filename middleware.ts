import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Add cache control headers for HTML pages to ensure browsers respect revalidation
  // This prevents aggressive browser caching that ignores server updates
  const pathname = request.nextUrl.pathname;
  
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
