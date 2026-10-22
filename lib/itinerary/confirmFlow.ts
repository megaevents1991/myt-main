/**
 * "Build Your Euro Trip" - the trip's 24-hour hold, step by step (POST /api/itinerary/confirm).
 *
 * Every database, supplier and mail call is handed in (`ConfirmDeps` - the route wires the real
 * ones), so the ORDER of the steps is unit-tested: what may run before the insert, what only after
 * a fresh insert, and what never runs for a request whose group is already written.
 *
 * In order:
 *  1. the switch (404) -> the request's shape (400, `parseSubmission`);
 *  2. the group already written? -> its rows (200) - nothing else runs;
 *  3. each event re-read: there, listed, eligible, fitting the others (400 ROUTE_CHANGED);
 *  4. the dates are the route's own (400); every piece ready for the party, the flight on the
 *     trip's legs and days (409 FLIGHT_CHANGED), every hotel rate sellable (400);
 *  5. each ticket a row the event still sells, own / static ones not below their price, TixStock
 *     and LiveTickets not below 0.6 of it (409); the supplier's event id is taken from the row;
 *  6. each own-stock stay's blocks: dates (400 OFFLINE_HOTEL_DATE_MISMATCH), rooms, event, price
 *     (409 HOTEL_CHANGED), rooms left (400 OFFLINE_HOTEL_SOLD_OUT), refundability (400); a failed
 *     read 500 - the cost kept is the blocks' own;
 *  7. the live order's per-event ticket validators (409 TICKET_CHANGED);
 *  8. the summary's `livePrice` on that trusted state = the client's total within $1 (409);
 *  9. the travel rate; the rows; the price floor per row (400);
 * 10. ONE insert - an error = 500, nothing written; a concurrent copy (23505) = that group's rows
 *     and nothing else (its own request holds and mails);
 * 11. after a FRESH insert only: own-stock rooms held, booking references + ticket costs, the ops +
 *     customer emails, one analytics event - none of them can fail the hold.
 */
import type { Event, OrderData } from "@/lib/app.types";
import {
  PAYMENTS_LIVE,
  buildGroupRows,
  checkDates,
  checkPieces,
  checkRoute,
  checkTickets,
  withRowEids,
  failure,
  failureBody,
  parseSubmission,
  toSingleEventOrderData,
  totalsMatch,
  tripState,
  type ConfirmFailure,
  type GroupRowInsert,
  type HeldAnswer,
  type TripSubmission,
} from "./confirm";
import { stays } from "./dates";
import { tripMailInput, type TripMailInput } from "./emails";
import { findGroup, insertGroup, type DbError, type GroupDb, type GroupRow } from "./insertGroup";
import { checkOfflineHotel, holdOfflineHotel, type OfflineHotelDb } from "./offlineHold";
import { validateItineraryPriceFloor } from "./priceFloor";
import { livePrice } from "./progress";
import { itineraryOn, type ItinerarySettings } from "./settings";
import type { TripDates } from "./types";

const LOG = "[itinerary/confirm]";

export type GroupStatus = "24Save" | "Pending";

export type ConfirmDeps = {
  getSettings: () => Promise<ItinerarySettings>;
  vercelEnv: string | undefined;
  now: () => Date;
  /** The event as it is now (`getEvents(id)`), undefined when gone. */
  getEvent: (id: number) => Promise<Event | undefined>;
  /** The live per-event ticket checks: `validateLiveTicketsOffer(d) ?? validateOwnStock(d)`. */
  validateTicket: (data: OrderData) => Promise<string | null>;
  /** The live travel rate (ILS per USD). */
  getRate: () => Promise<number>;
  groupDb: GroupDb;
  offlineDb: OfflineHotelDb;
  /** Booking references + ticket costs on the new rows; each row's reference (null = not saved). */
  finishRows: (rows: GroupRowInsert[], ids: number[]) => Promise<(string | null)[]>;
  sendEmails: (mail: TripMailInput, opts: { customer: boolean }) => Promise<{ ops: boolean; customer: boolean }>;
  /** `confirmation_email_sent = true` on the rows. */
  markEmailed: (ids: number[]) => Promise<void>;
  track: (e: { eventId: number; name: string; value: number; quantity: number; status: GroupStatus }) => Promise<void>;
  gtmIdnts: string | null;
  log: Pick<Console, "warn" | "error">;
};

export type ConfirmAnswer = { status: number; body: HeldAnswer | ReturnType<typeof failureBody> };

/** PostgREST / Postgres "no such column" - the group columns before the backoffice migration. */
export const isMissingColumn = (e: DbError): boolean => e?.code === "42703" || e?.code === "PGRST204";

const refuse = (f: ConfirmFailure, route: Event[] = [], dates?: TripDates): ConfirmAnswer => ({
  status: f.status,
  body: failureBody(f, route, dates),
});

