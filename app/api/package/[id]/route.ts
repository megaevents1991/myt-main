import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getEvents } from "@/lib/eventsData";
import { isEventSoldOut } from "@/lib/events/price";
import { isMegaEventsFlight } from "@/lib/flights/company";
import { getPartnerSession } from "@/lib/partner-auth";
import type { Flight, OrderHotel } from "@/lib/app.types";
import { pickPax, readyMode, variantSizes } from "@/lib/events/readyPackage";

/**
 * Resolves a prepared package into what OrderReview needs, re-validated
 * against live data - unlike /api/find-order (the 24h-hold recovery
 * equivalent), which trusts its stored blob completely for its whole
 * 25-hour window. A package link can be shared and opened much later than
 * that, so staleness here is the normal case to plan for, not an edge case.
 *
 * Degrades piece by piece: a stale flight or hotel drops just that piece
 * (flagged `_needs_repick` so the client lands the visitor on the right
 * step to re-pick it) rather than failing the whole package. Only a gone
 * event or a no-longer-available ticket category fails the whole thing -
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
  allow_edit?: boolean | null;
  partner_tracking_code?: string | null;
  /**
   * The agent's price change per traveler in USD (+ uplift / - discount off
   * their own commission), stamped by the backoffice wizard. numeric arrives
   * as a string from PostgREST. Backoffice doc 2026-08-30, item 4: the LINK
   * has to carry the agent's price, not just the signed quote.
   */
  price_adjust_per_person?: number | string | null;
  /**
   * 'house' = a ready package ("חבילה מוכנה", lib/events/readyPackage.ts): it
   * belongs to no partner, is attached to its event, and holds one priced
   * composition per party size in `variants`. Absent / 'partner' = a partner's
   * shared link, exactly as before.
   */
  kind?: string | null;
  max_travelers?: number | null;
  variants?: Record<string, ReadyVariantRow> | null;
};

type ReadyVariantRow = {
  event_order_info: PreparedPackageRow["event_order_info"];
  flight_order_info: Flight | null;
  flight_skipped: boolean;
  hotel_order_info: OrderHotel | null;
  hotel_skipped: boolean;
  hotel_image?: string | null;
};

