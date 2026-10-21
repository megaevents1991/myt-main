import { NextResponse } from "next/server";
import type { Event, OrderData } from "@/lib/app.types";
import { validateLiveTicketsOffer, validateOwnStock } from "@/app/api/confirm-order/utils";
import { getEvents } from "@/lib/eventsData";
import { exchangeRateService } from "@/lib/exchangeRateService";
import { extractIpFromRequest, extractUserAgentFromRequest, trackServerSideEvent } from "@/lib/gtmAnalytics";
import {
  buildGroupRows,
  checkDates,
  checkPieces,
  checkRoute,
  failure,
  failureBody,
  parseSubmission,
  toSingleEventOrderData,
  totalsMatch,
  tripState,
  type ConfirmFailure,
  type GroupRowInsert,
  type HeldAnswer,
} from "@/lib/itinerary/confirm";
import { sendTripEmails, tripMailInput } from "@/lib/itinerary/emails";
import { findGroup, insertGroup, type DbError, type GroupDb, type GroupRow } from "@/lib/itinerary/insertGroup";
import { validateItineraryPriceFloor } from "@/lib/itinerary/priceFloor";
import { livePrice } from "@/lib/itinerary/progress";
import { itineraryOn } from "@/lib/itinerary/settings";
import { getItinerarySettings } from "@/lib/itinerary/settings.server";
import type { TripDates } from "@/lib/itinerary/types";
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

/** PostgREST / Postgres "no such column" - the group columns before the backoffice migration. */
const isMissingColumn = (e: DbError): boolean => e?.code === "42703" || e?.code === "PGRST204";

const refuse = (f: ConfirmFailure, route: Event[] = [], dates?: TripDates) =>
  NextResponse.json(failureBody(f, route, dates), { status: f.status });

