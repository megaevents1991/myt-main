import { supabase } from "@/lib/supabase";

/**
 * The agent's LIVE voucher value: coupons minted from portal credit
 * redemptions (backoffice `convertCreditToCoupon` - every redemption is a row
 * in `partner_credit_redemptions` pointing at its coupon) that are still
 * active and not fully used.
 *
 * This is what "תשלום בשובר" is backed by: the option only shows (checkCode)
 * and only settles (resolveAgentSettlement) while such a voucher exists.
 * A partner's ordinary marketing coupons also carry their tracking code, so
 * membership in the redemptions ledger - not the coupons table alone - is
 * what makes a coupon a voucher.
 */
/**
 * Spend the agent's OLDEST live voucher on a voucher-settled order.
 *
 * Marks the coupon used (optimistic `times_used` bump - a concurrent order
 * falls through to the next voucher) and returns its code+value so the caller
 * records them on the reservation exactly like an applied coupon. That record
 * is what makes the backoffice credit ledger settle honestly: a voucher order
 * that reaches Paid counts as spent value; one that is abandoned leaves the
 * coupon dead-but-unpaid, and the ledger returns its value to the balance -
 * the exact model regular credit coupons already follow.
 *
 * Without this, one live voucher would pass the "has a live voucher" gate for
 * unlimited orders.
 */
export async function consumeOldestLiveVoucher(
  trackingCode: string,
): Promise<{ code: string; valueUsd: number } | null> {
  try {
    const { data: redemptions, error } = await supabase
      .from("partner_credit_redemptions")
      .select("coupon_code, created_at")
      .eq("partner_tracking_code", trackingCode)
      .order("created_at", { ascending: true });
    if (error || !redemptions?.length) {
      if (error)
        console.error("consumeOldestLiveVoucher redemptions:", error.message);
      return null;
    }

    for (const redemption of redemptions) {
      const code = (redemption.coupon_code ?? "").trim();
      if (!code) continue;
      const { data: couponRow } = await supabase
        .from("coupons")
        .select("discount_value, times_used, max_uses, is_active")
        .eq("code", code)
        .maybeSingle();
      if (!couponRow || couponRow.is_active !== true) continue;
      const used = Number(couponRow.times_used ?? 0);
      const max =
        couponRow.max_uses == null ? Infinity : Number(couponRow.max_uses);
      if (used >= max) continue;

      // Conditional bump - if another order spent it first, times_used no
      // longer matches and zero rows update; move on to the next voucher.
      const { data: updated, error: updateError } = await supabase
        .from("coupons")
        .update({ times_used: used + 1 })
        .eq("code", code)
        .eq("times_used", couponRow.times_used ?? 0)
        .select("code");
      if (updateError) {
        console.error("consumeOldestLiveVoucher bump:", updateError.message);
        continue;
      }
      if (updated && updated.length > 0) {
        return { code, valueUsd: Number(couponRow.discount_value) || 0 };
      }
    }
    return null;
  } catch (e) {
    console.error("consumeOldestLiveVoucher:", e);
    return null;
  }
}

export async function liveVoucherBalanceUsd(
  trackingCode: string,
): Promise<number> {
  try {
    const { data: redemptions, error: redemptionsError } = await supabase
      .from("partner_credit_redemptions")
      .select("coupon_code")
      .eq("partner_tracking_code", trackingCode);
    if (redemptionsError || !redemptions?.length) {
      if (redemptionsError) {
        // Table may predate the credit feature on some environments - treat as
        // "no vouchers", never break checkout over it.
        console.error(
          "liveVoucherBalanceUsd redemptions:",
          redemptionsError.message,
        );
      }
      return 0;
    }

    const codes = [
      ...new Set(
        redemptions
          .map((r) => (r.coupon_code ?? "").trim())
          .filter((code) => code.length > 0),
      ),
    ];
    if (codes.length === 0) return 0;

    const { data: coupons, error: couponsError } = await supabase
      .from("coupons")
      .select("discount_value, times_used, max_uses, is_active")
      .in("code", codes)
      .eq("is_active", true);
    if (couponsError || !coupons) {
      if (couponsError)
        console.error("liveVoucherBalanceUsd coupons:", couponsError.message);
      return 0;
    }

    return coupons
      .filter((c) => {
        const used = Number(c.times_used ?? 0);
        const max = c.max_uses == null ? Infinity : Number(c.max_uses);
        return used < max;
      })
      .reduce((sum, c) => sum + (Number(c.discount_value) || 0), 0);
  } catch (e) {
    console.error("liveVoucherBalanceUsd:", e);
    return 0;
  }
}
