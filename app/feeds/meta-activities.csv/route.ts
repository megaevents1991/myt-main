import { getActivityItems } from "@/lib/feed/feedData";
import { toActivitiesCsv } from "@/lib/feed/activitiesCatalog";

/**
 * Meta ACTIVITIES catalog feed — the one Meta actually consumes. Our Meta
 * catalog is the activities vertical, whose schema differs completely from
 * the e-commerce one in /feeds/meta-catalog.{xml,csv} (those stay for Google
 * Merchant). Column set copies the file that uploaded with 0 errors.
 *
 * `?excel=1` prepends a UTF-8 BOM for humans opening it in Excel — the
 * default output stays BOM-less, byte-matching the verified file.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { items } = await getActivityItems();
    const forExcel = new URL(request.url).searchParams.get("excel") === "1";
    const body = (forExcel ? "﻿" : "") + toActivitiesCsv(items);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="meta-activities.csv"',
        // Lets the backoffice publish cron prove it got a live build.
        "X-Feed-Generated": new Date().toISOString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[feed] meta-activities.csv failed:", e);
    return new Response("feed generation failed", { status: 500 });
  }
}
