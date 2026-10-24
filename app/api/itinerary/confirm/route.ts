import { NextResponse } from "next/server";
import type { OrderData } from "@/lib/app.types";
import { validateLiveTicketsOffer, validateOwnStock } from "@/app/api/confirm-order/utils";
import { getEvents } from "@/lib/eventsData";
import { exchangeRateService } from "@/lib/exchangeRateService";
import { extractIpFromRequest, extractUserAgentFromRequest, trackServerSideEvent } from "@/lib/gtmAnalytics";
import { failure, failureBody, type GroupRowInsert } from "@/lib/itinerary/confirm";
import { confirmTrip, isMissingColumn, type ConfirmDeps } from "@/lib/itinerary/confirmFlow";
import { sendTripEmails } from "@/lib/itinerary/emails";
import type { GroupDb } from "@/lib/itinerary/insertGroup";
import { BLOCK_COLUMNS, type OfflineHotelDb } from "@/lib/itinerary/offlineHold";
import { getItinerarySettings } from "@/lib/itinerary/settings.server";
import { isMissingRequestsTable, type SuggestionRow } from "@/lib/itinerary/suggestion";
import { supabase } from "@/lib/supabase";
import { TICKET_COST_DEADLINE_MS, snapshotTicketCost, withDeadline } from "@/lib/ticket-cost";

// Up to three events re-read and re-validated, the supplier cost snapshots and two emails.
export const maxDuration = 30;

const LOG = "[itinerary/confirm]";

/** What is read back of a trip's rows. */
const ROW_COLUMNS = "id, itinerary_seq, booking_reference";

/** The shared client, as the group helpers call it (lib/itinerary/insertGroup.ts). */
const reservationsDb: GroupDb = {
  insert: (rows) => supabase.from("reservations").insert(rows).select(ROW_COLUMNS),
  find: (group) => supabase.from("reservations").select(ROW_COLUMNS).eq("itinerary_group", group),
};

/** Our own hotel stock, as confirm-order reads and holds it (lib/itinerary/offlineHold.ts). */
const offlineHotelsDb: OfflineHotelDb = {
  readBlocks: (ids) => supabase.from("offline_hotels").select(BLOCK_COLUMNS).in("id", ids),
  readConsumed: (id) => supabase.from("offline_hotels").select("consumed_rooms").eq("id", id).single(),
  writeConsumed: (id, consumedRooms) => supabase.from("offline_hotels").update({ consumed_rooms: consumedRooms }).eq("id", id),
};

/**
 * The customer's "offer my trip to others" (backoffice migration 20261024084720). Never throws past the
 * flow's own try: a missing table (migration not applied) is a warning, the same group again (23505 on
 * the unique `itinerary_group`) is already saved, anything else is logged.
 */
async function saveSuggestion(row: SuggestionRow): Promise<void> {
  const { error } = await supabase.from("itinerary_route_requests").insert(row);
  if (!error || error.code === "23505") return;
  if (isMissingRequestsTable(error)) {
    console.warn(`${LOG} itinerary_route_requests missing - suggestion skipped`);
    return;
  }
  console.error(`${LOG} group ${row.itinerary_group}: suggestion not saved:`, JSON.stringify(error));
}

/** One cookie's raw value (the client-side order flow sends `gtmIdnts` the same way, undecoded). */
function cookieValue(header: string | null, name: string): string | null {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=") || null;
  }
  return null;
}

/**
 * After the insert, best effort: the booking reference (confirm-order's `ME<day><id>`) and the
 * supplier's ticket cost (`snapshotTicketCost`, at most TICKET_COST_DEADLINE_MS) on each row.
 * Never throws; answers each row's reference (null when its update failed).
 */
