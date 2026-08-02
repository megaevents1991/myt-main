"use server";

import { requirePartner } from "@/lib/partner-auth";
import { supabase } from "@/lib/supabase";
import {
  commissionForReservations,
  countTickets,
  describeCommission,
  isPaid,
  round2,
  sumSales,
  type CommissionTerms,
  type CommissionType,
} from "@/lib/partner-commission";
import {
  FUNNEL_STAGES,
  FUNNEL_STAGE_LABELS_HE,
  emptyTraffic,
  type PartnerTraffic,
} from "@/lib/partner-funnel";

/**
 * Everything the /agent dashboard shows, in one round trip. Ported from
 * myt-backoffice's lib/actions/portal-dashboard-actions.ts (`getPortalDashboard`)
 * — same shared `partners` / `reservations` / `coupons` tables, and the
 * `partner_funnel_counts` / `partner_clicked_events` RPCs the backoffice's own
 * migrations already created in the shared DB, so calling them from this
 * app's `supabase` client needs no extra setup.
 *
 * Commission is split into pending and billed, both read from the same
 * `billed_at` flag the backoffice's monthly report cron stamps — a
 * calendar-month figure computed on a different basis than the invoice would
 * disagree with it whenever a reservation was paid after the report went out,
 * which is exactly the kind of mismatch that turns into an argument about
 * money. Site-credit is deliberately not part of this (that's a separate page).
 */

export interface AgentDashboardCommission {
  /** Ready-to-display rate, e.g. "8% of sales". */
  label: string;
  /** Earned since 1 January, all paid reservations. */
  yearToDateUsd: number;
  /**
   * Owed but not yet in a monthly report — reservations that are paid and
   * carry no `billed_at`. This is the same fact the report bills on, so the
   * portal and the invoice cannot drift apart.
   */
  pendingUsd: number;
  /** Already included in a monthly report. */
  billedUsd: number;
}

export interface AgentDashboardClickedEvent {
  name: string;
  date: string | null;
  location: string | null;
  visitors: number;
  clicks: number;
  /** True when someone who clicked this event went on to book it. */
  booked: boolean;
}

export interface AgentDashboard {
  totalReservations: number;
  paidReservations: number;
  paidTickets: number;
  totalSalesUsd: number;
  commission: AgentDashboardCommission;
  activeCoupons: number;
  couponUses: number;
  traffic: PartnerTraffic;
  clickedEvents: AgentDashboardClickedEvent[];
}

/**
 * A reservation's `event_order_info` is either one event, or `{events: [...]}`
 * for a combined booking — the same shape `lib/partner-commission.ts`
 * normalizes internally. That copy is file-scoped there and only keeps
 * `number_of_ticket` (all commission math needs); this dashboard also needs
 * each event's `name` (to say "clicked, never booked"), so rather than widen
 * partner-commission.ts's internal type for one caller outside it, this is its
 * own copy, typed for what this file actually reads. `number_of_ticket` is
 * kept here too so this type stays structurally compatible with the
 * `ReservationLike` shape those commission helpers expect.
 */
type DashboardEventOrderInfoItem = {
  name?: string | null;
  number_of_ticket?: number | null;
};
type DashboardEventOrderInfo =
  | DashboardEventOrderInfoItem
  | { events: DashboardEventOrderInfoItem[] }
  | null
  | undefined;

function normalizeEventOrderInfo(
  eventOrderInfo: DashboardEventOrderInfo,
): DashboardEventOrderInfoItem[] {
  if (!eventOrderInfo) return [];
  if (
    typeof eventOrderInfo === "object" &&
    "events" in eventOrderInfo &&
    Array.isArray((eventOrderInfo as { events?: unknown }).events)
  ) {
    return (eventOrderInfo as { events: DashboardEventOrderInfoItem[] }).events;
  }
  return [eventOrderInfo as DashboardEventOrderInfoItem];
}

type ReservationRow = {
  created_at: string;
  status: string | null;
  user_shown_price: number | null;
  event_order_info: DashboardEventOrderInfo;
  billed_at: string | null;
};

