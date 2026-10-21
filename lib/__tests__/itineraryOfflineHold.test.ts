import { describe, expect, it, vi } from "vitest";
import {
  blockDatesMismatch,
  checkOfflineHotel,
  holdOfflineHotel,
  offlineHotelColumns,
  offlineHotelIds,
  roomCounts,
  type BlockRow,
  type OfflineHotelDb,
} from "../itinerary/offlineHold";

/** An own-stock stay: a triple + a double from block 7, one double from block 9 (one id per room). */
const own = { offlineId: 7, offlineIds: [7, 7, 9], offlineRawPrice: 1240, checkin: "2026-11-28", checkout: "2026-11-29" };
const block = (id: number, check_in = "2026-11-28", check_out = "2026-11-29"): BlockRow => ({ id, check_in, check_out });

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

  it("the reservation's columns: the first id, every id, the block's cost - all null for a live hotel", () => {
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
    expect(blockDatesMismatch(own, [7, 9], [block(7), block(9)])).toBe(false);
  });

  it("a row on other nights, a row missing, or no booked dates: mismatch", () => {
    expect(blockDatesMismatch(own, [7, 9], [block(7), block(9, "2026-11-27")])).toBe(true);
    expect(blockDatesMismatch(own, [7, 9], [block(7, "2026-11-28", "2026-11-30"), block(9)])).toBe(true);
    expect(blockDatesMismatch(own, [7, 9], [block(7)])).toBe(true);
    expect(blockDatesMismatch({ ...own, checkin: "" }, [7, 9], [block(7), block(9)])).toBe(true);
    expect(blockDatesMismatch({ ...own, checkout: undefined }, [7, 9], [block(7), block(9)])).toBe(true);
  });
});

describe("checkOfflineHotel - before the insert", () => {
  it("a live hotel (or none) needs no read", async () => {
    const { db, calls } = fakeDb({});
    expect(await checkOfflineHotel({ checkin: "2026-11-28" }, db)).toEqual({ result: "ok" });
    expect(await checkOfflineHotel(undefined, db)).toEqual({ result: "ok" });
    expect(calls).toEqual([]);
  });

  it("reads each block row once and passes a matching block", async () => {
    const { db, calls } = fakeDb({}, [block(7), block(9)]);
    expect(await checkOfflineHotel(own, db)).toEqual({ result: "ok" });
    expect(calls).toEqual(["readBlocks 7,9"]);
  });

  it("a block on other nights, or gone: mismatch", async () => {
    expect(await checkOfflineHotel(own, fakeDb({}, [block(7), block(9, "2026-11-26")]).db)).toMatchObject({ result: "mismatch" });
    expect(await checkOfflineHotel(own, fakeDb({}, [block(7)]).db)).toMatchObject({ result: "mismatch" });
  });

  it("a failed read is an error (the live route refuses the order then)", async () => {
    const failing = fakeDb({}, [], { readBlocks: async () => ({ data: null, error: { code: "57014", message: "timeout" } }) });
    expect(await checkOfflineHotel(own, failing.db)).toEqual({ result: "error", error: { code: "57014", message: "timeout" } });
    const throwing = fakeDb({}, [], {
      readBlocks: async () => {
        throw new Error("network");
      },
    });
    expect(await checkOfflineHotel(own, throwing.db)).toEqual({ result: "error", error: { message: "network" } });
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
