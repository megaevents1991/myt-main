import { describe, it, expect } from "vitest";
import { buildSeatQuota, hasSeatsForEvent } from "../offlineSeatQuota";

describe("buildSeatQuota", () => {
  it("subtracts consumed seats from the allocation", () => {
    const quota = buildSeatQuota(
      [{ flight_id: 1, allocated_seats: 10 }],
      [{ flight_id: 1, consumed_seats: 4 }],
    );
    expect(quota.get(1)).toBe(6);
  });

  it("treats a flight with no consumption as fully available", () => {
    const quota = buildSeatQuota([{ flight_id: 2, allocated_seats: 8 }], []);
    expect(quota.get(2)).toBe(8);
  });

  it("omits flights that have no allocation row", () => {
    const quota = buildSeatQuota([], [{ flight_id: 3, consumed_seats: 2 }]);
    expect(quota.has(3)).toBe(false);
  });
});

describe("hasSeatsForEvent", () => {
  const quota = new Map<number, number>([
    [1, 2],
    [2, 0],
  ]);

  it("allows a party that fits the allocation", () => {
    expect(hasSeatsForEvent(quota, 1, 2)).toBe(true);
  });

  it("rejects a party larger than the allocation", () => {
    expect(hasSeatsForEvent(quota, 1, 3)).toBe(false);
  });

  it("rejects every party size once the allocation is exhausted", () => {
    expect(hasSeatsForEvent(quota, 2, 1)).toBe(false);
  });

  it("falls back to the global pool when the flight has no allocation", () => {
    expect(hasSeatsForEvent(quota, 99, 50)).toBe(true);
  });
});
