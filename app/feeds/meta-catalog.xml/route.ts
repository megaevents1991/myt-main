import { getFeedItems } from "@/lib/feed/feedData";
import { toXml } from "@/lib/feed/metaCatalog";

/**
 * Meta (Facebook) product-catalog feed — RSS 2.0 XML, generated live from the
 * DB. Meta Commerce Manager fetches this URL on its hourly schedule, so the
 * URL must stay public and return the file itself (Content-Type
 * application/xml), never an HTML page. Middleware skips /feeds/ so these
 * cache headers are authoritative.
 *
 * Vercel's edge auto-compresses with Brotli whenever a client's
 * Accept-Encoding includes "br" — but Meta's fetcher advertises br support
 * while apparently not actually decoding it, so it received raw Brotli bytes
 * and rejected the feed as "file format isn't supported" (confirmed via
 * direct testing). Meta's own docs only list gzip/zip/bz2 as supported
 * compressed formats — br isn't one. Two prior attempts (origin
 * Content-Encoding: gzip, then Cache-Control: no-transform) were both
 * verified live to make no difference — Vercel re-compresses with Brotli
 * regardless on a force-dynamic route. Trying ISR (revalidate, no
 * force-dynamic) instead: static/ISR responses may go through a different
 * serving pipeline than dynamic function invocations. 900s matches the
 * freshness this route already targets for Meta's hourly fetch.
 */
export const revalidate = 900;
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
