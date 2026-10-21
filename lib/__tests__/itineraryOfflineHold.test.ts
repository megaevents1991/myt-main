import { describe, expect, it, vi } from "vitest";
import type { OrderHotel } from "../app.types";
import {
  blockDatesMismatch,
  checkOfflineHotel,
  holdOfflineHotel,
  judgeOfflineHotel,
  offlineHotelColumns,
  offlineHotelIds,
  roomCounts,
  type BlockRow,
  type OfflineHotelDb,
} from "../itinerary/offlineHold";

const NOW = new Date("2026-10-22T10:00:00Z");

/**
 * An own-stock stay for 7: a triple and a double from block 7, a double from block 9 (one id per
 * room, as /api/offline-hotels matches them). Block prices: 7 = $400 a room, 9 = $440 ->
 * $1,240, the order's price and offlineRawPrice.
 */
const own = {
  offlineId: 7,
  offlineIds: [7, 7, 9],
  offlineRawPrice: 1240,
  price: "1240",
  checkin: "2026-11-28",
  checkout: "2026-11-29",
  guests: [
    { adults: 3, children: [] },
    { adults: 2, children: [] },
    { adults: 1, children: [5] },
  ],
} as Partial<OrderHotel>;

const ctx = { pax: 7, eventIds: [644], now: NOW };

const block = (id: number, over: Partial<BlockRow> = {}): BlockRow => ({
  id,
  check_in: "2026-11-28",
  check_out: "2026-11-29",
  price: id === 7 ? 400 : 440,
  room_type: id === 7 ? "Triple" : "Double",
  num_rooms: id === 7 ? 5 : 2,
  consumed_rooms: id === 7 ? 3 : 1,
  event_ids: [644, 872],
  is_deleted: false,
  last_cancellation_date: "2026-11-20",
  ...over,
});
const rows = [block(7), block(9)];

/** A fake `offline_hotels` table: `consumed` per id, every call recorded. */
function fakeDb(consumed: Record<number, number | null>, blocks: BlockRow[] = [], over: Partial<OfflineHotelDb> = {}) {
  const calls: string[] = [];
  const db: OfflineHotelDb = {
    readBlocks: async (ids) => {
      calls.push(`readBlocks ${ids.join(",")}`);
      return { data: blocks.filter((b) => ids.includes(b.id)), error: null };
    },
    readConsumed: async (id) => {
      calls.push(`read ${id}`);
      return id in consumed ? { data: { consumed_rooms: consumed[id] } } : { data: null };
    },
    writeConsumed: async (id, value) => {
      calls.push(`write ${id}=${value}`);
      consumed[id] = value;
      return {};
    },
    ...over,
  };
  return { db, calls, consumed };
}

describe("offlineHotelIds - confirm-order route.ts:108-113", () => {
  it("offlineIds when there are any, else [offlineId], else none", () => {
    expect(offlineHotelIds(own)).toEqual([7, 7, 9]);
    expect(offlineHotelIds({ offlineId: 7, offlineIds: [] })).toEqual([7]);
    expect(offlineHotelIds({ offlineId: 0 })).toEqual([0]);
    expect(offlineHotelIds({ checkin: "2026-11-28" })).toBeNull();
    expect(offlineHotelIds(undefined)).toBeNull();
  });

  it("the reservation's columns: the first id, every id, the cost - all null for a live hotel", () => {
    expect(offlineHotelColumns(own)).toEqual({ offline_hotel_id: 7, offline_hotel_ids: [7, 7, 9], offline_hotel_cost: 1240 });
    expect(offlineHotelColumns({ offlineId: 7 })).toEqual({ offline_hotel_id: 7, offline_hotel_ids: [7], offline_hotel_cost: null });
    expect(offlineHotelColumns({ checkin: "x" })).toEqual({ offline_hotel_id: null, offline_hotel_ids: null, offline_hotel_cost: null });
    expect(offlineHotelColumns(undefined)).toEqual({ offline_hotel_id: null, offline_hotel_ids: null, offline_hotel_cost: null });
  });
});

