import { supabase } from "@/lib/supabase";
import type { Coupon } from "@/lib/app.types";
import { isCouponUsable, normalizeCouponCode } from "@/lib/coupon.utils";

/**
 * Server-only: fetch a coupon by code and check it's redeemable for the
 * event. Returns the row when usable, null otherwise (unknown code, inactive,
 * expired, exhausted, or wrong event — callers must not distinguish, so the
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
  // so escape it here — otherwise it's an ILIKE single-char wildcard and
  // "SUMMER_1" would also match "SUMMER21" (coupon guessing/bypass).
  const escaped = normalized.replace(/([\\%_])/g, "\\$1");
  const { data, error } = await supabase
    .from("coupons")
    .select(
      "id, code, discount_type, discount_value, event_id, valid_until, max_uses, times_used, is_active, created_at",
    )
    .ilike("code", escaped)
    .maybeSingle();

  if (error) {
    console.error("Coupon lookup failed:", JSON.stringify(error));
    return null;
  }
  if (!data) return null;

  const coupon = data as Coupon;
  return isCouponUsable(coupon, eventId) ? coupon : null;
};

/**
 * Count a redemption. Read-then-write (not atomic) — max_uses is a soft
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