export async function getAgentDashboard(): Promise<AgentDashboard> {
  const session = await requirePartner();
  const code = session.partner_code;

  const [partnerResult, reservationsResult, couponsResult, funnelResult, clicksResult] =
    await Promise.all([
      supabase
        .from("partners")
        .select("commission,commission_type")
        .eq("partner_tracking_code", code)
        .maybeSingle(),
      supabase
        .from("reservations")
        .select("created_at,status,user_shown_price,event_order_info,billed_at")
        .eq("aff_partner_tracking_code", code),
      supabase
        .from("coupons")
        .select("is_active,times_used")
        .eq("partner_tracking_code", code),
      supabase.rpc("partner_funnel_counts", { p_tracking_code: code }),
      supabase.rpc("partner_clicked_events", { p_tracking_code: code, p_limit: 8 }),
    ]);

  if (partnerResult.error) throw partnerResult.error;
  if (reservationsResult.error) throw reservationsResult.error;
  // The rest are decoration — never fail the whole dashboard over them.
  if (couponsResult.error) {
    console.error("getAgentDashboard coupons:", JSON.stringify(couponsResult.error));
  }
  if (funnelResult.error) {
    console.error("getAgentDashboard funnel:", JSON.stringify(funnelResult.error));
  }
  if (clicksResult.error) {
    console.error("getAgentDashboard clicks:", JSON.stringify(clicksResult.error));
  }

  const partner = partnerResult.data as {
    commission: number;
    commission_type: CommissionType | null;
  } | null;

  // Unlike the backoffice (whose own historical default is fixed_per_ticket),
  // THIS app has only ever read `partners.commission` as a plain PERCENTAGE
  // everywhere else it touches the column (app/api/confirm-order/utils.ts's
  // agent_card discount, app/order/OrderSummary/PriceSummary.tsx's "עמלה
  // צפויה" line, and lib/quote-actions.ts's own port of this exact fallback)
  // — so percent_of_sale is the default that matches what this number has
  // always meant here, not the backoffice's fixed_per_ticket convention.
  const terms: CommissionTerms = {
    type: partner?.commission_type ?? "percent_of_sale",
    rate: partner?.commission ?? 0,
  };

  const rows = (reservationsResult.data ?? []) as unknown as ReservationRow[];
  const paid = rows.filter(isPaid);

  const yearPrefix = String(new Date().getUTCFullYear());

  const coupons = (couponsResult.data ?? []) as unknown as {
    is_active: boolean;
    times_used: number | null;
  }[];

  // Which of the clicked events actually converted, so the dashboard can say
  // "clicked, never booked" — that is the list worth acting on.
  // Every event on the reservation, not just the first — a two-event booking
  // would otherwise mark its second event "never booked", inverting the exact
  // signal this list exists to give.
  const bookedNames = new Set(
    paid
      .flatMap((r) => normalizeEventOrderInfo(r.event_order_info))
      .map((event) => event?.name)
      .filter((name): name is string => !!name)
      .map((name) => name.trim().toLowerCase()),
  );

  const clickedEvents: AgentDashboardClickedEvent[] = (
    (clicksResult.data ?? []) as unknown as {
      event_name: string | null;
      event_date: string | null;
      event_location: string | null;
      visitors: number | null;
      clicks: number | null;
    }[]
  )
    .filter((row) => !!row.event_name)
    .map((row) => ({
      name: row.event_name as string,
      date: row.event_date,
      location: row.event_location,
      visitors: Number(row.visitors ?? 0),
      clicks: Number(row.clicks ?? 0),
      booked: bookedNames.has((row.event_name as string).trim().toLowerCase()),
    }));

  const stageCounts = new Map<string, number>();
  for (const row of (funnelResult.data ?? []) as { stage: string; visitors: number }[]) {
    stageCounts.set(row.stage, Number(row.visitors) || 0);
  }
  const traffic: PartnerTraffic = funnelResult.error
    ? emptyTraffic()
    : {
        byStage: FUNNEL_STAGES.map((stage) => ({
          stage,
          label: FUNNEL_STAGE_LABELS_HE[stage],
          visitors: stageCounts.get(stage) ?? 0,
        })),
        totalVisitors: stageCounts.get("VISIT") ?? 0,
        hasData: stageCounts.size > 0,
      };

  return {
    totalReservations: rows.length,
    paidReservations: paid.length,
    paidTickets: countTickets(paid),
    totalSalesUsd: sumSales(paid),
    commission: {
      label: describeCommission(terms),
      yearToDateUsd: round2(
        commissionForReservations(
          paid.filter((r) => r.created_at?.startsWith(yearPrefix)),
          terms,
        ),
      ),
      pendingUsd: round2(
        commissionForReservations(
          paid.filter((r) => !r.billed_at),
          terms,
        ),
      ),
      billedUsd: round2(
        commissionForReservations(
          paid.filter((r) => !!r.billed_at),
          terms,
        ),
      ),
    },
    activeCoupons: coupons.filter((c) => c.is_active).length,
    couponUses: coupons.reduce((sum, c) => sum + (c.times_used ?? 0), 0),
    traffic,
    clickedEvents,
  };
}
