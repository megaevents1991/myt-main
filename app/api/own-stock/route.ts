import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { EventTicket } from "@/lib/app.types";
import { hasOwnStock, stockLeft } from "@/lib/own-stock";
import { loadSeatsHeld } from "@/lib/events/ownStock";

/**
 * Seats left on our own tickets for the order page: `GET ?event_id=<our id>`
 * -> `{ left: { <ticket id>: <seats> } }`. Counted fresh on every call (the
 * catalog's view of it is up to an hour old); confirm-order counts again
 * before it books. Read-only.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("event_id")?.trim() ?? "";
  const eventId = Number(raw);
  if (!/^\d{1,12}$/.test(raw) || !Number.isSafeInteger(eventId)) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid event_id" },
      { status: 400 },
    );
  }

  try {
    const { data, error } = await supabase
      .from("events")
      .select("tickets_and_rates")
      .eq("id", eventId)
      .maybeSingle();
    if (error) {
      console.error("[OwnStock] event read failed:", JSON.stringify(error));
      return NextResponse.json(
        { success: false, error: "Could not read the event" },
        { status: 502 },
      );
    }
    const tickets = ((data?.tickets_and_rates ?? []) as EventTicket[]).filter(
      hasOwnStock,
    );
    if (tickets.length === 0) return NextResponse.json({ success: true, left: {} });

    const held = await loadSeatsHeld([eventId]);
    if (!held) {
      return NextResponse.json(
        { success: false, error: "Could not count the seats" },
        { status: 502 },
      );
    }
    const eventHeld = held.get(eventId) ?? new Map<string, number>();
    const left = Object.fromEntries(
      tickets.map((ticket) => [ticket.id, stockLeft(ticket, eventHeld) ?? 0]),
    );
    return NextResponse.json({ success: true, left });
  } catch (error) {
    console.error(
      `[OwnStock] Failed for event ${raw}:`,
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { success: false, error: "Failed to count the seats" },
      { status: 500 },
    );
  }
}
