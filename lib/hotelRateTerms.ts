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
 *  lib/hotelFilter.ts uses for the "free cancellation" filter). With a clock,
 *  a deadline that already passed does not count. The supplier's deadlines are
 *  the hotel's local time with no zone ("2027-05-17T23:00:00", offline
 *  inventory a bare date), compared as text against UTC - hours, not days. */
export const rateIsRefundable = (
  rate: Rate | undefined,
  now?: Date | number
): boolean => {
  const deadline = firstPaymentType(rate)?.cancellation_penalties?.free_cancellation_before;
  if (!deadline) return false;
  if (now == null) return true;
  return deadline > new Date(now).toISOString().slice(0, 19);
};

/**
 * Non-refundable hotels (Dor, 19.10.2026 - reservation 2233: a Paris hotel
 * bought seven months ahead on a rate that cancels for nothing back): the site
 * sells a non-refundable rate ONLY when the stay starts within this many days.
 * Further out a hotel with no free-cancellation rate is not shown at all, and
 * a search that has none says so with the usual "contact us" card.
 * Enforced where every hotel enters the site - /api/hotels (list, name search,
 * split stay, the ready package's own search), /api/offline-hotels,
 * /api/package/[id], the order draft and confirm-order.
 */
export const NON_REFUNDABLE_WINDOW_DAYS = 7;

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Today's calendar date in Israel, YYYY-MM-DD. */
const israelDay = (now: Date | number): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));

/** Calendar days from today (Israel) to `checkin` (YYYY-MM-DD); null when unreadable. */
export const daysToCheckin = (
  checkin: string | null | undefined,
  now: Date | number
): number | null => {
  const c = DAY_RE.exec(checkin ?? "");
  const t = DAY_RE.exec(israelDay(now));
  if (!c || !t) return null;
  const utc = (m: RegExpExecArray) => Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return Math.round((utc(c) - utc(t)) / 86_400_000);
};

/** A stay starting `checkin` may be sold on a non-refundable rate. */
export const nonRefundableAllowed = (
  checkin: string | null | undefined,
  now: Date | number
): boolean => {
  const days = daysToCheckin(checkin, now);
  return days != null && days <= NON_REFUNDABLE_WINDOW_DAYS;
};

/** The site may sell this rate for a stay starting `checkin`. */
export const rateSellable = (
  rate: Rate | undefined,
  checkin: string | null | undefined,
  now: Date | number
): boolean => rateIsRefundable(rate, now) || nonRefundableAllowed(checkin, now);

/** Search results with only the rates the site may sell; a hotel left with none is dropped. */
export function sellableHotels<H extends { rates: Rate[] }>(
  hotels: H[],
  checkin: string,
  now: Date | number
): H[] {
  if (nonRefundableAllowed(checkin, now)) return hotels;
  return hotels.reduce<H[]>((kept, hotel) => {
    const rates = (hotel.rates ?? []).filter((rate) => rateIsRefundable(rate, now));
    if (rates.length) kept.push({ ...hotel, rates });
    return kept;
  }, []);
}

/** An order's hotel (or one split segment) the site may sell. No hotel, a
 *  skipped one ({}) or one without a rate has nothing to refuse. */
export const orderHotelSellable = (
  hotel: { rate?: Rate; checkin?: string } | null | undefined,
  now: Date | number
): boolean => !hotel?.rate || rateSellable(hotel.rate, hotel.checkin, now);

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
