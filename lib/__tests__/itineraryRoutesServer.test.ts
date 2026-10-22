import { beforeEach, describe, expect, it, vi } from "vitest";

/** What the mocked `itinerary_routes` read answers, and the query it was asked. */
const read = vi.hoisted(() => ({
  answer: { data: null as unknown, error: null as null | { message: string; code?: string } },
  calls: [] as [string, ...unknown[]][],
}));

// The cache is a pass-through here: the real one needs Next's request store.
vi.mock("next/cache", () => ({ unstable_cache: <T extends (...a: never[]) => unknown>(fn: T) => fn }));

vi.mock("@/lib/supabase", () => {
  const query = {
    select: (cols: string) => (read.calls.push(["select", cols]), query),
    eq: (col: string, v: unknown) => (read.calls.push(["eq", col, v]), query),
    order: (col: string, o: unknown) => (read.calls.push(["order", col, o]), query),
    then: (resolve: (v: unknown) => unknown) => resolve(read.answer),
  };
  return { supabase: { from: (table: string) => (read.calls.push(["from", table]), query) } };
});

import { getStaffRoutesForPage, ITINERARY_ROUTES_TAG } from "../itinerary/routes.server";

beforeEach(() => {
  read.answer = { data: null, error: null };
  read.calls = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("getStaffRoutesForPage", () => {
  it("the tag the backoffice revalidates", () => {
    expect(ITINERARY_ROUTES_TAG).toBe("itinerary-routes");
  });

  it("reads the active rows by sort_order, then id", async () => {
    read.answer = { data: [{ id: 1, title: " שלנו ", event_ids: [1, 2], sort_order: 0 }], error: null };
    await expect(getStaffRoutesForPage()).resolves.toEqual([
      { id: 1, title: "שלנו", event_ids: [1, 2], sort_order: 0 },
    ]);
    expect(read.calls).toEqual([
      ["from", "itinerary_routes"],
      ["select", "id, title, event_ids, sort_order"],
      ["eq", "is_active", true],
      ["order", "sort_order", { ascending: true }],
      ["order", "id", { ascending: true }],
    ]);
  });

  it("a malformed row is dropped, the rest stays", async () => {
    read.answer = {
      data: [
        { id: 1, title: " ", event_ids: [1, 2], sort_order: 0 },
        { id: 2, title: "טוב", event_ids: [1, 2], sort_order: 1 },
      ],
      error: null,
    };
    expect((await getStaffRoutesForPage()).map((r) => r.id)).toEqual([2]);
  });

  it("a missing table (42P01 / PGRST205) is no staff trips", async () => {
    read.answer = { data: null, error: { message: 'relation "itinerary_routes" does not exist', code: "42P01" } };
    await expect(getStaffRoutesForPage()).resolves.toEqual([]);
    read.answer = { data: null, error: { message: "Could not find the table", code: "PGRST205" } };
    await expect(getStaffRoutesForPage()).resolves.toEqual([]);
  });

  it("any other failure throws - the page keeps its last good version", async () => {
    read.answer = { data: null, error: { message: "connection refused", code: "08006" } };
    await expect(getStaffRoutesForPage()).rejects.toThrow(/staff trips unavailable/);
  });

  it("a coded error whose words say 'does not exist' is not a missing table (a missing column)", async () => {
    read.answer = {
      data: null,
      error: { message: 'column "event_ids" of relation "itinerary_routes" does not exist', code: "42703" },
    };
    await expect(getStaffRoutesForPage()).rejects.toThrow(/staff trips unavailable/);
  });
});
