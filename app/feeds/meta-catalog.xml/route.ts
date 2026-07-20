import { getFeedItems } from "@/lib/feed/feedData";
import { toXml } from "@/lib/feed/metaCatalog";

/**
 * Meta (Facebook) product-catalog feed — RSS 2.0 XML, generated live from
 * the DB. Meta Commerce Manager fetches this URL on its hourly schedule.
 *
 * Compression saga: Vercel force-Brotli-compresses every response on this
 * domain whenever a client's Accept-Encoding includes "br" — confirmed live,
 * regardless of origin Content-Encoding, Cache-Control: no-transform, or
 * ISR vs force-dynamic. Meta's fetcher advertises br but apparently doesn't
 * decode it, so it always got undecodable binary.
 *
 * Fix: Content-Type: application/octet-stream instead of application/xml.
 * Verified live on Supabase Storage (also Cloudflare-fronted, same Brotli
 * behavior) that octet-stream makes the CDN skip its compression
 * heuristics entirely, since it no longer recognizes the body as
 * compressible text. Testing whether the same trick works directly on
 * Vercel's edge too — if so this route can serve the feed live again,
 * without the redirect-to-storage indirection (which a strict fetcher/
 * validator, like Meta's upload-file preview, may not even follow).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const { items } = await getFeedItems();
    return new Response(toXml(items), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "public, s-maxage=900, must-revalidate",
      },
    });
  } catch (e) {
    console.error("[feed] meta-catalog.xml failed:", e);
    return new Response("feed generation failed", { status: 500 });
  }
}
