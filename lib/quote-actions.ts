"use server";

import {
  requireAgent,
  requirePartner,
  type PartnerSession,
} from "@/lib/partner-auth";
import { supabase } from "@/lib/supabase";
import { getEvents, getCachedEvents } from "@/lib/eventsData";
import { computePackagePrice } from "@/lib/events/price";
import {
  round2,
  type CommissionTerms,
  type CommissionType,
} from "@/lib/partner-commission";

/**
 * Quotes for the agent/influencer area - ported from the backoffice partner
 * portal (lib/actions/quote-actions.ts there) so an agent builds a quote
 * against the site's own live event data instead of a backoffice mirror.
 * Same shared `quotes` table; same discount-cap rule, reproduced exactly.
 *
 * No PDF file is generated here (backoffice's route shells out to a headless
 * Chromium via playwright-core + @sparticuz/chromium - neither is a
 * dependency of this app, and this environment has no way to add one and
 * verify it installs). /agent/quotes/[id] is instead a print-ready page -
 * Ctrl+P → Save as PDF gets the agent the same document.
 */

export interface QuoteLineItem {
  label: string;
  qty: number;
  unit_price: number;
}

export interface QuoteEventOption {
  id: number;
  name: string;
  date: string | null;
  location: string | null;
  suggested_price: number | null;
}

export interface AgentQuote {
  id: number;
  created_at: string;
  customer_name: string | null;
  title: string | null;
  line_items: QuoteLineItem[];
  total: number | null;
  notes: string | null;
  valid_until: string | null;
  status: string;
  event_id: number | null;
}

/**
 * Partner's commission terms, read fresh - never trusted from the client.
 *
 * `commission_type` may not exist yet depending on migration/deploy order
 * with the backoffice, which owns the schema - and even once it exists, a
 * legacy row may still have it null. Unlike the backoffice (whose own
 * historical default is fixed_per_ticket), THIS app has only ever read
 * `partners.commission` as a plain PERCENTAGE everywhere else it touches it
 * (confirm-order/utils.ts's agent_card discount, PriceSummary.tsx's "עמלה
 * צפויה" line, the $40 auto-created-partner default meaning 40%) - so
 * percent_of_sale is the fallback that matches what this number has always
 * meant here, not the backoffice's own convention.
 */
async function commissionTermsFor(
  trackingCode: string,
): Promise<CommissionTerms | null> {
  let { data, error } = await supabase
    .from("partners")
    .select("commission, commission_type")
    .eq("partner_tracking_code", trackingCode)
    .maybeSingle();
  if (error?.code === "42703") {
    ({ data, error } = await supabase
      .from("partners")
      .select("commission")
      .eq("partner_tracking_code", trackingCode)
      .maybeSingle());
  }
  if (error) {
    console.error("commissionTermsFor:", JSON.stringify(error));
    return null;
  }
  if (!data) return null;
  return {
    type:
      ((data as { commission_type?: CommissionType | null })
        .commission_type as CommissionType) ?? "percent_of_sale",
    rate: Number(data.commission) || 0,
  };
}

/** The signed-in agent's commission terms, for the quote form's live discount cap. */
export async function getMyAgentTerms(): Promise<CommissionTerms | null> {
  const session = await requireAgent();
  return commissionTermsFor(session.partner_code);
}

/**
 * What the system would price ONE package at for this event, right now, and
 * the event's own name (for the quote's package line label).
 *
 * Per traveller, matching computePackagePrice - recomputed server-side from
 * the live event row rather than trusted from the form, since the whole
 * point of storing it is to measure what the agent did to the price.
 */
async function suggestedPackageFor(
  eventId: number | null,
): Promise<{ name: string; unitPrice: number | null } | null> {
  if (eventId == null) return null;
  const { events } = await getEvents(eventId);
  const event = events?.[0];
  if (!event) return null;
  return { name: event.name, unitPrice: computePackagePrice(event) };
}

