import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { liveVoucherBalanceUsd } from "@/lib/partner-vouchers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const affiliateId = searchParams.get("affiliateId");

  if (!affiliateId) {
    return NextResponse.json({});
  }

  try {
    // Explicit allowlist - never select * here (the table holds credentials).
    // `is_active`/`voucher_payment_allowed` may not exist until their migration
    // runs; on 42703 (undefined column) retry without them so affiliate links
    // keep working either way.
    let { data, error } = await supabase
      .from("partners")
      .select(
        "partner_tracking_code, user_discount, commission, commission_type, type, is_active, voucher_payment_allowed",
      )
      .eq("partner_tracking_code", affiliateId)
      .single();
    if (error && error.code === "42703") {
      ({ data, error } = await supabase
        .from("partners")
        .select("partner_tracking_code, user_discount, commission, type")
        .eq("partner_tracking_code", affiliateId)
        .single());
    }
    if (error) throw error;

    // Disabled affiliate - behave like an unknown code (no discount/tracking).
    if ((data as { is_active?: boolean } | null)?.is_active === false)
      return NextResponse.json({});

    // Agents get their tools regardless of commission (it may legitimately be
    // 0 - they then just charge full price); affiliates still need a discount
    // to matter.
    if (
      data &&
      (data?.user_discount || data?.commission || data?.type === "agent")
    ) {
      // Voucher settlement is the AGENCY-voucher flow: the agent books, the
      // order waits Pending, and the voucher document is collected offline.
      // Configured (voucher_payment_allowed) ⇒ the option shows - a live
      // credit-coupon balance is unrelated and no longer gates it (אלון היה
      // מוגדר לשובר והאופציה לא הופיעה - 2026-08-06). The balance is still
      // reported for display.
      const voucherApproved =
        (data as { voucher_payment_allowed?: boolean })
          .voucher_payment_allowed === true;
      const voucherBalanceUsd =
        data.type === "agent" && voucherApproved
          ? await liveVoucherBalanceUsd(data.partner_tracking_code)
          : 0;
      // The partner's logo lives on their PORTAL profile (user_profiles),
      // not the partners row - shown on the customer's landing page so an
      // agent-referred visitor sees who sent them.
      let partnerLogoUrl: string | null = null;
      let partnerDisplayName: string | null = null;
      try {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("logo_url, display_name")
          .eq("partner_tracking_code", data.partner_tracking_code)
          .in("role", ["agent", "affiliate"])
          .maybeSingle();
        partnerLogoUrl =
          (profile as { logo_url?: string | null } | null)?.logo_url ?? null;
        partnerDisplayName =
          (profile as { display_name?: string | null } | null)?.display_name ??
          null;
      } catch {
        /* decoration only - never fail the code check over it */
      }
      return NextResponse.json({
        partnerLogoUrl,
        partnerDisplayName,
        discount: data.user_discount || 0,
        commission: data.commission || 0,
        // Percent vs fixed-per-ticket - the agent screens must not assume
        // percent (a fixed $20/ticket agent showed "20%" commission math).
        commissionType:
          (data as { commission_type?: string }).commission_type ??
          "fixed_per_ticket",
        type: data.type,
        // Agent-only, and only meaningful once the order flow's own agent-mode
        // gate is on - see lib/partner-auth's requireAgent doc comment on why
        // this exists at all (booking on a customer's behalf, voucher payment).
        voucherPaymentAllowed: voucherApproved,
        voucherBalanceUsd,
      });
    } else return NextResponse.json({});
  } catch (e) {
    console.log("Failed to login:", e);
    return NextResponse.json({ success: false });
  }
}
