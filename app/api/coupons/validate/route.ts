import { NextResponse } from "next/server";
import { findValidCoupon } from "@/lib/coupons";

/**
 * Validate a customer-entered coupon code for an event.
 * Success → { code, discountType, discountValue }.
 * Any failure (unknown/inactive/expired/exhausted/wrong event) → {} with 200,
 * so callers can't enumerate codes or probe why one was rejected.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const eventIdParam = searchParams.get("eventId");

  if (!code) return NextResponse.json({});

  try {
    const eventId = eventIdParam ? Number(eventIdParam) : null;
    const coupon = await findValidCoupon(code, eventId);
    if (!coupon) return NextResponse.json({});

    return NextResponse.json({
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
    });
  } catch (e) {
    console.error("Coupon validation failed:", e);
    return NextResponse.json({});
  }
}
