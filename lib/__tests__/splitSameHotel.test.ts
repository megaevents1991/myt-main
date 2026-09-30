import { describe, it, expect } from "vitest";
import { closestRate } from "@/app/order/order-review.utils";
import { proposedSplit, segmentsFromNights } from "../events/lodging";
import type { Rate } from "../hotel.type";

const rate = (o: {
  hash: string;
  room?: string;
  breakfast?: boolean;
  refundable?: boolean;
}): Rate =>
  ({
    match_hash: o.hash,
    room_data_trans: { main_name: o.room ?? "Double Room", bedding_type: "double bed" },
    meal_data: { has_breakfast: !!o.breakfast, no_child_meal: false, value: o.breakfast ? "breakfast" : "nomeal" },
    payment_options: {
      payment_types: [
        {
          show_amount: "100",
          type: "now",
          cancellation_penalties: {
            policies: [],
            free_cancellation_before: o.refundable ? "2026-10-01T10:00:00" : null,
          },
        },
      ],
    },
  }) as unknown as Rate;

describe("closestRate - the same hotel on the return leg of a split", () => {
  it("prefers the same room over a cheaper other room", () => {
    const ref = rate({ hash: "ref", room: "Suite" });
    const rates = [rate({ hash: "cheap", room: "Single" }), rate({ hash: "suite", room: "Suite" })];
    expect(closestRate(rates, ref)?.match_hash).toBe("suite");
  });
  it("then the same board, then the same refundability", () => {
    const ref = rate({ hash: "ref", breakfast: true, refundable: true });
    const rates = [
      rate({ hash: "plain" }),
      rate({ hash: "bb-nonref", breakfast: true }),
      rate({ hash: "bb-ref", breakfast: true, refundable: true }),
    ];
    expect(closestRate(rates, ref)?.match_hash).toBe("bb-ref");
  });
  it("keeps the cheapest (first) on a tie, and handles no rates / no reference", () => {
    const rates = [rate({ hash: "a" }), rate({ hash: "b" })];
    expect(closestRate(rates, rate({ hash: "ref" }))?.match_hash).toBe("a");
    expect(closestRate(rates, undefined)?.match_hash).toBe("a");
    expect(closestRate([], rate({ hash: "ref" }))).toBeNull();
  });
});

describe("proposedSplit - what 'פיצול מלונות' lays out", () => {
  const event = {
    date: "2026-10-15",
    location: { name: "לונדון, בריטניה", latitude: 51.5, longitude: -0.12, city_iata: "LON" },
    event_location: { name: "ליברפול", latitude: 53.4, longitude: -2.99 },
    lodging_mode: "choice_split",
    split_default_nights: 2,
  };
  it("2 nights in the event city around the game, the rest in the flight city (A → B → A)", () => {
    const segs = segmentsFromNights(proposedSplit(event, "2026-10-13", "2026-10-17"));
    expect(segs.map((s) => `${s.city}:${s.nights}`)).toEqual(["flight:1", "event:2", "flight:1"]);
  });
  it("never lays out a one-city 'split'", () => {
    const nights = proposedSplit(event, "2026-10-14", "2026-10-16");
    expect(segmentsFromNights(nights).length).toBe(2);
  });
});