describe("roomCounts - one id per room unit (route.ts:782-785)", () => {
  it("counts each block row's rooms", () => {
    expect([...roomCounts([7, 7, 9])]).toEqual([
      [7, 2],
      [9, 1],
    ]);
    expect(roomCounts([]).size).toBe(0);
  });
});

describe("blockDatesMismatch - route.ts:141-148", () => {
  it("every linked row on exactly the booked nights: no mismatch", () => {
    expect(blockDatesMismatch(own, [7, 9], rows)).toBe(false);
  });

  it("a row on other nights, a row missing, or no booked dates: mismatch", () => {
    expect(blockDatesMismatch(own, [7, 9], [block(7), block(9, { check_in: "2026-11-27" })])).toBe(true);
    expect(blockDatesMismatch(own, [7, 9], [block(7, { check_out: "2026-11-30" }), block(9)])).toBe(true);
    expect(blockDatesMismatch(own, [7, 9], [block(7)])).toBe(true);
    expect(blockDatesMismatch({ ...own, checkin: "" }, [7, 9], rows)).toBe(true);
    expect(blockDatesMismatch({ ...own, checkout: undefined }, [7, 9], rows)).toBe(true);
  });
});

describe("judgeOfflineHotel - the client's own-stock fields against the rows", () => {
  it("a true booking passes, and its cost is the rows' own", () => {
    expect(judgeOfflineHotel(own, ctx, rows)).toEqual({ result: "ok", cost: 1240 });
    // A live hotel has nothing to judge.
    expect(judgeOfflineHotel({ checkin: "2026-11-28" }, ctx, [])).toEqual({ result: "ok", cost: null });
  });

  it("one id per room of the stay, never more ids than travellers", () => {
    expect(judgeOfflineHotel({ ...own, offlineIds: [7, 9] }, ctx, rows)).toMatchObject({ result: "changed" });
    expect(judgeOfflineHotel({ ...own, offlineIds: [7, 7, 9, 9] }, ctx, rows)).toMatchObject({ result: "changed" });
    expect(judgeOfflineHotel(own, { ...ctx, pax: 2 }, rows)).toMatchObject({ result: "changed" });
  });

  it("the live date check comes first: a block on other nights is a mismatch", () => {
    expect(judgeOfflineHotel(own, ctx, [block(7), block(9, { check_out: "2026-11-30" })])).toMatchObject({ result: "mismatch" });
  });

  it("a deleted block or one of another event: changed", () => {
    expect(judgeOfflineHotel(own, ctx, [block(7, { is_deleted: true }), block(9)])).toMatchObject({ result: "changed" });
    expect(judgeOfflineHotel(own, ctx, [block(7, { event_ids: [1] }), block(9)])).toMatchObject({ result: "changed" });
    expect(judgeOfflineHotel(own, ctx, [block(7, { event_ids: null }), block(9)])).toMatchObject({ result: "changed" });
  });

  it("the rooms must fit the units (a party of 3 in a double is not a booking)", () => {
    const allDoubles = [block(7, { room_type: "Double" }), block(9)];
    expect(judgeOfflineHotel(own, ctx, allDoubles)).toMatchObject({ result: "changed" });
  });

  it("fewer rooms left than the stay takes: sold out (the count per row)", () => {
    // Block 7: 5 rooms, 4 taken -> 1 left, the stay takes 2.
    expect(judgeOfflineHotel(own, ctx, [block(7, { consumed_rooms: 4 }), block(9)])).toEqual({
      result: "sold_out",
      rowId: 7,
      left: 1,
      asked: 2,
    });
    expect(judgeOfflineHotel(own, ctx, [block(7), block(9, { consumed_rooms: 2 })])).toMatchObject({ result: "sold_out", rowId: 9 });
  });

  it("a price or a cost that is not the rows' sum: changed; a cent of rounding is not", () => {
    expect(judgeOfflineHotel({ ...own, price: "1" }, ctx, rows)).toMatchObject({ result: "changed" });
    expect(judgeOfflineHotel({ ...own, offlineRawPrice: 1 }, ctx, rows)).toMatchObject({ result: "changed" });
    expect(judgeOfflineHotel({ ...own, price: "1240.004" }, ctx, rows)).toEqual({ result: "ok", cost: 1240 });
    expect(judgeOfflineHotel({ ...own, offlineRawPrice: undefined }, ctx, rows)).toEqual({ result: "ok", cost: 1240 });
    expect(judgeOfflineHotel(own, ctx, [block(7, { price: null }), block(9)])).toMatchObject({ result: "changed" });
  });

  it("refundable by the rows' own earliest deadline - not by the client's rate", () => {
    const passed = [block(7, { last_cancellation_date: "2026-10-01" }), block(9)];
    expect(judgeOfflineHotel(own, ctx, passed)).toEqual({ result: "not_refundable" });
    expect(judgeOfflineHotel(own, ctx, [block(7, { last_cancellation_date: null }), block(9, { last_cancellation_date: null })])).toEqual({
      result: "not_refundable",
    });
    // Within a week of check-in a non-refundable block may be sold (the live 7-day rule).
    expect(judgeOfflineHotel(own, { ...ctx, now: new Date("2026-11-24T10:00:00Z") }, passed)).toEqual({ result: "ok", cost: 1240 });
  });
});

