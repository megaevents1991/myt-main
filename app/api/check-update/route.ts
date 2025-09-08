import { NextRequest } from 'next/server';
import { contentfulClient } from '@/lib/contentful';

// Quick-win in-memory cache for last known timestamps per pageId
// (Lives for lifetime of the runtime instance; acceptable for reducing noisy fallbacks.)
const lastKnownTimestamps = new Map<string, number>();

// Whitelist for special aggregate pages
const LIST_PAGE_CONTENT_TYPES: Record<string, string> = {
  'artists-list': 'artistTemplate',
  'football-list': 'footballTeamTemplate',
};

const HOMEPAGE_ID = 'homepage';
const HOMEPAGE_CAROUSEL_ENTRY_ID = '3RxzAgWZi26FSbBYhgMmVO';

// Simple Contentful entry id validation (alphanumeric, len 6-64)
const ENTRY_ID_REGEX = /^[A-Za-z0-9]{6,64}$/;

async function fetchLatestForContentType(contentType: string): Promise<number | undefined> {
  const { items } = await contentfulClient.getEntries({
    content_type: contentType,
    // Typings expect an array of field paths; we only need updatedAt
  select: ['sys.updatedAt'] as ('sys.updatedAt')[],
    limit: 1000, // defensive upper bound
  });
  if (!items.length) return undefined;
  return Math.max(...items.map(i => new Date(i.sys.updatedAt).getTime()));
}

async function fetchLatestForEntry(entryId: string): Promise<number> {
  // getEntry typings may not allow select; fetch full entry (light enough) and use updatedAt
  const entry = await contentfulClient.getEntry(entryId);
  return new Date(entry.sys.updatedAt).getTime();
}

async function fetchLatestForHomepage(): Promise<number | undefined> {
  const [eventsResponse, carouselResponse] = await Promise.all([
  contentfulClient.getEntries({ content_type: 'eventTemplate', select: ['sys.updatedAt'] as ('sys.updatedAt')[], limit: 1000 }),
    contentfulClient.getEntry(HOMEPAGE_CAROUSEL_ENTRY_ID)
  ]);
  const eventTimestamps = eventsResponse.items.map(item => new Date(item.sys.updatedAt).getTime());
  const carouselTimestamp = new Date(carouselResponse.sys.updatedAt).getTime();
  const all = [...eventTimestamps, carouselTimestamp];
  if (!all.length) return undefined;
  return Math.max(...all);
}

export async function HEAD(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get('pageId');
  
  if (!pageId) {
    return new Response(null, { status: 400 });
  }

  try {
    const start = Date.now();
    let ts: number | undefined;
    let cacheStatus: 'MISS' | 'HIT' | 'STALE' | 'FALLBACK' = 'MISS';
    let category: 'list' | 'homepage' | 'entry' | 'invalid' = 'entry';

    // Validate / categorize pageId early
    if (pageId in LIST_PAGE_CONTENT_TYPES) {
      category = 'list';
    } else if (pageId === HOMEPAGE_ID) {
      category = 'homepage';
    } else if (!ENTRY_ID_REGEX.test(pageId)) {
      category = 'invalid';
      return new Response(null, { status: 400 });
    }

    const cached = lastKnownTimestamps.get(pageId);
    if (cached) {
      cacheStatus = 'HIT';
    }

    try {
      if (category === 'list') {
        ts = await fetchLatestForContentType(LIST_PAGE_CONTENT_TYPES[pageId]);
      } else if (category === 'homepage') {
        ts = await fetchLatestForHomepage();
      } else if (category === 'entry') {
        ts = await fetchLatestForEntry(pageId);
      }
    } catch (err) {
      // Swallow and fallback
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn('check-update fetch error', { pageId, category, error: errorMessage });
      ts = undefined;
    }

    if (typeof ts === 'number') {
      lastKnownTimestamps.set(pageId, ts);
      if (cacheStatus === 'HIT' && cached !== ts) {
        // transitioned from cached to updated
        cacheStatus = 'MISS';
      }
    } else {
      if (cached) {
        ts = cached; // fallback to previous known
        cacheStatus = cacheStatus === 'HIT' ? 'STALE' : 'FALLBACK';
      } else {
        // No data ever fetched: initialize once (will not change until real data available)
        ts = Date.now();
        lastKnownTimestamps.set(pageId, ts);
        cacheStatus = 'FALLBACK';
      }
    }

    const lastModifiedHttp = new Date(ts).toUTCString();

    console.info(JSON.stringify({
      msg: 'check-update', pageId, category, ts, cacheStatus, tookMs: Date.now() - start
    }));

    return new Response(null, {
      status: 200,
      headers: {
        'x-page-timestamp': String(ts), // backward compatibility
        'Last-Modified': lastModifiedHttp,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Cache-Status': cacheStatus,
      },
    });
  } catch (error) {
    console.error('Unexpected error in check-update route:', error, {
      pageId,
      requestUrl: request.url
    });
    
    // Return 500 for unexpected errors (network issues, etc.)
    return new Response(null, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
  }
}
