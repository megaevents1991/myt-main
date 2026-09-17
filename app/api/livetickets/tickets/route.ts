import { NextRequest, NextResponse } from "next/server";
import { getLiveTicketsOffers } from "@/lib/livetickets";

/**
 * Live LiveTickets offers for the order page: `GET ?eid=<their event id>`.
 * Read-only - unlike the TixStock route it never writes prices back to the DB
 * (the backoffice cron owns that), so it cannot bust the events cache.
 */
export async function GET(req: NextRequest) {
  const eid = req.nextUrl.searchParams.get("eid")?.trim();
  if (!eid || !/^\d{1,12}$/.test(eid)) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid eid" },
      { status: 400 },
    );
  }

  try {
    const offers = await getLiveTicketsOffers(eid);
    if (offers === null) {
      return NextResponse.json(
        { success: false, error: "LiveTickets unavailable" },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true, offers });
  } catch (error) {
    console.error(
      `[LiveTickets Tickets] Failed for event ${eid}:`,
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { success: false, error: "Failed to fetch tickets" },
      { status: 500 },
    );
  }
}
