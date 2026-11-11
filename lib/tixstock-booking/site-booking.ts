// The site's own TixStock booking, for the hidden SANDBOX test checkout only (`is_test` + `tixstock_booking:
// "sandbox_site"` - TixStock's health check). A real order is never booked from the site: the first `if` of every
// function here sends it away before any read.
//
//   pay click (confirm-order)  prepareSiteHold -> recordSiteHold      hold EXACTLY the listing the card showed
//   after the payment          (the payment half - further down)      order, approve, link e-mail; release on failure
//
// Every DB / network call goes through `SiteHoldDeps` (the real ones: site-booking-deps.ts), so the rules are tested
// without either: lib/__tests__/tixstockSiteHold.test.ts. Nothing here throws into its caller.
import type { TixStockListing } from "@/lib/tixstock.types";
import { isExcludedSection } from "@/lib/tixstock-feed";
import { holdExpired, type TixstockCall } from "./client";
import {
  attendeeIssues,
  buildOrderRequest,
  isSandboxBookingEvent,
  ourOrderId,
  readListingSnapshot,
  siteBooksAfterPayment,
  ticketPageUrl,
  type AttendeeInput,
  type BookingStatus,
  type Buyer,
  type EventFlags,
  type ListingSnapshot,
} from "./rules";
import { sandboxCards } from "./sandbox-cards";

const LOG = "[tixstock-site-booking]";

/** What the hold needs of the event: its flags, its id at TixStock and the sections staff took off sale. */
export type SiteEvent = EventFlags & { tixEventId: string | null; excludedSections: string[] };

export type SiteHoldDeps = {
  /** The event row, read fresh. Null = it could not be read. */
  loadEventFlags(eventId: number): Promise<SiteEvent | null>;
  /** The sandbox feed's listings of the event; null when it did not answer (or no sandbox token here). */
  listings(tixEventId: string): Promise<TixStockListing[] | null>;
  /** The TixStock event's venue country (`IT` = the Italian attendee details are required). */
  venueCountry(tixEventId: string): Promise<TixstockCall<string | null>>;
  hold(listingId: string, qty: number): Promise<TixstockCall<{ holdId: string }>>;
  release(holdId: string, qty: number): Promise<TixstockCall<true>>;
  /** Inserts the `ticket_bookings` row. `error` = why it was not stored. */
  insertBooking(row: Record<string, unknown>): Promise<{ error: string | null }>;
  /** The customer's ticket-page token: 32 random bytes, base64url (43 characters). */
  newToken(): string;
};

/** A listing held for a customer who pressed pay, with everything its booking row keeps. */
export type HeldListing = {
  holdId: string;
  tixEventId: string;
  listingId: string;
  quantity: number;
  /** What the customer's card showed per ticket (the feed's amount, rounded up). */
  pricePerTicketUsd: number;
  /** The feed's amount exactly as received - what TixStock is told in orders/add. */
  listingAmountUsd: number;
  snapshot: ListingSnapshot;
  attendees: AttendeeInput[];
  italian: boolean;
};

export type SiteHoldResult =
  | { kind: "none" }
  | { kind: "held"; held: HeldListing }
  | { kind: "unavailable" }
  | { kind: "bad_attendees" };

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** The feed sends booleans as strings: "false" must read as false. */
const flag = (v: unknown): boolean =>
  v === true || v === 1 || (typeof v === "string" && ["true", "1", "yes"].includes(v.trim().toLowerCase()));

/** The attendees the request carried, shaped and judged by the order's own rule. Null = not acceptable. */
const readAttendees = (v: unknown, quantity: number, italian: boolean): AttendeeInput[] | null => {
  if (!Array.isArray(v) || v.length !== quantity) return null;
  const out: AttendeeInput[] = [];
  for (const raw of v) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
    const o: Record<string, unknown> = { ...raw };
    const attendee: AttendeeInput = { first_name: text(o.first_name), last_name: text(o.last_name) };
    // Outside Italy the identity details are never kept, whatever the request carried.
    if (italian) {
      if (text(o.passport)) attendee.passport = text(o.passport);
      if (text(o.nationality)) attendee.nationality = text(o.nationality).toUpperCase();
      if (text(o.dob)) attendee.dob = text(o.dob);
      if (o.gender === "M" || o.gender === "F") attendee.gender = o.gender;
      if (text(o.birth_place)) attendee.birth_place = text(o.birth_place);
    }
    if (attendeeIssues(attendee, italian).length > 0) return null;
    out.push(attendee);
  }
  return out;
};

