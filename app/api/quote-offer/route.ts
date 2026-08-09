import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyQuoteSig } from "@/lib/quote-link";
import { getPartnerSession } from "@/lib/partner-auth";

/**
 * Resolves a signed quote link (`?quote={id}&qsig={sig}` on an order URL)
 * into what the order flow renders and charges: the offer's line items and
 * the agent's total. The signature — HMAC over id+total with the shared
 * backoffice secret (lib/quote-link.ts) — is the entire access control:
 * without it a bare numeric id would leak another customer's offer
 * (name, prices) and let anyone claim an arbitrary total.
 *
 * An expired offer still returns its content with `expired: true` — the
 * client shows "ההצעה אינה בתוקף" and falls back to live site pricing
 * instead of silently charging a stale number.
 */

type QuoteRow = {
  id: number;
  title: string | null;
  customer_name: string | null;
  line_items: { label: string; qty: number; unit_price: number }[] | null;
  /** USD, rounded to 2 decimals (see backoffice createQuote). */
  total: number | null;
  valid_until: string | null;
  partner_tracking_code: string | null;
  /** System price per unit at quote creation — the uplift baseline. */
  base_unit_price: number | null;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("quote"));
  const sig = url.searchParams.get("qsig");
  if (!Number.isFinite(id) || id <= 0 || !sig) {
    return NextResponse.json({ error: "Invalid quote link" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id, title, customer_name, line_items, total, valid_until, partner_tracking_code, base_unit_price"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("GET /api/quote-offer:", error.message);
    return NextResponse.json({ error: "Failed to load offer" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  const row = data as QuoteRow;

  const totalUsd = Number(row.total ?? 0);
  if (!(await verifyQuoteSig(row.id, totalUsd, sig))) {
    // Same response as "not found" — don't confirm which ids exist.
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  // valid_until is a DATE — the offer holds through the end of that day.
  let expired = false;
  if (row.valid_until) {
    const until = new Date(`${row.valid_until.slice(0, 10)}T23:59:59`);
    expired = Number.isFinite(until.getTime()) && Date.now() > until.getTime();
  }

  // Agent-only figure: what the agent priced ABOVE the recorded system price
  // (their margin, paid on top of the base commission). Included ONLY when the
  // request carries THAT agent's own session — the customer opening the same
  // link must never see the markup baked into their offer.
  let agentUpliftUsd: number | undefined;
  try {
    const session = await getPartnerSession();
    if (
      session &&
      session.partner_code === row.partner_tracking_code &&
      row.base_unit_price != null
    ) {
      const qty = (Array.isArray(row.line_items) ? row.line_items : []).reduce(
        (sum, item) => {
          const q = Number(item?.qty);
          return sum + (Number.isFinite(q) && q > 0 ? q : 0);
        },
        0,
      );
      if (qty > 0) {
        agentUpliftUsd = Math.max(
          0,
          totalUsd - Number(row.base_unit_price) * qty,
        );
      }
    }
  } catch {
    // No session — public payload stays uplift-free.
  }

  return NextResponse.json({
    id: row.id,
    title: row.title,
    customer_name: row.customer_name,
    line_items: Array.isArray(row.line_items) ? row.line_items : [],
    total_usd: totalUsd,
    valid_until: row.valid_until,
    partner_tracking_code: row.partner_tracking_code,
    expired,
    ...(agentUpliftUsd !== undefined ? { agent_uplift_usd: agentUpliftUsd } : {}),
  });
}
