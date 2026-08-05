import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { liveVoucherBalanceUsd } from "@/lib/partner-vouchers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const affiliateId = searchParams.get('affiliateId');

  if (!affiliateId) {
    return NextResponse.json({ });
  }
  
  try {
    // Explicit allowlist — never select * here (the table holds credentials).
    // `is_active`/`voucher_payment_allowed` may not exist until their migration
    // runs; on 42703 (undefined column) retry without them so affiliate links
    // keep working either way.
    let { data, error } = await supabase
      .from('partners')
      .select(
        "partner_tracking_code, user_discount, commission, type, is_active, voucher_payment_allowed",
      )
      .eq('partner_tracking_code', affiliateId)
      .single();
    if (error && error.code === "42703") {
      ({ data, error } = await supabase
        .from('partners')
        .select("partner_tracking_code, user_discount, commission, type")
        .eq('partner_tracking_code', affiliateId)
        .single());
    }
    if (error) throw error;

    // Disabled affiliate — behave like an unknown code (no discount/tracking).
    if ((data as { is_active?: boolean } | null)?.is_active === false)
      return NextResponse.json({ });

    // Agents get their tools regardless of commission (it may legitimately be
    // 0 — they then just charge full price); affiliates still need a discount
    // to matter.
    if (data && (data?.user_discount || data?.commission || data?.type === "agent")) {
      // Voucher payment requires BOTH the staff approval flag AND a live
      // voucher to actually pay with — an active, unspent coupon minted from
      // the agent's portal credit. resolveAgentSettlement re-checks both.
      const voucherApproved =
        (data as { voucher_payment_allowed?: boolean }).voucher_payment_allowed ===
        true;
      const voucherBalanceUsd =
        data.type === "agent" && voucherApproved
          ? await liveVoucherBalanceUsd(data.partner_tracking_code)
          : 0;
      return NextResponse.json({
        discount: data.user_discount || 0,
        commission: data.commission || 0,
        type: data.type,
        // Agent-only, and only meaningful once the order flow's own agent-mode
        // gate is on — see lib/partner-auth's requireAgent doc comment on why
        // this exists at all (booking on a customer's behalf, voucher payment).
        voucherPaymentAllowed: voucherApproved && voucherBalanceUsd > 0,
        voucherBalanceUsd,
      });
    } else
    return NextResponse.json({ });
  } catch (e) {
    console.log("Failed to login:", e);
    return NextResponse.json({ success: false });
  }
}