const snapshotOf = (listing: TixStockListing, card: ReturnType<typeof sandboxCards>[number], italian: boolean): ListingSnapshot => ({
  category: card.category,
  section: text(listing.seat_details?.section) || null,
  row: text(listing.seat_details?.row) || null,
  generalAdmission: flag(listing.ticket?.general_admission),
  ticketType: card.ticketType,
  splitType: card.splitType,
  restrictions: card.restrictions,
  deliveryDate: card.deliveryDate,
  deliveryType: text(listing.delivery?.type) || null,
  instantDownload: card.instantDownload,
  italian,
});

/**
 * The pay click of a sandbox test event: hold exactly the listing the customer's card carried - after checking that
 * it is still this event's, still sells this party (split rules, quantity, view, lead booker: the card's own rule)
 * and costs no more than the customer is paying for it.
 *
 * `none` = not ours: no listing id (EVERY real order - nothing is read for it), not a card payment, or an event the
 * site does not book for. `unavailable` = the customer is sent back to the ticket step's fresh cards.
 * `bad_attendees` = the request's attendees do not fit the order. Nothing is held on any answer but `held`.
 */
export async function prepareSiteHold(
  req: {
    listingId: unknown;
    attendees: unknown;
    eventId: number;
    quantity: number;
    payNow: boolean;
    chargedPerTicketUsd: number;
  },
  deps: SiteHoldDeps,
): Promise<SiteHoldResult> {
  const listingId = text(req.listingId);
  if (listingId === "" || !req.payNow) return { kind: "none" };

  try {
    const event = await deps.loadEventFlags(req.eventId);
    if (!event) {
      console.warn(`${LOG} the event of an order with a listing id could not be read`, { eventId: req.eventId });
      return { kind: "unavailable" };
    }
    if (!siteBooksAfterPayment(event)) {
      // A real event's order never carries a listing id: this is a tampered or stale request. It goes through as
      // the ordinary order it is - no hold, no booking.
      if (!isSandboxBookingEvent(event)) {
        console.warn(`${LOG} a listing id on an event that is not a sandbox test event - ignored`, { eventId: req.eventId });
      }
      return { kind: "none" };
    }

    const refuse = (why: string): SiteHoldResult => {
      console.warn(`${LOG} no hold: ${why}`, { eventId: req.eventId, listingId, quantity: req.quantity });
      return { kind: "unavailable" };
    };

    if (!event.tixEventId) return refuse("the event has no TixStock event id");
    if (!Number.isInteger(req.quantity) || req.quantity < 1) return refuse("not a quantity");

    const listings = await deps.listings(event.tixEventId);
    if (!listings) return refuse("the sandbox feed did not answer");
    const listing = listings.find((l) => String(l.id) === listingId);
    if (!listing) return refuse("the listing is no longer on sale for this event");
    if (isExcludedSection(listing, event.excludedSections)) return refuse("the listing's section is off sale");

    // The ticket step's own rule, on this one listing: a card exists only when it can sell the party.
    const card = sandboxCards([listing], req.quantity)[0];
    if (!card) return refuse("the listing no longer sells this party");
    if (!(card.pricePerTicketUsd <= req.chargedPerTicketUsd)) return refuse("the listing is dearer than the customer's price");

    const country = await deps.venueCountry(event.tixEventId);
    if (!country.ok) return refuse("the event's venue could not be read");
    const italian = (country.data ?? "").trim().toUpperCase() === "IT";

    const attendees = readAttendees(req.attendees, req.quantity, italian);
    if (!attendees) return { kind: "bad_attendees" };

    const hold = await deps.hold(listingId, req.quantity);
    if (!hold.ok) return refuse(`the hold was not placed (${hold.kind === "refused" ? hold.message : hold.detail})`);

    return {
      kind: "held",
      held: {
        holdId: hold.data.holdId,
        tixEventId: event.tixEventId,
        listingId,
        quantity: req.quantity,
        pricePerTicketUsd: card.pricePerTicketUsd,
        listingAmountUsd: card.listingAmountUsd,
        snapshot: snapshotOf(listing, card, italian),
        attendees,
        italian,
      },
    };
  } catch (e) {
    console.error(`${LOG} hold failed:`, e instanceof Error ? e.message : String(e));
    return { kind: "unavailable" };
  }
}