function isInFuture(dateStr: string | undefined | null): boolean {
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  return Number.isFinite(t) && t > Date.now();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Invalid package id" }, { status: 400 });
  }

  const PACKAGE_COLUMNS =
    "event_id, event_order_info, flight_order_info, flight_skipped, hotel_order_info, hotel_skipped, num_travelers, partner_tracking_code";

  let { data, error } = await supabase
    .from("prepared_packages")
    .select(
      `${PACKAGE_COLUMNS}, allow_edit, price_adjust_per_person, kind, max_travelers, variants`,
    )
    .eq("share_token", id)
    .maybeSingle();

  // The ready-package columns may not be migrated yet (absent = a partner's
  // package, today's behavior) - shed like the two columns below.
  if (error && error.code === "42703") {
    ({ data, error } = await supabase
      .from("prepared_packages")
      .select(`${PACKAGE_COLUMNS}, allow_edit, price_adjust_per_person`)
      .eq("share_token", id)
      .maybeSingle());
  }

  // Either newer column may not be migrated yet - shed them one at a time
  // (absent = no price change / editable, today's behavior).
  if (error && error.code === "42703") {
    ({ data, error } = await supabase
      .from("prepared_packages")
      .select(`${PACKAGE_COLUMNS}, allow_edit`)
      .eq("share_token", id)
      .maybeSingle());
  }
  if (error && error.code === "42703") {
    ({ data, error } = await supabase
      .from("prepared_packages")
      .select(PACKAGE_COLUMNS)
      .eq("share_token", id)
      .maybeSingle());
  }

  if (error) {
    console.error(
      "GET /api/package/[id]:",
      error.message,
      error.code,
      error.details,
      error.hint,
    );
    return NextResponse.json(
      { error: "Failed to load package" },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }
  const row = data as unknown as PreparedPackageRow;

  // A ready package holds one composition per party size: serve the one asked
  // for (?pax=N) when it is priced, else the size it was built for. From here
  // on `row` carries that composition, so every check below runs on it exactly
  // as it does on a partner's package.
  const isHouse = row.kind === "house";
  let paxOptions: number[] = [];
  let hotelImage: string | null = null;
  if (isHouse) {
    paxOptions = variantSizes(row.variants, row.max_travelers);
    const asked = Number(new URL(request.url).searchParams.get("pax"));
    const pax = pickPax(
      paxOptions,
      Number.isInteger(asked) ? asked : null,
      row.num_travelers,
    );
    const variant = pax != null ? row.variants?.[String(pax)] : undefined;
    if (pax == null || !variant) {
      return NextResponse.json(
        { error: "החבילה כבר אינה זמינה" },
        { status: 410 },
      );
    }
    row.event_order_info = variant.event_order_info;
    row.flight_order_info = variant.flight_order_info;
    row.flight_skipped = variant.flight_skipped;
    row.hotel_order_info = variant.hotel_order_info;
    row.hotel_skipped = variant.hotel_skipped;
    row.num_travelers = pax;
    hotelImage = variant.hotel_image ?? null;
  }

  // getEvents() already filters is_deleted + the availability window - an
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
  // A ready package is served only while its event still points at it and the
  // backoffice has not switched it off - a detached or replaced one is gone.
  if (
    isHouse &&
    (event.ready_package_token !== id ||
      readyMode(event.ready_package_mode) === "off")
  ) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  const availableTickets = (event.tickets_and_rates || []).filter(
    (t) => t?.available !== false,
  );
  // Ticket id first: on a multi-supplier event two suppliers can share a
  // category name. The name stays as the fallback for older packages.
  const liveTicket =
    availableTickets.find((t) => t.id && t.id === row.event_order_info.id) ??
    availableTickets.find(
      (t) => t.category === row.event_order_info.category,
    );
  if (!liveTicket) {
    return NextResponse.json(
      { error: "סוג הכרטיס בחבילה הזו כבר אינו זמין" },
      { status: 410 },
    );
  }

  // Defense in depth: always respond with the CURRENT live price for this
  // category, never the snapshot taken when the package was saved - closes
  // the read side of the same gap savePreparedPackage guards on write.
  const eventOrderInfo = {
    ...row.event_order_info,
    price_per_ticket: liveTicket.price,
    total_tickets_price: liveTicket.price * row.num_travelers,
  };

  // Flight: offline inventory gets a real availability check (same
  // consumed/initial columns confirm-order itself reads); a live
  // (Amadeus) offer has no cheap way to re-verify short of a full
  // re-search, so it's trusted as long as it hasn't already departed -
  // confirm-order's own price floor is still the real backstop at booking
  // time regardless.
  let flight: Flight | null = row.flight_skipped ? null : row.flight_order_info;
  // Not skipped but nothing pinned = the agent deliberately left the flight
  // for the customer to pick live (backoffice builder's "live" mode) - same
  // client behavior as a stale flight: land on the flight step.
  let flightNeedsRepick = !row.flight_skipped && !row.flight_order_info;
  if (flight) {
    if (!isInFuture(flight.outbound?.departureTime)) {
      flight = null;
      flightNeedsRepick = true;
    } else if (flight.isOffline && flight.offlineId != null) {
      // "*" and not a column list: the ownership check reads company_id, which
      // may not exist yet when this deploys (see lib/flights/company.ts).
      const { data: flightRow } = await supabase
        .from("flights")
        .select("*")
        .eq("id", flight.offlineId)
        .maybeSingle();
      const remaining =
        (flightRow?.initial_quantity ?? 0) -
        (flightRow?.consumed_quantity ?? 0);
      // A block of another company is treated like a flight that is gone.
      if (
        !flightRow ||
        !isMegaEventsFlight(flightRow) ||
        remaining < row.num_travelers
      ) {
        flight = null;
        flightNeedsRepick = true;
      }
    }
  }

  // Hotel: same idea. offlineIds can cover more than one inventory row;
  // every one of them needs enough remaining rooms.
  let hotel: OrderHotel | null = row.hotel_skipped
    ? null
    : row.hotel_order_info;
  // Same "pick it live" semantics as the flight above.
  let hotelNeedsRepick = !row.hotel_skipped && !row.hotel_order_info;
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

  // The lock binds the CUSTOMER to the composition - never its own author.
  // An agent opening their package through the partner-handoff (ordering on a
  // customer's behalf) keeps full editing, locked or not.
  let isOwner = false;
  try {
    const partnerSession = await getPartnerSession();
    isOwner =
      !!partnerSession &&
      !!row.partner_tracking_code &&
      partnerSession.partner_code === row.partner_tracking_code;
  } catch {
    isOwner = false;
  }

  // The agent's own price for this package, per traveler. Only a live piece
  // can be re-priced by the customer's own choices, so it is applied to the
  // TOTAL client-side (OrderReview) rather than folded into the ticket line.
  const priceAdjustPerPerson = Number(row.price_adjust_per_person ?? 0) || 0;

  return NextResponse.json({
    event_id: row.event_id,
    event_order_info: eventOrderInfo,
    price_adjust_per_person: priceAdjustPerPerson,
    flight_order_info: flight,
    flight_needs_repick: flightNeedsRepick,
    hotel_order_info: hotel,
    hotel_needs_repick: hotelNeedsRepick,
    num_travelers: row.num_travelers,
    allow_edit: isOwner || row.allow_edit !== false,
    ...(isHouse
      ? { house: true, pax_options: paxOptions, hotel_image: hotelImage }
      : {}),
  });
}