const held = (group: string, rows: GroupRow[]): ConfirmAnswer => ({
  status: 200,
  body: { group, ids: rows.map((r) => r.id), reference: rows[0]?.booking_reference ?? null },
});

/** Runs the hold for a request body. Throws only on a bug - the caller answers 500 then. */
export async function confirmTrip(raw: unknown, deps: ConfirmDeps): Promise<ConfirmAnswer> {
  const { log } = deps;
  const settings = await deps.getSettings();
  if (!itineraryOn(settings, deps.vercelEnv)) return refuse(failure("NOT_FOUND"));

  const parsed = parseSubmission(raw, settings.maxEvents);
  if (!parsed.ok) {
    log.warn(`${LOG} refused request: ${parsed.reason}`);
    return refuse(failure("BAD_REQUEST"));
  }
  const sub = parsed.sub;

  // The same request again (a double click, a retry after a lost answer): its rows, nothing else.
  const before = await findGroup(sub.group, deps.groupDb);
  if ("rows" in before && before.rows.length) return held(sub.group, before.rows);
  // Cannot check (the columns are not there yet): the insert fails closed on the same cause and
  // says so - logged there, once. Anything else is worth a line now.
  if ("unavailable" in before && !isMissingColumn(before.unavailable)) {
    log.warn(`${LOG} group ${sub.group}: idempotency check unavailable:`, JSON.stringify(before.unavailable));
  }

  // The events as they are now - never the browser's copy.
  const now = deps.now();
  const found = await Promise.all(sub.route.map((id) => deps.getEvent(id)));
  const routeCheck = checkRoute(sub.route, found, settings, now.toISOString().slice(0, 10));
  if (!routeCheck.ok) {
    log.warn(`${LOG} group ${sub.group}: route changed (event ${routeCheck.failure.eventId ?? "-"})`);
    return refuse(routeCheck.failure, found.filter((e): e is Event => !!e));
  }
  const route = routeCheck.route;

  const datesFailure = checkDates(route, sub);
  if (datesFailure) {
    log.warn(`${LOG} group ${sub.group}: dates are not the route's`, JSON.stringify(sub.dates));
    return refuse(datesFailure, route, sub.dates);
  }

  const pieceFailure = checkPieces(tripState(sub, route), now) ?? checkTickets(route, sub.tickets);
  if (pieceFailure) {
    log.warn(`${LOG} group ${sub.group}: ${pieceFailure.code}`, pieceFailure.eventId ?? pieceFailure.stayKey ?? "");
    return refuse(pieceFailure, route, sub.dates);
  }

  // Our own hotel stock, per stay, against its rows (lib/itinerary/offlineHold.ts). The cost kept
  // on the row is the blocks' own.
  const verifiedHotels = { ...sub.hotels };
  for (const stay of stays(route, sub.dates)) {
    const hotel = sub.hotels[stay.key];
    const ctx = { pax: sub.pax, eventIds: stay.events.map((e) => e.id), now };
    const verdict = await checkOfflineHotel(hotel, ctx, deps.offlineDb);
    const about = { stayKey: stay.key };
    switch (verdict.result) {
      case "ok":
        if (hotel && verdict.cost !== null) verifiedHotels[stay.key] = { ...hotel, offlineRawPrice: verdict.cost };
        break;
      case "error":
        log.error(`${LOG} group ${sub.group}: Failed to validate offline hotel (stay ${stay.key}):`, JSON.stringify(verdict.error));
        return refuse(failure("SERVER_ERROR"));
      case "mismatch":
        log.error(
          `${LOG} group ${sub.group}: offline hotel date mismatch (stay ${stay.key}) - rejecting.`,
          JSON.stringify({ checkin: hotel?.checkin, checkout: hotel?.checkout, rows: verdict.rows }),
        );
        return refuse(failure("OFFLINE_HOTEL_DATE_MISMATCH", about), route, sub.dates);
      case "changed":
        log.error(`${LOG} group ${sub.group}: offline hotel does not match its blocks (stay ${stay.key}): ${verdict.reason}`);
        return refuse(failure("HOTEL_CHANGED", about, 409), route, sub.dates);
      case "sold_out":
        log.warn(`${LOG} group ${sub.group}: offline block ${verdict.rowId} has ${verdict.left} rooms left, asked ${verdict.asked}`);
        return refuse(failure("OFFLINE_HOTEL_SOLD_OUT", about), route, sub.dates);
      case "not_refundable":
        return refuse(failure("HOTEL_NOT_REFUNDABLE", about), route, sub.dates);
    }
  }
  // The blocks' own cost on own-stock hotels; the supplier's event id from each ticket's own row.
  const trusted: TripSubmission = { ...sub, hotels: verifiedHotels, tickets: withRowEids(route, sub.tickets) };
  const state = tripState(trusted, route);

  // The live order's own per-event ticket checks; they set the ops flags (non_instant / own_stock)
  // on the info they read. (A LiveTickets ticket also had the stored-price floor in step 5.)
  const infos = new Map<number, OrderData["event_order_info"]>();
  const ticketErrors = await Promise.all(
    route.map(async (e) => {
      const data = toSingleEventOrderData(trusted, e);
      const reason = await deps.validateTicket(data);
      infos.set(e.id, data.event_order_info);
      return reason ? { eventId: e.id, reason } : null;
    }),
  );
  const ticketError = ticketErrors.find((t) => t !== null);
  if (ticketError) {
    log.error(`${LOG} group ${sub.group}: ticket changed:`, JSON.stringify(ticketError));
    return refuse(failure("TICKET_CHANGED", { eventId: ticketError.eventId }), route, sub.dates);
  }

  // ONE price function: the summary's own, on the trusted state.
  const price = livePrice(state, settings);
  if (!price) return refuse(failure("TRIP_INCOMPLETE"), route, sub.dates);
  if (!totalsMatch(price.total, sub.clientTotal)) {
    log.warn(
      `${LOG} group ${sub.group}: price changed - server ${price.total} (${price.perTraveller}/traveller), client ${sub.clientTotal} (${sub.clientPerTraveller}/traveller)`,
    );
    return refuse(failure("PRICE_CHANGED"), route, sub.dates);
  }

  const rateIls = await deps.getRate();
  if (!Number.isFinite(rateIls) || rateIls <= 0) {
    log.error(`${LOG} group ${sub.group}: no exchange rate (${rateIls})`);
    return refuse(failure("SERVER_ERROR"));
  }

  // Phase 3 (`PAYMENTS_LIVE` off): always a hold - a crafted `payNow` never writes `Pending`.
  const status: GroupStatus = PAYMENTS_LIVE && settings.paymentsEnabled && sub.payNow ? "Pending" : "24Save";
  const rows = buildGroupRows(trusted, route, {
    group: sub.group,
    rateIls,
    settings,
    status,
    infos,
    gtmIdnts: deps.gtmIdnts,
  });

  const floorError = validateItineraryPriceFloor(
    route,
    rows.map((r) => r.final_purchase_price_ils),
    sub.pax,
    settings,
    rateIls,
  );
  if (floorError) {
    log.error(`${LOG} group ${sub.group}: price floor - ${floorError}`);
    return refuse(failure("PRICE_VALIDATION_FAILED"));
  }

  const inserted = await insertGroup(rows, deps.groupDb, sub.group);
  if ("error" in inserted) {
    log.error(`${LOG} group ${sub.group}: insert failed, nothing written (one statement) - ${inserted.error}`);
    return refuse(failure("SERVER_ERROR"));
  }
  if (inserted.duplicate) {
    // A concurrent copy of this request wrote the group first - its rows; its request holds and mails.
    const again = await findGroup(sub.group, deps.groupDb);
    const rowsBack = "rows" in again && again.rows.length ? again.rows : inserted.ids.map((id) => ({ id, itinerary_seq: null }));
    return held(sub.group, rowsBack);
  }

  // The group is written: from here on nothing may fail the hold.
  const { ids } = inserted;
  const whole = ids.length === rows.length;
  if (!whole) log.error(`${LOG} group ${sub.group}: ${ids.length} ids for ${rows.length} rows - finishing what can be matched`);

  // Our own hotel stock is held right away - released only on cancellation (confirm-order
  // route.ts:454 -> holdOfflineInventory). Never throws.
  for (const stay of stays(route, sub.dates)) await holdOfflineHotel(trusted.hotels[stay.key], deps.offlineDb);

  let references: (string | null)[] = ids.map(() => null);
  if (whole) {
    try {
      references = await deps.finishRows(rows, ids);
    } catch (e) {
      log.error(`${LOG} group ${sub.group}: finishing the rows failed:`, e);
    }
  }

  // Whether the customer's email went out - the confirmation claims it only then.
  let emailed = false;
  try {
    const mail = tripMailInput({ sub: trusted, route, rows, ids, references, price, rateIls });
    // The hold email promises a call back; a pay-now group gets its email from the payment (phase 3).
    const sent = await deps.sendEmails(mail, { customer: status === "24Save" });
    emailed = sent.customer === true;
    if (sent.customer) await deps.markEmailed(ids);
  } catch (e) {
    log.error(`${LOG} group ${sub.group}: emails failed (non-fatal):`, e);
  }

  try {
    await deps.track({
      eventId: route[0].id,
      name: `Euro Trip: ${route.map((e) => e.name).join(" + ")}`,
      value: price.total,
      quantity: sub.pax,
      status,
    });
  } catch (e) {
    log.warn(`${LOG} group ${sub.group}: analytics failed (non-fatal):`, e);
  }

  return { status: 200, body: { group: sub.group, ids, reference: references[0] ?? null, emailed } };
}
