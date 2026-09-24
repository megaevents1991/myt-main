import type { Rate } from "@/lib/hotel.type";

/**
 * The booking terms of a hotel rate, as far as a rate swap is concerned.
 * Two rates of the same room with different terms are different products:
 * swapping a free-cancellation rate for a non-refundable one (or a pay-now
 * for a pay-at-hotel) is not an "add breakfast", whatever the price says.
 */

/** The payment type the order uses - always the first one (see the
 *  cancellation lines in OrderReview.tsx and lib/hotelFilter.ts). */
const firstPaymentType = (rate: Rate | undefined) =>
  rate?.payment_options?.payment_types?.[0];

/** Refundable = the rate carries a free-cancellation deadline (the same test
 *  lib/hotelFilter.ts uses for the "free cancellation" filter). */
export const rateIsRefundable = (rate: Rate | undefined): boolean =>
  !!firstPaymentType(rate)?.cancellation_penalties?.free_cancellation_before;

/** Stable JSON of an object - key order must not make two equal rg_ext differ. */
const stableJson = (value: unknown): string => {
  if (value == null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`)
    .join(",")}}`;
};

/** Same refundability, same payment type, same room attributes (rg_ext;
 *  missing = {}). */
export const sameRateTerms = (a: Rate | undefined, b: Rate | undefined): boolean => {
  if (!a || !b) return false;
  if (rateIsRefundable(a) !== rateIsRefundable(b)) return false;
  if ((firstPaymentType(a)?.type ?? "") !== (firstPaymentType(b)?.type ?? "")) {
    return false;
  }
  return stableJson(a.rg_ext ?? {}) === stableJson(b.rg_ext ?? {});
};