async function finishRows(rows: GroupRowInsert[], ids: number[]): Promise<(string | null)[]> {
  const day = new Date().getDate();
  const costs = await Promise.all(
    rows.map((r) => withDeadline(snapshotTicketCost(r.event_order_info, r.event_id), TICKET_COST_DEADLINE_MS).catch(() => null)),
  );
  return Promise.all(
    ids.map(async (id, i) => {
      const reference = `ME${day}${id}`;
      const cost = costs[i];
      try {
        let { error } = await supabase
          .from("reservations")
          .update({ booking_reference: reference, ...(cost ?? {}) })
          .eq("id", id);
        // The cost columns may not exist yet (backoffice migration 20261008120000) - keep the reference.
        if (error && cost && isMissingColumn(error)) {
          ({ error } = await supabase.from("reservations").update({ booking_reference: reference }).eq("id", id));
        }
        if (error) {
          console.error(`${LOG} row ${id}: booking reference not saved:`, JSON.stringify(error));
          return null;
        }
        return reference;
      } catch (e) {
        console.error(`${LOG} row ${id}: booking reference not saved:`, e);
        return null;
      }
    }),
  );
}

/**
 * POST /api/itinerary/confirm - "Build Your Euro Trip": the trip's 24-hour hold. ONE request
 * writes one `reservations` row per event in ONE bulk insert, tied by the client's
 * `itinerary_group` (a uuid v4 that is also the idempotency key). Answers `{ group, ids,
 * reference, emailed? }` (`emailed`: did this answer send the customer's email); a refusal is `{ error: <code>, message, step?, eventId?, stayKey? }`
 * (lib/itinerary/confirm.ts). The steps and their order: lib/itinerary/confirmFlow.ts - this
 * file only wires the database, the suppliers, the mail and the analytics into them.
 *
 * No payment: rows are always `24Save` until phase 3 (`PAYMENTS_LIVE` in lib/itinerary/confirm.ts;
 * then `Pending` when payments are on AND the request pays now), `payment_info` null. No rate
 * limit (confirm-order has none either).
 */
export async function POST(req: Request) {
  try {
    // An unreadable body is no body: the flow answers the switch first (404 while off), then the
    // shape (400).
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      raw = undefined;
    }

    const gtmIdnts = cookieValue(req.headers.get("cookie"), "gtmIdnts");
    const deps: ConfirmDeps = {
      getSettings: getItinerarySettings,
      vercelEnv: process.env.VERCEL_ENV,
      now: () => new Date(),
      getEvent: async (id) => (await getEvents(id)).events[0],
      // confirm-order route.ts order: LiveTickets, then our own seats.
      validateTicket: async (data: OrderData) => (await validateLiveTicketsOffer(data)) ?? (await validateOwnStock(data)),
      // The live travel rate (the rate the order page quotes and confirm-order's floor uses).
      getRate: async () => {
        await exchangeRateService.ensureFresh();
        return exchangeRateService.getTravelRate();
      },
      groupDb: reservationsDb,
      offlineDb: offlineHotelsDb,
      finishRows,
      sendEmails: sendTripEmails,
      markEmailed: async (ids) => {
        const { error } = await supabase.from("reservations").update({ confirmation_email_sent: true }).in("id", ids);
        if (error) console.error(`${LOG} confirmation_email_sent not saved:`, JSON.stringify(error));
      },
      // confirm-order's server-side event, once for the trip: a hold is a lead.
      track: async (e) => {
        await trackServerSideEvent({
          eventData: {
            id: e.eventId,
            name: e.name,
            value: e.value,
            currency: "USD",
            category: "itinerary",
            brand: "Mega Events",
            quantity: e.quantity,
          },
          eventType: e.status === "Pending" ? "begin_checkout" : "generate_lead",
          gtmIdnts: gtmIdnts ?? undefined,
          userAgent: extractUserAgentFromRequest(req),
          ip: extractIpFromRequest(req),
        });
      },
      saveSuggestion,
      gtmIdnts,
      log: console,
    };

    const { status, body } = await confirmTrip(raw, deps);
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error(`${LOG} failed:`, error instanceof Error ? error.stack || error.message : JSON.stringify(error));
    return NextResponse.json(failureBody(failure("SERVER_ERROR")), { status: 500 });
  }
}
