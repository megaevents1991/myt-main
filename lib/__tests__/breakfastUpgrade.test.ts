import { describe, it, expect } from "vitest";
import { findBreakfastUpgrade } from "@/app/order/order-review.utils";
import { rateIsRefundable, sameRateTerms } from "../hotelRateTerms";
import type { Rate } from "../hotel.type";
import type { OrderHotel } from "../app.types";
import type { HotelsData } from "@/app/hooks/HotelFetch.provider";

const rate = (o: {
  hash: string;
  price: number;
  breakfast?: boolean;
  refundable?: boolean;
  type?: string;
  rg?: Record<string, number>;
}): Rate =>
  ({
    match_hash: o.hash,
    rg_ext: o.rg ?? { class: 3, bedding: 2 },
    room_data_trans: { main_name: "Double Room", bedding_type: "double bed" },
    meal_data: { has_breakfast: !!o.breakfast, no_child_meal: false, value: o.breakfast ? "breakfast" : "nomeal" },
    payment_options: {
      payment_types: [
        {
          show_amount: String(o.price),
          type: o.type ?? "now",
          cancellation_penalties: {
            policies: [],
            free_cancellation_before: o.refundable ? "2026-10-01T10:00:00" : null,
          },
        },
      ],
    },
  }) as unknown as Rate;

const guests2 = [{ adults: 2, children: [] }];
const hotel = (selected: Rate, guests = guests2): OrderHotel =>
  ({ id: "h1", rate: selected, price: "400", checkin: "2026-10-10", checkout: "2026-10-13", guests }) as unknown as OrderHotel;
const serp = (rates: Rate[], guests = guests2): HotelsData =>
  ({
    data: {
      debug: { request: { checkin: "2026-10-10", checkout: "2026-10-13", guests } },
      data: { hotels: [{ id: "h1", hid: 1, rates }] },
    },
    hotelsInfo: {},
  }) as unknown as HotelsData;

describe("rate terms", () => {
  it("reads refundability from free_cancellation_before", () => {
    expect(rateIsRefundable(rate({ hash: "a", price: 1, refundable: true }))).toBe(true);
    expect(rateIsRefundable(rate({ hash: "a", price: 1 }))).toBe(false);
  });
  it("compares refundability, payment type and rg_ext (key order and missing = {})", () => {
    const a = rate({ hash: "a", price: 1, refundable: true });
    expect(sameRateTerms(a, rate({ hash: "b", price: 1, refundable: true, rg: { bedding: 2, class: 3 } }))).toBe(true);
    expect(sameRateTerms(a, rate({ hash: "b", price: 1 }))).toBe(false);
    expect(sameRateTerms(a, rate({ hash: "b", price: 1, refundable: true, type: "hotel" }))).toBe(false);
    expect(sameRateTerms(a, rate({ hash: "b", price: 1, refundable: true, rg: { class: 4, bedding: 2 } }))).toBe(false);
    const noRg = { ...a, rg_ext: undefined } as unknown as Rate;
    expect(sameRateTerms(noRg, { ...noRg, match_hash: "c" })).toBe(true);
  });
});

describe("findBreakfastUpgrade", () => {
  const selected = rate({ hash: "sel", price: 400, refundable: true });

  it("offers the same-terms breakfast rate at its delta", () => {
    const up = findBreakfastUpgrade(hotel(selected), serp([selected, rate({ hash: "bf", price: 460, breakfast: true, refundable: true })]));
    expect(up?.rate.match_hash).toBe("bf");
    expect(up?.deltaUsd).toBe(60);
  });

  it("never swaps onto a rate with other terms (the +$0 non-refundable case)", () => {
    const cheaperNonRef = rate({ hash: "bf", price: 350, breakfast: true });
    expect(findBreakfastUpgrade(hotel(selected), serp([selected, cheaperNonRef]))).toBeNull();
  });

  it("returns null when the cheapest same-terms breakfast rate is cheaper", () => {
    const cheaper = rate({ hash: "bf", price: 380, breakfast: true, refundable: true });
    expect(findBreakfastUpgrade(hotel(selected), serp([selected, cheaper]))).toBeNull();
  });

  it("returns null when the search was for another number of guests", () => {
    const bf = rate({ hash: "bf", price: 460, breakfast: true, refundable: true });
    expect(findBreakfastUpgrade(hotel(selected), serp([selected, bf], [{ adults: 3, children: [] }]))).toBeNull();
  });
});
