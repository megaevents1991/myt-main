import { describe, expect, it } from "vitest";
import {
  DATA_CACHE_ITEM_LIMIT,
  dataCacheItemSize,
  dataCacheItemState,
} from "@/lib/events/cacheItemSize";

describe("dataCacheItemSize", () => {
  it("counts the value the way Next stores it - as a JSON string inside the entry", () => {
    const value = { events: [{ id: 1, name: 'He said "hi"' }] };
    const asNextStoresIt = JSON.stringify({
      kind: "FETCH",
      data: { headers: {}, body: JSON.stringify(value), status: 200, url: "" },
      revalidate: 3600,
    });
    expect(dataCacheItemSize(value)).toBe(asNextStoresIt.length);
  });

  it("is bigger than the plain JSON: every quote is escaped once more", () => {
    const value = { events: Array.from({ length: 50 }, (_, id) => ({ id, name: "אירוע", tags: ["a", "b"] })) };
    const plain = JSON.stringify(value).length;
    const quotes = (JSON.stringify(value).match(/"/g) ?? []).length;
    expect(dataCacheItemSize(value)).toBeGreaterThanOrEqual(plain + quotes);
  });

  it("a catalog that looks safe as plain JSON can already be over the limit", () => {
    // 1.9M characters of JSON, a fifth of them quotes - under 2MB plain, over it once stored.
    const row = { n: '"'.repeat(8) + "x".repeat(30) };
    const events = Array.from({ length: 36_000 }, () => row);
    expect(JSON.stringify({ events }).length).toBeLessThan(DATA_CACHE_ITEM_LIMIT);
    expect(dataCacheItemState(dataCacheItemSize({ events }))).toBe("over");
  });
});

describe("dataCacheItemState", () => {
  it("says ok, near and over at the right places", () => {
    expect(dataCacheItemState(1_000_000)).toBe("ok");
    expect(dataCacheItemState(Math.ceil(DATA_CACHE_ITEM_LIMIT * 0.85))).toBe("near");
    expect(dataCacheItemState(DATA_CACHE_ITEM_LIMIT)).toBe("near");
    expect(dataCacheItemState(DATA_CACHE_ITEM_LIMIT + 1)).toBe("over");
  });
});
