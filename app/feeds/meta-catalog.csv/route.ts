import { getFeedItems } from "@/lib/feed/feedData";
import { toCsv } from "@/lib/feed/metaCatalog";

/**
 * CSV export of the exact same rows as /feeds/meta-catalog.xml — for manual
 * inspection / spreadsheet work from the /product-feed page. The XML is the
 * canonical feed Meta consumes.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const { items } = await getFeedItems();
    return new Response(toCsv(items), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="meta-catalog.csv"',
        // Lets the backoffice publish cron prove it got a live build (same
        // anti-snapshot-loop guard as the XML route's ?source=1 path).
        "X-Feed-Generated": new Date().toISOString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[feed] meta-catalog.csv failed:", e);
    return new Response("feed generation failed", { status: 500 });
  }
}