/** Gives a held listing back (the reservation was not stored, or its booking row was not). Never throws. */
export async function releaseHeld(held: HeldListing, deps: SiteHoldDeps): Promise<void> {
  try {
    const released = await deps.release(held.holdId, held.quantity);
    if (!released.ok) {
      console.error(`${LOG} release not confirmed (TixStock frees a hold by itself after about 10 minutes)`, { holdId: held.holdId });
    }
  } catch (e) {
    console.error(`${LOG} release failed:`, e instanceof Error ? e.message : String(e));
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * The booking row of a held listing: `on_hold`, booked by the site, in the sandbox, with the customer's ticket-page
 * token. When the row is not stored the hold is released - a hold nobody knows about must not sit on a listing.
 * Never throws: the reservation exists and the customer goes on to pay; a paid order with no booking row is shown
 * to staff by the backoffice sweep.
 */
export async function recordSiteHold(reservationId: number, held: HeldListing, buyer: Buyer, deps: SiteHoldDeps): Promise<void> {
  try {
    const { error } = await deps.insertBooking({
      reservation_id: reservationId,
      env: "sandbox",
      source: "site",
      status: "on_hold",
      tixstock_event_id: held.tixEventId,
      listing_id: held.listingId,
      hold_id: held.holdId,
      quantity: held.quantity,
      listing: held.snapshot,
      // The feed's amount, never the card's rounded price: it is what orders/add states.
      price_per_ticket: held.listingAmountUsd,
      currency: "USD",
      total: round2(held.listingAmountUsd * held.quantity),
      buyer,
      attendees: held.attendees,
      created_by: "site",
      customer_token: deps.newToken(),
    });
    if (!error) return;
    console.error(`${LOG} the booking row was not stored - releasing the hold`, { reservationId, error });
  } catch (e) {
    console.error(`${LOG} the booking row was not stored - releasing the hold`, { reservationId, error: e instanceof Error ? e.message : String(e) });
  }
  await releaseHeld(held, deps);
}

/** The buyer TixStock is told: the order's main contact. */
export function buyerFromOrder(o: {
  main_contact_first_name: string;
  main_contact_last_name: string;
  main_contact_email: string;
  main_contact_phone_number: string;
}): Buyer {
  return {
    first_name: text(o.main_contact_first_name),
    last_name: text(o.main_contact_last_name),
    email: text(o.main_contact_email),
    phone: text(o.main_contact_phone_number),
  };
}

// ─────────────────────────────── after the payment ───────────────────────────────

/** A site booking row, as the payment half reads it. */
export type SiteBookingRow = {
  id: string;
  reservation_id: number;
  status: BookingStatus;
  hold_id: string | null;
  listing_id: string;
  quantity: number;
  /** The listing as booked (`ListingSnapshot`), as stored. */
  listing: unknown;
  price_per_ticket: number | null;
  buyer: unknown;
  attendees: unknown;
  customer_token: string;
  link_email_sent_at: string | null;
  tixstock_order_id?: string | null;
  order_currency?: string | null;
  order_total?: number | null;
  last_error?: string | null;
};

export type SitePaymentDeps = {
  now(): Date;
  /** The reservation's newest `source = site` booking; null when it has none (every real order). */
  loadSiteBooking(reservationId: number): Promise<SiteBookingRow | null>;
  /**
   * Compare-and-set, in ONE statement: the row moves only if it still has `from`; `patch` rides with the move.
   * False = someone else moved it first.
   */
  moveStatus(id: string, from: BookingStatus, to: BookingStatus, atIso: string, patch?: Record<string, unknown>): Promise<boolean>;
  hold(listingId: string, qty: number): Promise<TixstockCall<{ holdId: string }>>;
  release(holdId: string, qty: number): Promise<TixstockCall<true>>;
  addOrder(
    holdId: string,
    qty: number,
    body: Record<string, unknown>,
  ): Promise<TixstockCall<{ orderId: string; status: string; currency: string | null; total: number | null }>>;
  updateOrder(orderId: string, body: Record<string, unknown>): Promise<TixstockCall<{ status: string }>>;
  /** The event's name as the reservation keeps it, for the link e-mail. */
  loadEventName(reservationId: number): Promise<string>;
  /** Takes the booking's one link e-mail (`link_email_sent_at` null -> atIso); false when it is taken. */
  claimLinkEmail(id: string, atIso: string): Promise<boolean>;
  unclaimLinkEmail(id: string, atIso: string): Promise<void>;
  sendTicketLinkEmail(to: string, eventName: string, url: string): Promise<void>;
};

export type SiteBookingOutcome = "none" | "busy" | "approved" | "sale_on_hold" | "uncertain" | "failed";

const readBuyer = (v: unknown): Buyer => {
  const o: Record<string, unknown> = v !== null && typeof v === "object" && !Array.isArray(v) ? { ...v } : {};
  return { first_name: text(o.first_name), last_name: text(o.last_name), email: text(o.email), phone: text(o.phone) };
};

/** The attendees as the hold stored them (already shaped and judged there); the order body judges them again. */
const storedAttendees = (v: unknown): AttendeeInput[] => {
  if (!Array.isArray(v)) return [];
  return v.flatMap((raw): AttendeeInput[] => {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return [];
    const o: Record<string, unknown> = { ...raw };
    const attendee: AttendeeInput = { first_name: text(o.first_name), last_name: text(o.last_name) };
    if (text(o.passport)) attendee.passport = text(o.passport);
    if (text(o.nationality)) attendee.nationality = text(o.nationality);
    if (text(o.dob)) attendee.dob = text(o.dob);
    if (o.gender === "M" || o.gender === "F") attendee.gender = o.gender;
    if (text(o.birth_place)) attendee.birth_place = text(o.birth_place);
    return [attendee];
  });
};

const why = (r: TixstockCall<unknown>): string =>
  r.ok ? "" : r.kind === "refused" ? `refused ${r.status}: ${r.message}`.slice(0, 300) : `no answer: ${r.detail}`.slice(0, 300);

/**
 * The customer paid (the card gateway confirmed it): order the held tickets as `Sale on Hold`, then approve, then
 * send the ticket-page link. Called by BOTH payment callers of every payment, one after the other - so the first
 * step is a claim (`on_hold` -> `ordering`, one compare-and-set): whoever does not get it answers `busy` and calls
 * nothing. The claim is a status, never a timer - a claim a second caller could take again is a second orders/add,
 * and TixStock says a repeated orders/add can create a second order.
 *
 * - A hold that ran out (the customer took over ten minutes to pay) answers orders/add with "Resource Not Found":
 *   the same listing is held ONCE more and ordered. Only on that answer, only on the first attempt.
 * - An orders/add nobody answered is `uncertain`: no release, no retry, no further call - staff settle it.
 * - Any other refusal releases the hold and the row is `failed`; staff book the order from the backoffice.
 * - A row whose hold was already released (a failed payment, then a successful one) is claimed from `released`
 *   and gets a new hold first.
 *
 * Never throws.
 */
export async function bookSiteOrderAfterPayment(orderId: string, deps: SitePaymentDeps): Promise<SiteBookingOutcome> {
  const reservationId = Number(orderId);
  if (!Number.isInteger(reservationId) || reservationId < 1) return "none";

  try {
    const row = await deps.loadSiteBooking(reservationId);
    if (!row) return "none";
    if (row.status !== "on_hold" && row.status !== "released") return "busy";

    const at = deps.now();
    const atIso = at.toISOString();
    if (!(await deps.moveStatus(row.id, row.status, "ordering", atIso, { attempt_started_at: atIso }))) return "busy";

    const fail = async (lastError: string, holdToRelease: string | null): Promise<SiteBookingOutcome> => {
      console.error(`${LOG} the paid order was not booked`, { reservationId, booking: row.id, lastError });
      await deps.moveStatus(row.id, "ordering", "failed", deps.now().toISOString(), { last_error: lastError });
      if (holdToRelease) {
        const released = await deps.release(holdToRelease, row.quantity);
        if (!released.ok) console.error(`${LOG} release not confirmed`, { booking: row.id });
      }
      return "failed";
    };

    const snapshot = readListingSnapshot(row.listing);
    const buyer = readBuyer(row.buyer);
    const pricePerTicket = Number(row.price_per_ticket);
    const request = buildOrderRequest({
      status: "Sale on Hold",
      at,
      reservationId,
      bookingId: row.id,
      buyer,
      attendees: storedAttendees(row.attendees),
      quantity: row.quantity,
      italian: snapshot.italian,
      listing: { generalAdmission: snapshot.generalAdmission, row: snapshot.row ?? "", pricePerTicket },
    });
    // A row claimed from `released` holds nothing; one claimed from `on_hold` still names its hold.
    const firstHold = row.status === "on_hold" ? row.hold_id : null;
    if (!request.ok) return fail(`order_body_${request.kind}`, firstHold);
    if (!Number.isFinite(pricePerTicket) || pricePerTicket <= 0) return fail("order_body_price", firstHold);

    // The hold the order is placed on, and whether it is one this call placed (a replacement is never replaced).
    let holdId = firstHold;
    let replaced = false;
    if (!holdId) {
      const fresh = await deps.hold(row.listing_id, row.quantity);
      if (!fresh.ok) return fail(`hold_again: ${why(fresh)}`, null);
      holdId = fresh.data.holdId;
      replaced = true;
    }

    let answer = await deps.addOrder(holdId, row.quantity, request.body);
    if (!answer.ok && answer.kind === "refused" && holdExpired(answer) && !replaced) {
      const fresh = await deps.hold(row.listing_id, row.quantity);
      if (!fresh.ok) return fail(`hold_expired, hold_again: ${why(fresh)}`, null);
      holdId = fresh.data.holdId;
      replaced = true;
      answer = await deps.addOrder(holdId, row.quantity, request.body);
    }

    if (!answer.ok && answer.kind === "no_answer") {
      // TixStock may have created the order: nothing is released, nothing is tried again.
      console.error(`${LOG} orders/add was not answered - uncertain`, { reservationId, booking: row.id });
      await deps.moveStatus(row.id, "ordering", "uncertain", deps.now().toISOString(), {
        last_error: why(answer),
        ...(replaced ? { hold_id: holdId } : {}),
      });
      return "uncertain";
    }
    if (!answer.ok) return fail(`orders_add: ${why(answer)}`, holdId);

    const { orderId: tixstockOrderId, currency, total } = answer.data;
    const expected = round2(pricePerTicket * row.quantity);
    if ((currency ?? "USD").toUpperCase() !== "USD" || (total !== null && Math.abs(total - expected) > 0.01)) {
      console.warn("tixstock_order_total_mismatch", JSON.stringify({ booking: row.id, reservationId, expected, currency, total }));
    }
    await deps.moveStatus(row.id, "ordering", "sale_on_hold", deps.now().toISOString(), {
      tixstock_order_id: tixstockOrderId,
      order_currency: currency,
      order_total: total,
      ...(replaced ? { hold_id: holdId } : {}),
    });

    // The payment check is the gateway's own answer, read before this function was called: approve at once.
    const approved = await deps.updateOrder(ourOrderId(reservationId, row.id), { order_status: "Approved" });
    if (!approved.ok) {
      // The backoffice sweep approves a paid `sale_on_hold` order on its next run.
      console.warn(`${LOG} approve not done - left as sale_on_hold for the sweep`, { booking: row.id, why: why(approved) });
      return "sale_on_hold";
    }
    const approvedAt = deps.now().toISOString();
    await deps.moveStatus(row.id, "sale_on_hold", "approved", approvedAt);

    // The ticket-page link: one sender at a time (the claim); a failed send gives the claim back for the sweep.
    if (buyer.email && row.customer_token && (await deps.claimLinkEmail(row.id, approvedAt))) {
      try {
        await deps.sendTicketLinkEmail(buyer.email, await deps.loadEventName(reservationId), ticketPageUrl(row.customer_token));
      } catch (e) {
        await deps.unclaimLinkEmail(row.id, approvedAt);
        console.error(`${LOG} link email failed`, { booking: row.id, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return "approved";
  } catch (e) {
    // The row keeps whatever status the last successful write gave it; an `ordering` row that nobody finishes is
    // turned into `uncertain` by the backoffice sweep.
    console.error(`${LOG} after-payment booking failed:`, e instanceof Error ? e.message : String(e));
    return "failed";
  }
}

/**
 * The payment did not succeed: the site's open hold goes back (`on_hold` -> `released`, then the release itself).
 * A later successful payment of the same order is booked through `released` -> `ordering`. Never throws.
 */
export async function releaseSiteHoldFor(orderId: string, deps: SitePaymentDeps): Promise<void> {
  const reservationId = Number(orderId);
  if (!Number.isInteger(reservationId) || reservationId < 1) return;
  try {
    const row = await deps.loadSiteBooking(reservationId);
    if (!row || row.status !== "on_hold") return;
    if (!(await deps.moveStatus(row.id, "on_hold", "released", deps.now().toISOString()))) return;
    if (!row.hold_id) return;
    const released = await deps.release(row.hold_id, row.quantity);
    if (!released.ok) console.warn(`${LOG} release not confirmed (the hold runs out by itself)`, { booking: row.id });
  } catch (e) {
    console.error(`${LOG} release after a failed payment did not run:`, e instanceof Error ? e.message : String(e));
  }
}
