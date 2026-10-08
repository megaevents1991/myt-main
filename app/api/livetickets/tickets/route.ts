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
    // What LiveTickets charges US stays on the server (lib/ticket-cost.ts reads
    // it at confirm-order); the order page needs the selling price alone.
    const publicOffers = offers.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ costUsd, tripleFeeCostUsd, ...offer }) => offer,
    );
    return NextResponse.json({ success: true, offers: publicOffers });
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
