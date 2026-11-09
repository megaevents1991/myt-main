import { supabase } from "@/lib/supabase";
import type { Coupon } from "@/lib/app.types";
import { isCouponUsable, normalizeCouponCode } from "@/lib/coupon.utils";

/**
 * Server-only: fetch a coupon by code and check it's redeemable for the
 * event. Returns the row when usable, null otherwise (unknown code, inactive,
 * expired, exhausted, or wrong event - callers must not distinguish, so the
 * client can't enumerate codes).
 */
export const findValidCoupon = async (
  code: string,
  eventId: number | null | undefined,
): Promise<Coupon | null> => {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return null;

  // ILIKE = case-insensitive equality for legacy mixed-case rows. The format
  // guard in normalizeCouponCode blocks % entirely; `_` is a legal code char,
  // so escape it here - otherwise it's an ILIKE single-char wildcard and
  // "SUMMER_1" would also match "SUMMER21" (coupon guessing/bypass).
  const escaped = normalized.replace(/([\\%_])/g, "\\$1");
  // source (members club), times_paid / partner_tracking_code / per_person may
  // not exist until their migrations run; on 42703 / PGRST204 (undefined
  // column) retry with fewer columns so coupons keep working either way (same
  // pattern as affiliate checkCode).
  const COLUMN_SETS = [
    "id, code, discount_type, discount_value, event_id, valid_until, max_uses, times_used, times_paid, partner_tracking_code, per_person, source, is_active, created_at",
    "id, code, discount_type, discount_value, event_id, valid_until, max_uses, times_used, times_paid, partner_tracking_code, per_person, is_active, created_at",
    "id, code, discount_type, discount_value, event_id, valid_until, max_uses, times_used, is_active, created_at",
  ];
  let data: unknown = null;
  let error: { code?: string; message: string } | null = null;
  for (const columns of COLUMN_SETS) {
    ({ data, error } = await supabase
      .from("coupons")
      .select(columns)
      .ilike("code", escaped)
      .maybeSingle());
    if (!error || (error.code !== "42703" && error.code !== "PGRST204")) break;
  }

  if (error) {
    console.error("Coupon lookup failed:", JSON.stringify(error));
    return null;
  }
  if (!data) return null;

  const coupon = data as Coupon;
  return isCouponUsable(coupon, eventId) ? coupon : null;
};

/**
 * Count a redemption. Read-then-write (not atomic) - max_uses is a soft
 * marketing limit, a rare race overshooting by one is acceptable.
 */
export const incrementCouponUse = async (coupon: Coupon): Promise<void> => {
  const { error } = await supabase
    .from("coupons")
    .update({ times_used: coupon.times_used + 1 })
    .eq("id", coupon.id);
  if (error)
    console.error("Coupon times_used update failed:", JSON.stringify(error));
};
