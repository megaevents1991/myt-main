import { describe, it, expect } from "vitest";
import {
  isLockedPackageSoldOut,
  lockedSeatsRemaining,
  type LockedFlightInventory,
} from "../lockedPackageSoldOut";

const flight = (
  overrides: Partial<LockedFlightInventory> = {},
): LockedFlightInventory => ({
  id: 30,
  initial_quantity: 16,
  consumed_quantity: 0,
  is_deleted: null,
  ...overrides,
});

describe("lockedSeatsRemaining", () => {
  it("does not constrain an unlocked event", () => {
    expect(lockedSeatsRemaining(null, undefined, undefined)).toBe(Infinity);
    expect(lockedSeatsRemaining(undefined, flight(), 0)).toBe(Infinity);
  });

  it("uses the flight pool when the event has no allocation", () => {
    expect(lockedSeatsRemaining(30, flight({ consumed_quantity: 12 }), undefined)).toBe(4);
  });

  it("takes the tighter of pool and allocation", () => {
    expect(lockedSeatsRemaining(30, flight({ consumed_quantity: 12 }), 9)).toBe(4);
    expect(lockedSeatsRemaining(30, flight({ consumed_quantity: 2 }), 3)).toBe(3);
  });

  it("never reports negative seats when the pool has overdrawn", () => {
    expect(lockedSeatsRemaining(30, flight({ consumed_quantity: 20 }), undefined)).toBe(0);
  });

  it("treats a missing or soft-deleted locked flight as nothing to sell", () => {
    expect(lockedSeatsRemaining(30, undefined, undefined)).toBe(0);
    expect(lockedSeatsRemaining(30, flight({ is_deleted: "08-02-2026" }), undefined)).toBe(0);
  });
});

describe("isLockedPackageSoldOut", () => {
  it("is sold out when the flight pool is exhausted", () => {
    // Flight 30 in production: 16 seats, 16 sold.
    expect(
      isLockedPackageSoldOut(30, flight({ consumed_quantity: 16 }), undefined),
    ).toBe(true);
  });

  it("is sold out when the event's own allocation is exhausted", () => {
    expect(isLockedPackageSoldOut(30, flight(), 0)).toBe(true);
  });

  it("is not sold out while a single seat remains", () => {
    expect(isLockedPackageSoldOut(30, flight({ consumed_quantity: 15 }), undefined)).toBe(false);
    expect(isLockedPackageSoldOut(30, flight(), 1)).toBe(false);
  });

  it("leaves unlocked events alone", () => {
    expect(isLockedPackageSoldOut(null, undefined, undefined)).toBe(false);
  });
});
