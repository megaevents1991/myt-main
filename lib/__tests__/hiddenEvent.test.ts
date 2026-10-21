import { describe, expect, it, vi } from "vitest";

// eventsData builds the Supabase client at import time (no env in a unit test),
// so the client is stubbed - these tests touch the two pure predicates only.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { isListedEvent } from "../eventsData";
import { isHiddenForCheckout } from "../events/hidden";
import { listedEventIds } from "../taxonomy";

describe("isListedEvent", () => {
  it("lists an ordinary event", () => {
    expect(
      isListedEvent({ is_test: false, deactivated_reason: null, is_hidden: false }),
    ).toBe(true);
  });

  it("lists an event from before the is_hidden column existed", () => {
    expect(isListedEvent({ is_test: false, deactivated_reason: null })).toBe(true);
    expect(
      isListedEvent({ is_test: undefined, deactivated_reason: undefined, is_hidden: undefined }),
    ).toBe(true);
  });

  it("drops an event the uploader built that staff have not approved yet", () => {
    expect(
      isListedEvent({ is_test: false, deactivated_reason: null, is_hidden: true }),
    ).toBe(false);
  });

  it("answers hidden exactly as isHiddenForCheckout does (one predicate)", () => {
    for (const is_hidden of [true, false, undefined]) {
      const row = { is_test: false, deactivated_reason: null, is_hidden };
      expect(isListedEvent(row)).toBe(!isHiddenForCheckout(row));
    }
  });

  it("still drops test and deactivated events", () => {
    expect(
      isListedEvent({ is_test: true, deactivated_reason: null, is_hidden: false }),
    ).toBe(false);
    expect(
      isListedEvent({ is_test: false, deactivated_reason: "tx_sold_out", is_hidden: false }),
    ).toBe(false);
  });
});

describe("isHiddenForCheckout", () => {
  it("is true for a hidden event", () => {
    expect(isHiddenForCheckout({ is_hidden: true })).toBe(true);
  });

  it("is false for a visible event, or one without the flag", () => {
    expect(isHiddenForCheckout({ is_hidden: false })).toBe(false);
    expect(isHiddenForCheckout({})).toBe(false);
    expect(isHiddenForCheckout({ is_hidden: undefined })).toBe(false);
  });
});

describe("listedEventIds (what the header nav counts)", () => {
  it("leaves out hidden, test and deactivated events, keeps the rest", () => {
    const base = { is_test: false, deactivated_reason: null, is_hidden: false };
    const ids = listedEventIds([
      { id: 1, ...base },
      { id: 2, ...base, is_hidden: true },
      { id: 3, ...base, is_test: true },
      { id: 4, ...base, deactivated_reason: "tx_sold_out" },
      { id: 5, is_test: false, deactivated_reason: null }, // row from before the column
    ]);
    expect([...ids].sort()).toEqual([1, 5]);
  });

  it("a hub whose only events are hidden counts nothing", () => {
    expect(
      listedEventIds([{ id: 9, is_test: false, deactivated_reason: null, is_hidden: true }]).size,
    ).toBe(0);
  });
});
