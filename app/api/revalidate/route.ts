import { revalidatePath, revalidateTag } from 'next/cache';
import { getCachedEvents } from '@/lib/eventsData';
 
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const path = searchParams.get('path');

  if (secret !== process.env.NEXT_SECRET_REVALIDATION_SECRET) {
    return new Response('Invalid token', { status: 401 });
  }

  try {
    // Revalidate the events cache
    revalidateTag('events');

    if (path) {
      // Revalidate specific path if provided
      revalidatePath(path as string);
    } else {
      // Revalidate all critical paths when new events are added
      revalidatePath('/', 'page'); // Homepage
      revalidatePath('/order/[eventId]', 'page'); // All order pages
      revalidatePath('/sitemap.xml', 'page'); // Sitemap
      
      // Also regenerate static params for order pages
      // This will create new static pages for new events
      const { events } = await getCachedEvents();
      console.log(`Revalidation: Found ${events.length} events, will regenerate static pages`);
    }

    return new Response(`Revalidation successful - ${path ? `path: ${path}` : 'all pages'}`, { 
      status: 200 
    });
  } catch (error) {
    console.error('Revalidation error:', error);
    return new Response('Revalidation failed', { status: 500 });
  }
}