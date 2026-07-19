import { getFeedItems } from "@/lib/feed/feedData";
import { toXml } from "@/lib/feed/metaCatalog";

/**
 * Meta (Facebook) product-catalog feed — RSS 2.0 XML, generated live from the
 * DB. Meta Commerce Manager fetches this URL on its hourly schedule, so the
 * URL must stay public and return the file itself (Content-Type
 * application/xml), never an HTML page. Middleware skips /feeds/ so these
 * cache headers are authoritative.
 *
 * `no-transform`: Vercel's edge auto-compresses with Brotli whenever a
 * client's Accept-Encoding includes "br" — but Meta's fetcher advertises br
 * support while apparently not actually decoding it, so it received raw
 * Brotli bytes and rejected the feed as "file format isn't supported"
 * (confirmed via direct testing). Meta's own docs only list gzip/zip/bz2 as
 * supported compressed formats — br isn't one. A first attempt set
 * Content-Encoding: gzip on the origin response, assuming Vercel's edge
 * would pass through an already-encoded body — it doesn't: verified live
 * that Vercel re-compresses with Brotli regardless, ignoring the origin's
 * own Content-Encoding. `no-transform` is the actual HTTP-standard directive
 * (RFC 7234) telling any cache/CDN not to alter the payload encoding at all.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const { items } = await getFeedItems();
    return new Response(toXml(items), {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        // Fresh enough for Meta's hourly fetch; CDN may hold it 15 min.
        "Cache-Control": "public, s-maxage=900, must-revalidate, no-transform",
      },
    });
  } catch (e) {
    console.error("[feed] meta-catalog.xml failed:", e);
    return new Response("feed generation failed", { status: 500 });
  }
}
