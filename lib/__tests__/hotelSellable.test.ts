import { describe, it, expect } from "vitest";
import {
  NON_REFUNDABLE_WINDOW_DAYS,
  daysToCheckin,
  nonRefundableAllowed,
  orderHotelSellable,
  rateIsRefundable,
  rateSellable,
  sellableHotels,
} from "../hotelRateTerms";
import type { Rate } from "../hotel.type";

const rate = (hash: string, freeUntil: string | null): Rate =>
  ({
    match_hash: hash,
    payment_options: {
      payment_types: [
        {
          show_amount: "100",
          type: "deposit",
          cancellation_penalties: { policies: [], free_cancellation_before: freeUntil },
        },
      ],
    },
  }) as unknown as Rate;

// 19.10.2026 21:00 in Israel (18:00 UTC).
const NOW = new Date("2026-10-19T18:00:00Z");

describe("daysToCheckin / nonRefundableAllowed - Dor 19.10: non-refundable only from 7 days before check-in", () => {
  it("counts calendar days in Israel", () => {
    expect(daysToCheckin("2026-10-26", NOW)).toBe(7);
    expect(daysToCheckin("2026-10-27", NOW)).toBe(8);
    // 21:30 UTC is still the 19th in UTC but already 00:30 on the 20th in Israel.
    expect(daysToCheckin("2026-10-27", new Date("2026-10-19T21:30:00Z"))).toBe(7);
  });
  it("allows a stay that starts within the window, refuses one after it", () => {
    expect(NON_REFUNDABLE_WINDOW_DAYS).toBe(7);
    expect(nonRefundableAllowed("2026-10-26", NOW)).toBe(true);
    expect(nonRefundableAllowed("2026-10-20", NOW)).toBe(true);
    expect(nonRefundableAllowed("2026-10-27", NOW)).toBe(false);
    expect(nonRefundableAllowed("2027-05-20", NOW)).toBe(false);
  });
  it("an unreadable check-in never opens the window", () => {
    expect(nonRefundableAllowed("", NOW)).toBe(false);
    expect(nonRefundableAllowed(undefined, NOW)).toBe(false);
    expect(nonRefundableAllowed("20.5.2027", NOW)).toBe(false);
  });
});

describe("rateIsRefundable", () => {
  it("is the free-cancellation deadline, as before, when no clock is given", () => {
    expect(rateIsRefundable(rate("a", "2026-10-01T10:00:00"))).toBe(true);
    expect(rateIsRefundable(rate("b", null))).toBe(false);
    expect(rateIsRefundable(rate("c", ""))).toBe(false);
  });
  it("with a clock, a deadline that already passed is not refundable", () => {
    expect(rateIsRefundable(rate("a", "2027-05-17T23:00:00"), NOW)).toBe(true);
    expect(rateIsRefundable(rate("b", "2026-10-19T10:00:00"), NOW)).toBe(false);
    // Offline inventory stores a date only.
    expect(rateIsRefundable(rate("c", "2027-05-10"), NOW)).toBe(true);
  });
});

describe("sellableHotels - what /api/hotels may answer", () => {
  const hotels = [
    { id: "square_louvois", rates: [rate("nonref", null), rate("free", "2027-05-17T23:00:00")] },
    { id: "only_nonref", rates: [rate("x", null)] },
    { id: "only_free", rates: [rate("y", "2027-05-15T23:00:00")] },
  ];

  it("far from check-in: drops non-refundable rates and hotels left with none (reservation 2233)", () => {
    const out = sellableHotels(hotels, "2027-05-20", NOW);
    expect(out.map((h) => h.id)).toEqual(["square_louvois", "only_free"]);
    expect(out[0].rates.map((r) => r.match_hash)).toEqual(["free"]);
  });
  it("within 7 days: every rate stays", () => {
    expect(sellableHotels(hotels, "2026-10-25", NOW)).toBe(hotels);
  });
  it("keeps the rest of each hotel as it was", () => {
    const out = sellableHotels([{ id: "h", hid: 7, rates: [rate("f", "2027-05-15")] }], "2027-05-20", NOW);
    expect(out[0]).toMatchObject({ id: "h", hid: 7 });
  });
});

describe("rateSellable / orderHotelSellable - checkout, drafts and stored packages", () => {
  it("refuses a non-refundable order hotel far from check-in", () => {
    expect(orderHotelSellable({ rate: rate("n", null), checkin: "2027-05-20" }, NOW)).toBe(false);
    expect(orderHotelSellable({ rate: rate("f", "2027-05-17T23:00:00"), checkin: "2027-05-20" }, NOW)).toBe(true);
  });
  it("accepts a non-refundable one inside the window", () => {
    expect(rateSellable(rate("n", null), "2026-10-22", NOW)).toBe(true);
    expect(orderHotelSellable({ rate: rate("n", null), checkin: "2026-10-22" }, NOW)).toBe(true);
  });
  it("no hotel, a skipped hotel ({}) or a hotel with no rate is nothing to refuse", () => {
    expect(orderHotelSellable(null, NOW)).toBe(true);
    expect(orderHotelSellable(undefined, NOW)).toBe(true);
    expect(orderHotelSellable({}, NOW)).toBe(true);
  });
  it("a non-refundable hotel with no check-in is refused, never waved through", () => {
    expect(orderHotelSellable({ rate: rate("n", null) }, NOW)).toBe(false);
  });
});