export async function getQuoteEvents(): Promise<QuoteEventOption[]> {
  // Both roles - this is a plain event listing with no pricing decision
  // baked in (unlike createQuote, which is agent-only). /agent/links reuses
  // this for its per-event tracking link, and an influencer needs that too.
  await requirePartner();
  // The same ISR-cached reader /agent's own search page uses - never a raw
  // query for a plain listing.
  const { events } = await getCachedEvents();
  return (events || []).slice(0, 300).map((event) => ({
    id: event.id,
    name: event.name,
    date: event.date ?? null,
    location: event.location?.name ?? null,
    suggested_price: computePackagePrice(event),
  }));
}

export async function getMyQuotes(): Promise<AgentQuote[]> {
  const session = await requireAgent();
  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id,created_at,customer_name,title,line_items,total,notes,valid_until,status,event_id",
    )
    .eq("partner_tracking_code", session.partner_code)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getMyQuotes:", JSON.stringify(error));
    return [];
  }
  return (data as AgentQuote[]) ?? [];
}

export async function getMyQuote(id: number): Promise<AgentQuote | null> {
  const session = await requireAgent();
  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id,created_at,customer_name,title,line_items,total,notes,valid_until,status,event_id,partner_tracking_code",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getMyQuote:", JSON.stringify(error));
    return null;
  }
  // 404-as-null for both "doesn't exist" and "not yours" - don't confirm a
  // foreign quote id exists.
  if (!data || data.partner_tracking_code !== session.partner_code) return null;
  return data as AgentQuote;
}

