"use server";

import { requirePartner } from "@/lib/partner-auth";
import { supabase } from "@/lib/supabase";
import {
  commissionForReservation,
  countReservationTickets,
  round2,
  type CommissionTerms,
  type CommissionType,
} from "@/lib/partner-commission";

/**
 * Reservations list for the agent/influencer area — ported from the
 * backoffice partner portal (`getPortalReservations` in
 * lib/actions/portal-actions.ts there). Same shared `reservations` /
 * `partners` tables, so the column allowlist, the hold window and the
 * commission math below must keep agreeing with that source, not drift.
 */

type ReservationEventOrderInfoItem = {
  date?: string | Date | null;
  name?: string | null;
  location_name?: string | null;
  category?: string | null;
  number_of_ticket?: number | null;
};

type ReservationEventOrderInfo =
  | ReservationEventOrderInfoItem
  | { events: ReservationEventOrderInfoItem[] }
  | null
  | undefined;

/**
 * A reservation's event_order_info is either one event, or `{events: [...]}`
 * for a combined booking. lib/partner-commission.ts has the exact same
 * function (`normalizeEventOrderInfo`) but keeps it private to that module —
 * this is a deliberate small local copy, not a fork of shared logic, since
 * here it also needs to read display fields (name/date/location/category)
 * that module's own minimal item type doesn't carry.
 */
function normalizeReservationEventOrderInfo(
  eventOrderInfo: ReservationEventOrderInfo,
): ReservationEventOrderInfoItem[] {
  if (!eventOrderInfo) return [];
  if (
    typeof eventOrderInfo === "object" &&
    "events" in eventOrderInfo &&
    Array.isArray((eventOrderInfo as { events?: unknown }).events)
  ) {
    return (eventOrderInfo as { events: ReservationEventOrderInfoItem[] }).events;
  }
  return [eventOrderInfo as ReservationEventOrderInfoItem];
}

export interface PortalReservation {
  id: number;
  created_at: string;
  customer_name: string;
  status: string;
  user_shown_price: number;
  event_id: number;
  event_title: string | null;
  event_date: string | null;
  event_location: string | null;
  ticket_category: string | null;
  /** Tickets across every event on the booking. */
  tickets: number;
  /** Travellers on the booking, including the person who booked it. */
  pax: number;
  /** Ours to quote back at us — staff-entered, may be empty. */
  booking_reference: string | null;
  /** Whether the customer's confirmation went out. */
  materials_sent: boolean;
  /** What this booking earns the partner. Zero until it is paid. */
  commission_usd: number;
  /** True once it has gone out in a monthly report. */
  billed: boolean;
  /** A price hold the customer saved but never paid for. */
  is_hold: boolean;
  /** When the hold stops working. Null unless `is_hold`. */
  hold_expires_at: string | null;
}

export interface PortalReservationsPage {
  rows: PortalReservation[];
  /** True when older bookings exist beyond the page returned. */
  truncated: boolean;
}

const RESERVATIONS_PAGE_SIZE = 500;

/** The status this app writes for a price hold (see app/api/confirm-order/route.ts). */
const HOLD_STATUS = "24Save";

/**
 * When a hold stops being resumable.
 *
 * This app's own recovery endpoint (app/api/find-order/route.ts) allows 25
 * hours, not the 24 advertised to the customer. The partner is shown the real
 * cut-off — telling them 24 would have them chase a customer whose link still
 * works, or write off one that isn't actually recoverable for another hour.
 */
const HOLD_WINDOW_MS = 25 * 60 * 60 * 1000;

function holdExpiry(createdAt: string): string | null {
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) ? new Date(created + HOLD_WINDOW_MS).toISOString() : null;
}

/**
 * Columns a partner may see on their own bookings.
 *
 * Listed explicitly, never "everything except" — a column added to
 * `reservations` later must not start leaking on its own. Deliberately
 * absent: `main_contact_phone_number` and `main_contact_email` (the customer
 * belongs to the business, not the partner), `payment_info`,
 * `offline_flight_cost` / `offline_hotel_cost` / `final_purchase_price_ils`
 * (our cost — showing them hands the partner our margin on every booking),
 * `accounting_number`, and `comments`, which is staff's internal note field.
 */
const PORTAL_RESERVATION_COLUMNS =
  "id,created_at,main_contact_first_name,main_contact_last_name,status,user_shown_price,event_id,event_order_info,more_pax_info,booking_reference,confirmation_email_sent,billed_at";