describe("checkOfflineHotel - before the insert", () => {
  it("a live hotel (or none) needs no read", async () => {
    const { db, calls } = fakeDb({});
    expect(await checkOfflineHotel({ checkin: "2026-11-28" }, ctx, db)).toEqual({ result: "ok", cost: null });
    expect(await checkOfflineHotel(undefined, ctx, db)).toEqual({ result: "ok", cost: null });
    expect(calls).toEqual([]);
  });

  it("reads each block row once and judges the booking on them", async () => {
    const { db, calls } = fakeDb({}, rows);
    expect(await checkOfflineHotel(own, ctx, db)).toEqual({ result: "ok", cost: 1240 });
    expect(calls).toEqual(["readBlocks 7,9"]);
  });

  it("a block on other nights, or gone: mismatch", async () => {
    expect(await checkOfflineHotel(own, ctx, fakeDb({}, [block(7), block(9, { check_in: "2026-11-26" })]).db)).toMatchObject({
      result: "mismatch",
    });
    expect(await checkOfflineHotel(own, ctx, fakeDb({}, [block(7)]).db)).toMatchObject({ result: "mismatch" });
  });

  it("a failed read is an error (the live route refuses the order then)", async () => {
    const failing = fakeDb({}, [], { readBlocks: async () => ({ data: null, error: { code: "57014", message: "timeout" } }) });
    expect(await checkOfflineHotel(own, ctx, failing.db)).toEqual({ result: "error", error: { code: "57014", message: "timeout" } });
    const throwing = fakeDb({}, [], {
      readBlocks: async () => {
        throw new Error("network");
      },
    });
    expect(await checkOfflineHotel(own, ctx, throwing.db)).toEqual({ result: "error", error: { message: "network" } });
  });
});

describe("holdOfflineHotel - after the insert (holdOfflineInventory, route.ts:772-801)", () => {
  it("consumed_rooms += the rooms taken from each block row", async () => {
    const { db, calls, consumed } = fakeDb({ 7: 3, 9: null });
    await holdOfflineHotel(own, db);
    expect(consumed).toEqual({ 7: 5, 9: 1 });
    expect(calls).toEqual(["read 7", "write 7=5", "read 9", "write 9=1"]);
  });

  it("a live hotel holds nothing; a row that cannot be read is skipped", async () => {
    const live = fakeDb({ 7: 1 });
    await holdOfflineHotel({ checkin: "2026-11-28" }, live.db);
    expect(live.calls).toEqual([]);
    const missing = fakeDb({ 9: 0 });
    await holdOfflineHotel(own, missing.db);
    expect(missing.calls).toEqual(["read 7", "read 9", "write 9=1"]);
  });

  it("never throws - the failure is logged and the hold stands", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = fakeDb({}, [], {
      readConsumed: async () => {
        throw new Error("down");
      },
    });
    await expect(holdOfflineHotel(own, broken.db)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});
