import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getEvents } from "@/lib/eventsData";
import { isEventSoldOut } from "@/lib/events/price";
import type { Flight, OrderHotel } from "@/lib/app.types";

/**
 * Resolves a prepared package into what OrderReview needs, re-validated
 * against live data — unlike /api/find-order (the 24h-hold recovery
 * equivalent), which trusts its stored blob completely for its whole
 * 25-hour window. A package link can be shared and opened much later than
 * that, so staleness here is the normal case to plan for, not an edge case.
 *
 * Degrades piece by piece: a stale flight or hotel drops just that piece
 * (flagged `_needs_repick` so the client lands the visitor on the right
 * step to re-pick it) rather than failing the whole package. Only a gone
 * event or a no-longer-available ticket category fails the whole thing —
 * there is no "some other category" fallback to compose from here.
 */

type PreparedPackageRow = {
  event_id: number;
  event_order_info: {
    number_of_ticket: number;
    category: string;
    id: string;
    price_per_ticket: number;
    name: string;
    event_id: number;
    event_type?: string;
    vendor?: string;
    location_name?: string;
  };
  flight_order_info: Flight | null;
  flight_skipped: boolean;
  hotel_order_info: OrderHotel | null;
  hotel_skipped: boolean;
  num_travelers: number;
};

function isInFuture(dateStr: string | undefined | null): boolean {
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  return Number.isFinite(t) && t > Date.now();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Invalid package id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("prepared_packages")
    .select(
      "event_id, event_order_info, flight_order_info, flight_skipped, hotel_order_info, hotel_skipped, num_travelers",
    )
    .eq("share_token", id)
    .maybeSingle();

  if (error) {
    console.error("GET /api/package/[id]:", JSON.stringify(error));
    return NextResponse.json({ error: "Failed to load package" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }
  const row = data as unknown as PreparedPackageRow;

  // getEvents() already filters is_deleted + the availability window — an
  // empty result here means the event is gone or has moved outside the
  // sell window, either way this package can no longer be honored at all.
  const { events } = await getEvents(row.event_id);
  const event = events?.[0];
  if (!event || isEventSoldOut(event)) {
    return NextResponse.json(
      { error: "האירוע כבר אינו זמין להזמנה" },
      { status: 410 },
    );
  }

  const availableTickets = (event.tickets_and_rates || []).filter(
    (t) => t?.available !== false,
  );
  const liveTicket = availableTickets.find(
    (t) => t.category === row.event_order_info.category,
  );
  if (!liveTicket) {
    return NextResponse.json(
      { error: "סוג הכרטיס בחבילה הזו כבר אינו זמין" },
      { status: 410 },
    );
  }

  // Defense in depth: always respond with the CURRENT live price for this
  // category, never the snapshot taken when the package was saved — closes
  // the read side of the same gap savePreparedPackage guards on write.
  const eventOrderInfo = {
    ...row.event_order_info,
    price_per_ticket: liveTicket.price,
    total_tickets_price: liveTicket.price * row.num_travelers,
  };

  // Flight: offline inventory gets a real availability check (same
  // consumed/initial columns confirm-order itself reads); a live
  // (Amadeus) offer has no cheap way to re-verify short of a full
  // re-search, so it's trusted as long as it hasn't already departed —
  // confirm-order's own price floor is still the real backstop at booking
  // time regardless.
  let flight: Flight | null = row.flight_skipped ? null : row.flight_order_info;
  let flightNeedsRepick = false;
  if (flight) {
    if (!isInFuture(flight.outbound?.departureTime)) {
      flight = null;
      flightNeedsRepick = true;
    } else if (flight.isOffline && flight.offlineId != null) {
      const { data: flightRow } = await supabase
        .from("flights")
        .select("initial_quantity, consumed_quantity")
        .eq("id", flight.offlineId)
        .maybeSingle();
      const remaining =
        (flightRow?.initial_quantity ?? 0) - (flightRow?.consumed_quantity ?? 0);
      if (!flightRow || remaining < row.num_travelers) {
        flight = null;
        flightNeedsRepick = true;
      }
    }
  }

  // Hotel: same idea. offlineIds can cover more than one inventory row;
  // every one of them needs enough remaining rooms.
  let hotel: OrderHotel | null = row.hotel_skipped ? null : row.hotel_order_info;
  let hotelNeedsRepick = false;
  if (hotel) {
    if (!isInFuture(hotel.checkin)) {
      hotel = null;
      hotelNeedsRepick = true;
    } else if (hotel.isOffline) {
      const offlineIds =
        hotel.offlineIds && hotel.offlineIds.length > 0
          ? hotel.offlineIds
          : hotel.offlineId != null
            ? [hotel.offlineId]
            : [];
      if (offlineIds.length === 0) {
        hotel = null;
        hotelNeedsRepick = true;
      } else {
        const { data: hotelRows } = await supabase
          .from("offline_hotels")
          .select("id, num_rooms, consumed_rooms")
          .in("id", offlineIds);
        const allHaveRoom = offlineIds.every((rowId) => {
          const r = (hotelRows || []).find((h) => h.id === rowId);
          return r && r.num_rooms - r.consumed_rooms >= 1;
        });
        if (!allHaveRoom) {
          hotel = null;
          hotelNeedsRepick = true;
        }
      }
    }
  }

  return NextResponse.json({
    event_id: row.event_id,
    event_order_info: eventOrderInfo,
    flight_order_info: flight,
    flight_needs_repick: flightNeedsRepick,
    hotel_order_info: hotel,
    hotel_needs_repick: hotelNeedsRepick,
    num_travelers: row.num_travelers,
  });
}