const heldAnswer = (group: string, rows: GroupRow[]): HeldAnswer => ({
  group,
  ids: rows.map((r) => r.id),
  reference: rows[0]?.booking_reference ?? null,
});

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
 * reference }`; a refusal is `{ error: <code>, message, step?, eventId?, stayKey? }`
 * (lib/itinerary/confirm.ts).
 *
 * In order: the switch (404) -> the request's shape (400) -> the group already written? (200,
 * its rows) -> each event re-read (`getEvents(id)`): still there, eligible and fitting the others
 * (400 ROUTE_CHANGED) -> the dates are the route's own (400) -> every piece ready for the party,
 * no own-stock hotel, every hotel rate sellable (400) -> the live per-event ticket validators of
 * confirm-order (409 TICKET_CHANGED) -> the summary's `livePrice` on that trusted state equals
 * the client's total within $1 (409 PRICE_CHANGED) -> the price floor per row (400) -> the
 * insert (a missing column = 500, nothing written; a concurrent duplicate = that group) -> best
 * effort: booking references, ticket costs, the ops + customer emails, one analytics event.
 *
 * No payment: rows are `24Save` (`Pending` only when payments are on AND the request pays now -
 * phase 3), `payment_info` null. No rate limit (confirm-order has none either).
 */
export async function POST(req: Request) {
  try {
    const settings = await getItinerarySettings();
    if (!itineraryOn(settings, process.env.VERCEL_ENV)) return refuse(failure("NOT_FOUND"));

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return refuse(failure("BAD_REQUEST"));
    }
    const parsed = parseSubmission(raw, settings.maxEvents);
    if (!parsed.ok) {
      console.warn(`${LOG} refused request: ${parsed.reason}`);
      return refuse(failure("BAD_REQUEST"));
    }
    const sub = parsed.sub;

    // The same request again (a double click, a retry after a lost answer): its rows.
    const before = await findGroup(sub.group, reservationsDb);
    if ("rows" in before && before.rows.length) return NextResponse.json(heldAnswer(sub.group, before.rows));
    // Cannot check (the columns are not there yet): the insert below fails closed on the same
    // cause and says so - logged there, once. Anything else is worth a line now.
    if ("unavailable" in before && !isMissingColumn(before.unavailable)) {
      console.warn(`${LOG} group ${sub.group}: idempotency check unavailable:`, JSON.stringify(before.unavailable));
    }

    // The events as they are now - never the browser's copy.
    const found = await Promise.all(sub.route.map(async (id) => (await getEvents(id)).events[0]));
    const todayIso = new Date().toISOString().slice(0, 10);
    const routeCheck = checkRoute(sub.route, found, settings, todayIso);
    if (!routeCheck.ok) {
      console.warn(`${LOG} group ${sub.group}: route changed (event ${routeCheck.failure.eventId ?? "-"})`);
      return refuse(routeCheck.failure, found.filter((e): e is Event => !!e));
    }
    const route = routeCheck.route;

    const datesFailure = checkDates(route, sub);
    if (datesFailure) {
      console.warn(`${LOG} group ${sub.group}: dates are not the route's`, JSON.stringify(sub.dates));
      return refuse(datesFailure, route, sub.dates);
    }

    const state = tripState(sub, route);
    const pieceFailure = checkPieces(state, new Date());
    if (pieceFailure) {
      console.warn(`${LOG} group ${sub.group}: ${pieceFailure.code}`, pieceFailure.eventId ?? pieceFailure.stayKey ?? "");
      return refuse(pieceFailure, route, sub.dates);
    }

    // The live order's own per-event ticket checks (confirm-order route.ts order: LiveTickets, then
    // our own seats). They set the ops flags (non_instant / own_stock) on the info they read.
    const infos = new Map<number, OrderData["event_order_info"]>();
    const ticketErrors = await Promise.all(
      route.map(async (e) => {
        const data = toSingleEventOrderData(sub, e);
        const reason = (await validateLiveTicketsOffer(data)) ?? (await validateOwnStock(data));
        infos.set(e.id, data.event_order_info);
        return reason ? { eventId: e.id, reason } : null;
      }),
    );
    const ticketError = ticketErrors.find((t) => t !== null);
    if (ticketError) {
      console.error(`${LOG} group ${sub.group}: ticket changed:`, JSON.stringify(ticketError));
      return refuse(failure("TICKET_CHANGED", { eventId: ticketError.eventId }), route, sub.dates);
    }

    // ONE price function: the summary's own, on the trusted state.
    const price = livePrice(state, settings);
    if (!price) return refuse(failure("TRIP_INCOMPLETE"), route, sub.dates);
    if (!totalsMatch(price.total, sub.clientTotal)) {
      console.warn(
        `${LOG} group ${sub.group}: price changed - server ${price.total} (${price.perTraveller}/traveller), client ${sub.clientTotal} (${sub.clientPerTraveller}/traveller)`,
      );
      return refuse(failure("PRICE_CHANGED"), route, sub.dates);
    }

    // The live travel rate (the rate the order page quotes and confirm-order's floor uses).
    await exchangeRateService.ensureFresh();
    const rateIls = exchangeRateService.getTravelRate();
    if (!Number.isFinite(rateIls) || rateIls <= 0) {
      console.error(`${LOG} group ${sub.group}: no exchange rate (${rateIls})`);
      return refuse(failure("SERVER_ERROR"));
    }

    const status = settings.paymentsEnabled && sub.payNow ? "Pending" : "24Save";
    const gtmIdnts = cookieValue(req.headers.get("cookie"), "gtmIdnts");
    const rows = buildGroupRows(sub, route, { group: sub.group, rateIls, settings, status, infos, gtmIdnts });

    const floorError = validateItineraryPriceFloor(
      route,
      rows.map((r) => r.final_purchase_price_ils),
      sub.pax,
      settings,
      rateIls,
    );
    if (floorError) {
      console.error(`${LOG} group ${sub.group}: price floor - ${floorError}`);
      return refuse(failure("PRICE_VALIDATION_FAILED"));
    }

    const inserted = await insertGroup(rows, reservationsDb, sub.group);
    if ("error" in inserted) {
      console.error(`${LOG} group ${sub.group}: insert failed, nothing written (one statement) - ${inserted.error}`);
      return refuse(failure("SERVER_ERROR"));
    }
    if (inserted.duplicate) {
      // A concurrent copy of this request wrote the group first - its rows, its emails.
      const again = await findGroup(sub.group, reservationsDb);
      const rowsBack = "rows" in again && again.rows.length ? again.rows : inserted.ids.map((id) => ({ id, itinerary_seq: null }));
      return NextResponse.json(heldAnswer(sub.group, rowsBack));
    }

    // The group is written: from here on nothing may fail the hold.
    const { ids } = inserted;
    let references: (string | null)[] = ids.map(() => null);
    try {
      references = await finishRows(rows, ids);
    } catch (e) {
      console.error(`${LOG} group ${sub.group}: finishing the rows failed:`, e);
    }

    try {
      const mail = tripMailInput({ sub, route, rows, ids, references, price, rateIls });
      // The hold email promises a call back; a pay-now group gets its email from the payment (phase 3).
      const sent = await sendTripEmails(mail, { customer: status === "24Save" });
      if (sent.customer) {
        const { error } = await supabase.from("reservations").update({ confirmation_email_sent: true }).in("id", ids);
        if (error) console.error(`${LOG} group ${sub.group}: confirmation_email_sent not saved:`, JSON.stringify(error));
      }
    } catch (e) {
      console.error(`${LOG} group ${sub.group}: emails failed (non-fatal):`, e);
    }

    // confirm-order's server-side event, once for the trip: a hold is a lead.
    try {
      await trackServerSideEvent({
        eventData: {
          id: route[0].id,
          name: `Euro Trip: ${route.map((e) => e.name).join(" + ")}`,
          value: price.total,
          currency: "USD",
          category: "itinerary",
          brand: "Mega Events",
          quantity: sub.pax,
        },
        eventType: status === "Pending" ? "begin_checkout" : "generate_lead",
        gtmIdnts: gtmIdnts ?? undefined,
        userAgent: extractUserAgentFromRequest(req),
        ip: extractIpFromRequest(req),
      });
    } catch (e) {
      console.warn(`${LOG} group ${sub.group}: analytics failed (non-fatal):`, e);
    }

    const answer: HeldAnswer = { group: sub.group, ids, reference: references[0] ?? null };
    return NextResponse.json(answer);
  } catch (error) {
    console.error(`${LOG} failed:`, error instanceof Error ? error.stack || error.message : JSON.stringify(error));
    return refuse(failure("SERVER_ERROR"));
  }
}
