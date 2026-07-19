import { gzipSync } from "node:zlib";
import { getFeedItems } from "@/lib/feed/feedData";
import { toXml } from "@/lib/feed/metaCatalog";

/**
 * Meta (Facebook) product-catalog feed — RSS 2.0 XML, generated live from the
 * DB. Meta Commerce Manager fetches this URL on its hourly schedule, so the
 * URL must stay public and return the file itself (Content-Type
 * application/xml), never an HTML page. Middleware skips /feeds/ so these
 * cache headers are authoritative.
 *
 * Explicitly gzipped here (not left to Vercel's edge to negotiate): Vercel
 * auto-compresses with Brotli whenever a client's Accept-Encoding includes
 * "br" — but Meta's fetcher advertises br support while apparently not
 * actually decoding it, so it received raw Brotli bytes and rejected the feed
 * as "file format isn't supported" (confirmed via direct testing — a client
 * advertising br gets undecodable binary from this route otherwise). Meta's
 * own docs only list gzip/zip/bz2 as supported compressed formats. Setting
 * Content-Encoding ourselves means the origin response is already encoded,
 * so Vercel's edge passes it through instead of re-negotiating Brotli.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const { items } = await getFeedItems();
    const gzipped = gzipSync(Buffer.from(toXml(items), "utf-8"));
    return new Response(gzipped, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Encoding": "gzip",
        // Fresh enough for Meta's hourly fetch; CDN may hold it 15 min.
        "Cache-Control": "public, s-maxage=900, must-revalidate",
      },
    });
  } catch (e) {
    console.error("[feed] meta-catalog.xml failed:", e);
    return new Response("feed generation failed", { status: 500 });
  }
}
