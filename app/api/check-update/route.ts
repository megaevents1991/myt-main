import { NextRequest } from 'next/server';
import { contentfulClient } from '@/lib/contentful';

export async function HEAD(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get('pageId');
  
  if (!pageId) {
    return new Response(null, { status: 400 });
  }

  try {
    let lastModified: string;
    
    // Handle special cases for list pages
    if (pageId === 'artists-list') {
      const { items } = await contentfulClient.getEntries({
        content_type: "artistTemplate",
      });
      // Get the most recent update time from all artists
      const timestamps = items.map(item => new Date(item.sys.updatedAt).getTime());
      lastModified = Math.max(...timestamps).toString();
    } else if (pageId === 'football-list') {
      const { items } = await contentfulClient.getEntries({
        content_type: "footballTeamTemplate",
      });
      // Get the most recent update time from all football teams
      const timestamps = items.map(item => new Date(item.sys.updatedAt).getTime());
      lastModified = Math.max(...timestamps).toString();
    } else if (pageId === 'homepage') {
      // For homepage, check events and carousel content
      const [eventsResponse, carouselResponse] = await Promise.all([
        contentfulClient.getEntries({
          content_type: "eventTemplate",
        }),
        contentfulClient.getEntry("3RxzAgWZi26FSbBYhgMmVO") // Carousel entry
      ]);
      
      const eventTimestamps = eventsResponse.items.map(item => new Date(item.sys.updatedAt).getTime());
      const carouselTimestamp = new Date(carouselResponse.sys.updatedAt).getTime();
      const allTimestamps = [...eventTimestamps, carouselTimestamp];
      
      lastModified = Math.max(...allTimestamps).toString();
    } else {
      // Handle individual entry pages
      const entry = await contentfulClient.getEntry(pageId);
      lastModified = new Date(entry.sys.updatedAt).getTime().toString();
    }
    
    return new Response(null, {
      status: 200,
      headers: {
        'x-page-timestamp': lastModified,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error checking for updates:', error);
    return new Response(null, { status: 500 });
  }
}
