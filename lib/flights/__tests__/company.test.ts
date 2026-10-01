import { describe, expect, it } from "vitest";
import { MEGA_EVENTS_COMPANY_ID, isMegaEventsFlight } from "../company";

describe("isMegaEventsFlight", () => {
  it("accepts a Mega Events row", () => {
    expect(isMegaEventsFlight({ id: 4, company_id: MEGA_EVENTS_COMPANY_ID })).toBe(true);
  });

  it("accepts a row read before the company_id column exists", () => {
    expect(isMegaEventsFlight({ id: 4, consumed_quantity: 2 })).toBe(true);
    expect(isMegaEventsFlight({ id: 4, company_id: null })).toBe(true);
  });

  it("refuses a block of another company", () => {
    expect(isMegaEventsFlight({ id: 95, company_id: "b4e2d3c5-6c7f-4a81-9ba2-c3d4e5f6a702" })).toBe(false);
  });

  it("refuses a missing row", () => {
    expect(isMegaEventsFlight(null)).toBe(false);
    expect(isMegaEventsFlight(undefined)).toBe(false);
  });
});