export async function createQuote(input: {
  event_id?: number | null;
  customer_name: string;
  title: string;
  /**
   * The event package line, when the quote is built from a catalogued event.
   * The stored line item for the package is ALWAYS derived server-side from
   * this value (qty/unit_price) plus the event's own name - never from
   * `extra_line_items` - so the discount-cap check below, which runs against
   * this exact number, can never diverge from what actually gets billed.
   * Quoting the package as a lump-sum "extra" line instead would make the
   * cap unenforceable (the discount would hide behind a quantity of 1).
   */
  package?: { qty: number; unit_price: number } | null;
  /** Anything beyond the package itself - insurance, upgrades, add-ons.
   * NOT subject to the discount cap, and must never describe the package. */
  extra_line_items?: QuoteLineItem[];
  notes?: string | null;
  valid_until?: string | null;
}): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  let session: PartnerSession;
  try {
    session = await requireAgent();
  } catch {
    // Influencers never reach this - no nav link, no session role match -
    // but the action itself must refuse regardless of how it's called.
    return { ok: false, error: "הצעות מחיר זמינות לסוכנים מחוברים בלבד" };
  }

  const terms = await commissionTermsFor(session.partner_code);
  if (!terms) {
    return { ok: false, error: "לא הצלחנו לקרוא את תנאי העמלה שלכם. נסו שוב." };
  }

  const customer_name = input.customer_name?.trim();
  const title = input.title?.trim();
  if (!customer_name) return { ok: false, error: "שם הלקוח הוא שדה חובה" };
  if (!title) return { ok: false, error: "כותרת היא שדה חובה" };

  const extraItems = Array.isArray(input.extra_line_items)
    ? input.extra_line_items
    : [];
  for (const item of extraItems) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "פריט לא תקין" };
    }
    if (typeof item.label !== "string" || !item.label.trim()) {
      return { ok: false, error: "לכל פריט נדרש תיאור" };
    }
    if (
      !Number.isFinite(item.qty) ||
      !Number.isInteger(item.qty) ||
      item.qty <= 0 ||
      item.qty > 999
    ) {
      return { ok: false, error: `כמות לא תקינה עבור "${item.label}"` };
    }
    if (!Number.isFinite(item.unit_price) || item.unit_price < 0) {
      return { ok: false, error: `מחיר לא תקין עבור "${item.label}"` };
    }
    if (item.unit_price > 1_000_000) {
      return { ok: false, error: "סכום גבוה מדי" };
    }
  }

  const lineItems: QuoteLineItem[] = [];
  // What the system itself would have charged per traveller - for reporting,
  // so staff can compare it against what the agent actually quoted
  // (line_items[0].unit_price). Never what was actually charged.
  let base_unit_price: number | null = null;

  // An event-backed quote must carry its package row and a live baseline, or
  // the discount rule has nothing to measure against. Failing open here
  // would make the cap opt-out: pick an event, omit the package, quote
  // anything as a plain "extra" line instead.
  if (input.event_id != null) {
    const suggested = await suggestedPackageFor(input.event_id);
    if (suggested?.unitPrice == null) {
      return {
        ok: false,
        error: "לא הצלחנו לחשב את מחיר החבילה לאירוע הזה. נסו שוב.",
      };
    }
    const pkg = input.package;
    if (!pkg || !Number.isFinite(pkg.unit_price) || pkg.unit_price < 0) {
      return { ok: false, error: "חסר מחיר החבילה בהצעה" };
    }
    if (
      !Number.isFinite(pkg.qty) ||
      !Number.isInteger(pkg.qty) ||
      pkg.qty <= 0 ||
      pkg.qty > 999
    ) {
      return { ok: false, error: "כמות נוסעים לא תקינה" };
    }

    // An agent may give away their own commission, never more - below that
    // they would owe us the difference on a sale we cannot collect it from.
    // Measured PER TRAVELLER on the package alone: comparing whole-quote
    // totals lets a discount hide behind a lump-sum line item that
    // understates the real quantity.
    const quoted = round2(pkg.unit_price);
    const discountPerTraveller = round2(suggested.unitPrice - quoted);
    if (discountPerTraveller > 0) {
      // Percent commission is paid on what the CUSTOMER pays, so the ceiling
      // is derived from the discounted price, not the list price.
      const commissionPerTraveller = round2(
        terms.type === "percent_of_sale"
          ? (quoted * (terms.rate ?? 0)) / 100
          : (terms.rate ?? 0),
      );
      if (discountPerTraveller > commissionPerTraveller + 0.001) {
        return {
          ok: false,
          error: `ההנחה המקסימלית שלכם היא $${commissionPerTraveller} לנוסע. הורדתם $${discountPerTraveller}.`,
        };
      }
    }

    // The package's OWN line item, built from the same validated qty/price
    // the cap check just ran against - never from client-supplied line items.
    lineItems.push({ label: suggested.name, qty: pkg.qty, unit_price: quoted });
    base_unit_price = round2(suggested.unitPrice);
  }

  lineItems.push(...extraItems);
  if (lineItems.length === 0) {
    return { ok: false, error: "יש להוסיף לפחות פריט אחד" };
  }

  const total = round2(lineItems.reduce((s, i) => s + i.qty * i.unit_price, 0));
  if (total > 10_000_000) {
    return { ok: false, error: "סכום גבוה מדי" };
  }

  const row = {
    created_by: session.sub,
    partner_tracking_code: session.partner_code,
    event_id: input.event_id ?? null,
    customer_name,
    title,
    line_items: lineItems,
    currency: "USD",
    total,
    notes: input.notes ?? null,
    valid_until: input.valid_until ?? null,
    status: "final",
  };

  let { data, error } = await supabase
    .from("quotes")
    .insert({ ...row, base_unit_price })
    .select("id")
    .single();

  // The migration adding base_unit_price and this app's deploy ship
  // separately - a reporting field must not stop an agent creating quotes in
  // the window between them.
  if (error?.code === "PGRST204") {
    ({ data, error } = await supabase
      .from("quotes")
      .insert(row)
      .select("id")
      .single());
  }

  if (error || !data) {
    console.error("createQuote:", JSON.stringify(error));
    return { ok: false, error: "יצירת ההצעה נכשלה" };
  }

  return { ok: true, id: data.id };
}
