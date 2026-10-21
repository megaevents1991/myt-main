import { describe, expect, it, vi } from "vitest";

// eventsData builds the Supabase client at import time (no env in a unit test),
// so the client is stubbed - these tests touch the two pure predicates only.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { isListedEvent } from "../eventsData";
import { isHiddenForCheckout } from "../events/hidden";

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
