/**
 * Single source of truth for partner payout — ported verbatim from
 * myt-backoffice's lib/partner-commission.ts (same shared `reservations` /
 * `partners` tables). Do not re-derive this math elsewhere: the backoffice
 * comment on the original explains why it exists at all — "the portal once
 * read the column as a percentage while the monthly report cron paid it as
 * $/ticket, so the same partner saw two different payouts for the same
 * month." Every partner-facing surface in this app must call in here too.
 */

export type CommissionType = "fixed_per_ticket" | "percent_of_sale";

type EventOrderInfoItem = { number_of_ticket?: number | null };
type EventOrderInfo = EventOrderInfoItem | { events: EventOrderInfoItem[] } | null | undefined;

type ReservationLike = {
  status?: string | null;
  user_shown_price?: number | null;
  event_order_info?: EventOrderInfo;
};

/** How a partner is paid. `rate` is `partners.commission`. */
export type CommissionTerms = {
  type: CommissionType | null;
  rate: number | null;
};

/** A reservation's event_order_info is either one event, or `{events: [...]}` for a combined booking. */
function normalizeEventOrderInfo(eventOrderInfo: EventOrderInfo): EventOrderInfoItem[] {
  if (!eventOrderInfo) return [];
  if (
    typeof eventOrderInfo === "object" &&
    "events" in eventOrderInfo &&
    Array.isArray((eventOrderInfo as { events?: unknown }).events)
  ) {
    return (eventOrderInfo as { events: EventOrderInfoItem[] }).events;
  }
  return [eventOrderInfo as EventOrderInfoItem];
}

/** Tickets in one reservation, summed across every event in its order info. */
export function countReservationTickets(reservation: ReservationLike): number {
  return normalizeEventOrderInfo(reservation.event_order_info).reduce(
    (sum, event) => sum + (Number(event.number_of_ticket) || 0),
    0,
  );
}

/** Tickets across many reservations. */
export function countTickets(reservations: ReservationLike[]): number {
  return reservations.reduce((sum, r) => sum + countReservationTickets(r), 0);
}

/**
 * The one status that earns commission. Every writer in both apps stores
 * exactly this casing, and the backoffice's monthly cron bills on
 * `.eq("status", PAID_STATUS)` — a looser check would show partners
 * commission the cron never actually pays.
 */
export const PAID_STATUS = "Paid";

/** A reservation only earns commission once it is paid. */
export function isPaid(reservation: ReservationLike): boolean {
  return reservation.status === PAID_STATUS;
}

/** The package price the customer paid — the base for percentage commission. */
export function saleValue(reservation: ReservationLike): number {
  return reservation.user_shown_price ?? 0;
}

/** Sales total across reservations. */
export function sumSales(reservations: ReservationLike[]): number {
  return reservations.reduce((sum, r) => sum + saleValue(r), 0);
}

function isUsableRate(rate: number | null): rate is number {
  return rate != null && Number.isFinite(rate);
}

/**
 * Commission in USD for one reservation. Returns 0 unless it is paid, so
 * this is safe to map over a mixed list.
 */
export function commissionForReservation(
  reservation: ReservationLike,
  terms: CommissionTerms,
): number {
  if (!isPaid(reservation)) return 0;
  if (!isUsableRate(terms.rate)) return 0;
  if (terms.type === "percent_of_sale") {
    return (saleValue(reservation) * terms.rate) / 100;
  }
  // fixed_per_ticket is the default for every legacy row, so an unset or
  // unrecognised type must land here — that is how the cron has always paid.
  return countReservationTickets(reservation) * terms.rate;
}

/** Commission in USD earned by the paid reservations in the list. */
export function commissionForReservations(
  reservations: ReservationLike[],
  terms: CommissionTerms,
): number {
  return reservations.reduce((sum, r) => sum + commissionForReservation(r, terms), 0);
}

/**
 * Site credit accrued on paid reservations — separate from cash commission,
 * and paid in addition to it. Accrues per ticket, the same unit the monthly
 * report counts, so the two figures always agree about what a "passenger" is.
 */
export function creditAccrued(
  reservations: ReservationLike[],
  creditPerTicket: number | null,
): number {
  if (!creditPerTicket || !Number.isFinite(creditPerTicket)) return 0;
  return countTickets(reservations.filter(isPaid)) * creditPerTicket;
}

/**
 * The instant historical partner balances were settled outside this system —
 * commission and site credit both. Mirrors the backfill in the backoffice's
 * migration 20260729220000, which stamps exactly this value into `billed_at`.
 *
 * That makes the two distinguishable: a reservation stamped AT the cutoff was
 * part of the settlement, while anything the monthly cron stamps later was not.
 */
export const SETTLEMENT_CUTOFF_ISO = "2026-07-01T00:00:00+00:00";
const SETTLEMENT_CUTOFF_MS = Date.parse(SETTLEMENT_CUTOFF_ISO);

/** True when this reservation was part of the pre-cutoff settlement. */
export function wasSettledAtCutoff(billedAt: string | null | undefined): boolean {
  if (!billedAt) return false;
  const stamped = Date.parse(billedAt);
  return Number.isFinite(stamped) && stamped <= SETTLEMENT_CUTOFF_MS;
}

/** Money is compared and stored to the cent; floats drift past that. */
export function round2(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Human-readable rate, e.g. "$25 per ticket" or "8% of sales". A rate of 0 is
 * shown as "$0", not "—": partners created alongside a user start at 0, and
 * "not configured yet" must not look like "no data".
 */
export function describeCommission(terms: CommissionTerms): string {
  if (!isUsableRate(terms.rate)) return "—";
  return terms.type === "percent_of_sale"
    ? `${terms.rate}% of sales`
    : `$${terms.rate} per ticket`;
}
