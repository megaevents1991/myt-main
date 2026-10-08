import { afterEach, describe, expect, it, vi } from "vitest";

// The cost snapshot reads OUR event row and TixStock's feed; both are stubbed so the
// listing pick is what is under test.
const eventRow = vi.hoisted(() => ({
  value: {
    tx_excluded_sections: [] as string[],
    tickets_and_rates: [{ id: "c1", category: "Categoría 1 (CAT1)" }],
  } as Record<string, unknown> | null,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: eventRow.value, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/exchangeRateService", () => ({
  exchangeRateService: {
    ensureFresh: async () => {},
    getEurUsdRate: () => ({ rate: 1.2 }),
    getGbpUsdRate: () => ({ rate: 1.3 }),
    getUsdIlsRate: () => ({ rate: 3.5 }),
  },
}));

import { cheapestListingCostUsd } from "@/lib/tixstock-feed";

type L = {
  category: string;
  section?: string;
  row?: string;
  amount: string;
  currency?: string;
  available?: number;
  split?: string;
  restriction?: string;
};

const listing = (l: L) => ({
  id: Math.random().toString(36),
  seat_details: { category: l.category, section: l.section ?? "", row: l.row ?? "1" },
  proceed_price: { amount: l.amount, currency: l.currency ?? "USD" },
  number_of_tickets_for_sale: { quantity_available: l.available ?? 4, split_quantity: 0 },
  ticket: { split_type: l.split ?? "No Preferences" },
  restrictions_benefits: { options: [], other: l.restriction ?? "" },
});

const stubFeed = (listings: ReturnType<typeof listing>[]) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: listings, meta: { last_page: 1 } }),
    })),
  );
};

const ask = (over: Partial<Parameters<typeof cheapestListingCostUsd>[0]> = {}) =>
  cheapestListingCostUsd({
    tixstockEventId: "t1",
    eventId: 1,
    ticketId: "c1",
    category: null,
    quantity: 2,
    ...over,
  });

afterEach(() => {
  vi.unstubAllGlobals();
  eventRow.value = {
    tx_excluded_sections: [],
    tickets_and_rates: [{ id: "c1", category: "Categoría 1 (CAT1)" }],
  };
});

describe("cheapestListingCostUsd", () => {
  it("the cheapest listing of OUR ticket's category the site would sell, as raw cost", async () => {
    stubFeed([
      listing({ category: "CATEGORÍA 1 (CAT1)", amount: "90" }),
      listing({ category: "Categoria 1", amount: "80" }), // same category, renamed
      listing({ category: "Categoria 2", amount: "10" }), // another category
      listing({ category: "Categoria 1", amount: "20", available: 1 }), // cannot sell a pair
      listing({ category: "Categoria 1", amount: "30", restriction: "Side view" }), // restricted view
    ]);
    expect(await ask()).toBe(80);
  });

  it("skips an excluded section", async () => {
    eventRow.value = {
      tx_excluded_sections: ["categoria-1_a12"],
      tickets_and_rates: [{ id: "c1", category: "Categoría 1 (CAT1)" }],
    };
    stubFeed([
      listing({ category: "Categoria 1", section: "A12", amount: "40" }),
      listing({ category: "Categoria 1", section: "B3", amount: "85" }),
    ]);
    expect(await ask()).toBe(85);
  });

  it("is the cost of the listing the SITE ranks first: by selling price, reported without markup or card step", async () => {
    // 80 USD sells at (80+40)*1.035 = 124.2; 59 EUR at (59+40)*1.2*1.035 = 122.9 -> the EUR one,
    // whose raw cost is 59 * 1.2 = 70.8.
    stubFeed([
      listing({ category: "Categoria 1", amount: "80", currency: "USD" }),
      listing({ category: "Categoria 1", amount: "59", currency: "EUR" }),
    ]);
    expect(await ask()).toBeCloseTo(70.8, 6);
  });

  it("prices the 'all together' twin from the cheapest listing whose seats sit together", async () => {
    stubFeed([
      listing({ category: "Categoria 1", amount: "50" }),
      listing({ category: "Categoria 1", amount: "75", row: "*TOGETHER*" }),
      listing({ category: "Categoria 1", amount: "95", split: "Sell Together", available: 2 }),
    ]);
    expect(await ask()).toBe(50);
    expect(await ask({ together: true })).toBe(75);
  });

  it("null when nothing qualifies, or the category is unknown", async () => {
    stubFeed([listing({ category: "Categoria 2", amount: "10" })]);
    expect(await ask()).toBeNull();
    eventRow.value = { tx_excluded_sections: [], tickets_and_rates: [] };
    expect(await ask({ ticketId: "nope", category: null })).toBeNull();
  });

  it("falls back to the category the order carried when our event has no such ticket id", async () => {
    eventRow.value = { tx_excluded_sections: [], tickets_and_rates: [] };
    stubFeed([listing({ category: "Categoria 1", amount: "66" })]);
    expect(await ask({ ticketId: "gone", category: "Categoría 1 (CAT1)" })).toBe(66);
  });

  it("throws when the feed answers an error (the snapshot turns that into 'no cost')", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, statusText: "boom", json: async () => ({}) })),
    );
    await expect(ask()).rejects.toThrow(/Upstream 500/);
  });
});