type Row = {
  id: number;
  created_at: string;
  main_contact_first_name: string | null;
  main_contact_last_name: string | null;
  status: string;
  user_shown_price: number | null;
  event_id: number;
  event_order_info: ReservationEventOrderInfo;
  more_pax_info: unknown;
  booking_reference: string | null;
  confirmation_email_sent: boolean | null;
  billed_at: string | null;
};

export async function getPortalReservations(): Promise<PortalReservationsPage> {
  const session = await requirePartner();

  const [reservationsResult, partnerResultInitial] = await Promise.all([
    supabase
      .from("reservations")
      .select(PORTAL_RESERVATION_COLUMNS)
      .eq("aff_partner_tracking_code", session.partner_code)
      .order("created_at", { ascending: false })
      // One more than the page, purely to detect that older rows exist.
      .limit(RESERVATIONS_PAGE_SIZE + 1),
    supabase
      .from("partners")
      .select("commission,commission_type")
      .eq("partner_tracking_code", session.partner_code)
      .maybeSingle(),
  ]);

  if (reservationsResult.error) {
    console.error("getPortalReservations:", JSON.stringify(reservationsResult.error));
    return { rows: [], truncated: false };
  }

  let partnerResult = partnerResultInitial;
  if (partnerResult.error?.code === "42703") {
    // The commission_type column and this app's deploy can land out of order
    // (same race lib/quote-actions.ts already guards against) — a reporting
    // column must not stop a partner seeing their own bookings.
    partnerResult = await supabase
      .from("partners")
      .select("commission")
      .eq("partner_tracking_code", session.partner_code)
      .maybeSingle();
  }
  if (partnerResult.error) {
    // Never let a lookup failure quietly render every booking as $0 commission.
    console.error("getPortalReservations partner:", JSON.stringify(partnerResult.error));
  }

  const terms: CommissionTerms = {
    // Unlike the backoffice (whose own historical default is
    // fixed_per_ticket), this app has only ever read `partners.commission` as
    // a plain PERCENTAGE everywhere else it touches it (confirm-order/utils.ts's
    // agent_card discount, PriceSummary.tsx's "עמלה צפויה" line, lib/quote-actions.ts's
    // commissionTermsFor) — so percent_of_sale is the fallback that matches
    // what this number has always meant here, not the backoffice's convention.
    type:
      ((partnerResult.data as { commission_type?: CommissionType | null } | null)
        ?.commission_type as CommissionType | null) ?? "percent_of_sale",
    rate: (partnerResult.data as { commission?: number | null } | null)?.commission ?? null,
  };

  const all = (reservationsResult.data as Row[] | null) ?? [];
  const truncated = all.length > RESERVATIONS_PAGE_SIZE;
  const rows = all.slice(0, RESERVATIONS_PAGE_SIZE).map((r) => {
    // The order-info JSON holds one item or { events: [...] }; the title field
    // is `name`. Ticket counts and category are already in here.
    const events = normalizeReservationEventOrderInfo(r.event_order_info);
    const first = events[0];
    return {
      id: r.id,
      created_at: r.created_at,
      customer_name: [r.main_contact_first_name, r.main_contact_last_name]
        .filter(Boolean)
        .join(" "),
      status: r.status,
      user_shown_price: r.user_shown_price ?? 0,
      event_id: r.event_id,
      event_title: first?.name ?? null,
      // `date` is typed string | Date on the order-info item.
      event_date: first?.date == null ? null : String(first.date),
      event_location: first?.location_name ?? null,
      ticket_category: first?.category ?? null,
      tickets: countReservationTickets(r),
      // `more_pax_info` is the ADDITIONAL passengers — the main contact is not
      // in it (this app writes `passengers.slice(1)`), so the +1 is the
      // booker. Every other pax count in this repo does the same.
      pax: 1 + (Array.isArray(r.more_pax_info) ? r.more_pax_info.length : 0),
      booking_reference: r.booking_reference,
      materials_sent: r.confirmation_email_sent === true,
      commission_usd: round2(commissionForReservation(r, terms)),
      billed: !!r.billed_at,
      is_hold: r.status === HOLD_STATUS,
      hold_expires_at: r.status === HOLD_STATUS ? holdExpiry(r.created_at) : null,
      // Deliberately NOT the customer's order-recovery link. Opening it loads
      // the saved cart through this app's find-order endpoint, which returns
      // the customer's phone, email and every passenger name — exactly what
      // PORTAL_RESERVATION_COLUMNS above refuses to select. The partner
      // already has the customer's name and the event, which is what they
      // need to make the call.
    };
  });

  return { rows, truncated };
}
