import { describe, expect, it } from "vitest";
import { blocksSingleOrderResume } from "../itinerary/groupGuard";

describe("blocksSingleOrderResume", () => {
  it("lets a regular order through when the column is unreadable (migration not applied)", () => {
    expect(
      blocksSingleOrderResume({
        data: null,
        error: { code: "42703", message: 'column "itinerary_group" does not exist' },
      }),
    ).toBe(false);
  });

  it("ignores any data that arrives together with an error", () => {
    expect(
      blocksSingleOrderResume({
        data: { itinerary_group: "5b0c7b8e-0000-4000-8000-000000000001" },
        error: new Error("boom"),
      }),
    ).toBe(false);
  });

  it("lets a row through when nothing came back", () => {
    expect(blocksSingleOrderResume({ data: null, error: null })).toBe(false);
    expect(blocksSingleOrderResume({})).toBe(false);
  });

  it("lets a regular order through when its group is empty", () => {
    expect(blocksSingleOrderResume({ data: { itinerary_group: null }, error: null })).toBe(false);
    expect(blocksSingleOrderResume({ data: {}, error: null })).toBe(false);
    expect(blocksSingleOrderResume({ data: { itinerary_group: "" }, error: null })).toBe(false);
  });

  it("blocks a grouped Euro Trip row", () => {
    expect(
      blocksSingleOrderResume({
        data: { itinerary_group: "5b0c7b8e-0000-4000-8000-000000000001" },
        error: null,
      }),
    ).toBe(true);
  });
});
