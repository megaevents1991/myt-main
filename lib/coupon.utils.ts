import type { Coupon } from "@/lib/app.types";

/** Shape the client works with after /api/coupons/validate. */
export type AppliedCoupon = {
  code: string;
  discountType: Coupon["discount_type"];
  discountValue: number;
};

/**
 * Business rules for whether a coupon row can currently be redeemed for a
 * given event. Pure — used by the validate route AND re-checked in
 * confirm-order so an expired/exhausted coupon can't slip through between
 * "apply" and "pay".
 */
export const isCouponUsable = (
  coupon: Pick<
    Coupon,
    "is_active" | "valid_until" | "max_uses" | "times_used" | "event_id"
  >,
  eventId: number | null | undefined,
): boolean => {
  if (!coupon.is_active) return false;
  if (coupon.event_id != null && coupon.event_id !== Number(eventId))
    return false;
  if (coupon.max_uses != null && coupon.times_used >= coupon.max_uses)
    return false;
  if (coupon.valid_until) {
    // Inclusive: the coupon still works on its valid_until day (local date).
    const today = new Date().toISOString().slice(0, 10);
    if (coupon.valid_until.slice(0, 10) < today) return false;
  }
  return true;
};

/**
 * USD the coupon takes off the package total. Percent is applied to the
 * pre-discount total; both kinds are capped at the total (never negative
 * price). Rounded down — errs in the house's favor by at most $1.
 */
export const getCouponDiscountUsd = (
  coupon: Pick<AppliedCoupon, "discountType" | "discountValue">,
  baseTotalUsd: number,
): number => {
  if (baseTotalUsd <= 0) return 0;
  const raw =
    coupon.discountType === "percent"
      ? (baseTotalUsd * coupon.discountValue) / 100
      : coupon.discountValue;
  return Math.max(0, Math.min(Math.floor(raw), baseTotalUsd));
};

/**
 * Coupons are matched case-insensitively; canonical form is UPPERCASE.
 * Strict format guard: letters/digits/dash/underscore only, max 64 chars —
 * anything else (spaces, %, _-abuse via ILIKE wildcards) returns "" and the
 * lookup treats it as an unknown code. Underscore is allowed as a literal
 * character in codes; the DB query escapes it (see findValidCoupon).
 */
export const normalizeCouponCode = (code: string): string => {
  const normalized = code.trim().toUpperCase();
  return /^[A-Z0-9_-]{1,64}$/.test(normalized) ? normalized : "";
};
