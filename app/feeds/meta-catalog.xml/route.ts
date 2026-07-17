import { getFeedItems } from "@/lib/feed/feedData";
import { toXml } from "@/lib/feed/metaCatalog";

/**
 * Meta (Facebook) product-catalog feed — RSS 2.0 XML, generated live from the
 * DB. Meta Commerce Manager fetches this URL on its hourly schedule, so the
 * URL must stay public and return the file itself (Content-Type
 * application/xml), never an HTML page. Middleware skips /feeds/ so these
 * cache headers are authoritative.
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
        "Cache-Control": "public, s-maxage=900, must-revalidate",
      },
    });
  } catch (e) {
    console.error("[feed] meta-catalog.xml failed:", e);
    return new Response("feed generation failed", { status: 500 });
  }
}
