import { beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the PostgREST builder: answers each .range() with that slice of
// `rows`, the way the real one caps every response at 1,000 rows.
const db = vi.hoisted(() => ({
  rows: [] as { category_id: number; event_id: number }[],
  ranges: [] as [number, number][],
  orders: [] as string[],
  failFrom: null as number | null,
}));

vi.mock("@/lib/supabase", () => {
  const builder = {
    select: () => builder,
    in: () => builder,
    order: (col: string) => {
      db.orders.push(col);
      return builder;
    },
    range: (from: number, to: number) => {
      db.ranges.push([from, to]);
      if (db.failFrom === from) return Promise.resolve({ data: null, error: { message: "boom" } });
      return Promise.resolve({ data: db.rows.slice(from, to + 1), error: null });
    },
  };
  return { supabase: { from: () => builder } };
});

import { getEventIdsByCategories, readCategoryLinks } from "../taxonomy";

beforeEach(() => {
  db.rows = Array.from({ length: 2500 }, (_, i) => ({ category_id: 1 + (i % 7), event_id: 1000 + i }));
  db.ranges = [];
  db.orders = [];
  db.failFrom = null;
});

describe("readCategoryLinks", () => {
  it("reads past PostgREST's 1,000-row cap, page by page, in a fixed order", async () => {
    const rows = await readCategoryLinks([1, 2, 3, 4, 5, 6, 7]);
    expect(rows).toHaveLength(2500);
    expect(db.ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    expect(db.orders.slice(0, 2)).toEqual(["category_id", "event_id"]);
  });

  it("stops after a full last page with one empty read", async () => {
    db.rows = db.rows.slice(0, 2000);
    expect(await readCategoryLinks([1])).toHaveLength(2000);
    expect(db.ranges).toHaveLength(3);
  });

  it("answers null when any page fails, never a partial list", async () => {
    db.failFrom = 1000;
    expect(await readCategoryLinks([1])).toBeNull();
  });

  it("asks nothing for no categories", async () => {
    expect(await readCategoryLinks([])).toEqual([]);
    expect(db.ranges).toHaveLength(0);
  });
});

describe("getEventIdsByCategories", () => {
  it("returns every link, not the first 1,000", async () => {
    const map = await getEventIdsByCategories([1, 2, 3, 4, 5, 6, 7]);
    const total = [...map.values()].reduce((n, s) => n + s.size, 0);
    expect(total).toBe(2500);
    expect(map.get(1)?.has(1000)).toBe(true);
  });

  it("keeps its old answer to a failed read: an empty map", async () => {
    db.failFrom = 0;
    expect((await getEventIdsByCategories([1])).size).toBe(0);
  });
});
