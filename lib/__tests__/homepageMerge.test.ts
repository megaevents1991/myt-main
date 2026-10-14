import { describe, expect, it } from "vitest";
import {
  defaultPinnable,
  defaultShowable,
  mergeRow,
  planHomepage,
  rowDefaultMax,
  type RowRef,
} from "@/lib/homepage/merge";

const ev = (n: number): RowRef => `event:${n}`;
const refs = (row: { cards: { ref: RowRef }[] }) => row.cards.map((c) => c.ref);

describe("mergeRow", () => {
  it("with no pins is the pool, capped at max", () => {
    const row = mergeRow([ev(1), ev(2), ev(3)], [], { max: 2 });
    expect(refs(row)).toEqual([ev(1), ev(2)]);
    expect(row.cards.every((c) => !c.pinned)).toBe(true);
  });

  it("keeps a pin in its slot and fills around it", () => {
    const row = mergeRow([ev(1), ev(2), ev(3), ev(4)], [{ ref: ev(9), slot: 2 }], { max: 5 });
    expect(refs(row)).toEqual([ev(1), ev(2), ev(9), ev(3), ev(4)]);
    expect(row.cards[2]).toEqual({ ref: ev(9), pinned: true });
  });

  it("an auto card that is pinned leaves the auto part", () => {
    const row = mergeRow([ev(1), ev(2), ev(3)], [{ ref: ev(3), slot: 0 }], {});
    expect(refs(row)).toEqual([ev(3), ev(1), ev(2)]);
  });

  it("closes pins up when the pool runs out before their slot", () => {
    const row = mergeRow([ev(1)], [{ ref: ev(7), slot: 5 }, { ref: ev(8), slot: 9 }], {});
    expect(refs(row)).toEqual([ev(1), ev(7), ev(8)]);
  });

  it("a pin that cannot be shown is reported and the pins after it close up", () => {
    const row = mergeRow([ev(1), ev(2), ev(3)], [{ ref: ev(5), slot: 0 }, { ref: ev(9), slot: 2 }], {
      showable: (r) => r !== ev(5),
    });
    // ev(9) held place 2 behind a dead pin - it moves up to place 1, as the
    // site always closed up a pinned list whose cards were gone.
    expect(refs(row)).toEqual([ev(1), ev(9), ev(2), ev(3)]);
    expect(row.deadPins).toEqual([ev(5)]);
  });

  it("a pin that may show but not be placed falls back to the rule's own place", () => {
    const row = mergeRow(["artist:a", "artist:b", "artist:c"], [{ ref: "artist:c", slot: 0 }], {
      pinnable: (r) => r !== "artist:c",
    });
    expect(refs(row)).toEqual(["artist:a", "artist:b", "artist:c"]);
    expect(row.deadPins).toEqual(["artist:c"]);
  });

  it("lanes interleave after pins, hidden and exclusions are taken out", () => {
    const row = mergeRow(
      { lanes: [["artist:a1", "artist:a2", "artist:a3"], ["team:t1", "team:t2"]] },
      [{ ref: "artist:a1", slot: 0 }],
      { hidden: ["team:t1"] },
    );
    expect(refs(row)).toEqual(["artist:a1", "artist:a2", "team:t2", "artist:a3"]);
  });

  it("hidden drops an auto card, but a pin beats hidden", () => {
    const hidden = mergeRow([ev(1), ev(2), ev(3)], [], { hidden: [ev(2)] });
    expect(refs(hidden)).toEqual([ev(1), ev(3)]);
    const pinned = mergeRow([ev(1), ev(2)], [{ ref: ev(2), slot: 0 }], { hidden: [ev(2)] });
    expect(refs(pinned)).toEqual([ev(2), ev(1)]);
  });

  it("exclude drops auto cards only, never a pin", () => {
    const row = mergeRow([ev(1), ev(2), ev(3)], [{ ref: ev(1), slot: 1 }], {
      exclude: new Set([ev(1), ev(2)]),
    });
    expect(refs(row)).toEqual([ev(3), ev(1)]);
  });

  it("pins past max are reported as off range", () => {
    const row = mergeRow([ev(1), ev(2), ev(3)], [{ ref: ev(9), slot: 7 }], { max: 2 });
    expect(refs(row)).toEqual([ev(1), ev(2)]);
    expect(row.offRange).toEqual([ev(9)]);
  });

  it("two pins on one slot: the first keeps it, the second takes the next", () => {
    const row = mergeRow([ev(1), ev(2)], [{ ref: ev(8), slot: 0 }, { ref: ev(9), slot: 0 }], {});
    expect(refs(row)).toEqual([ev(8), ev(9), ev(1), ev(2)]);
  });

  it("a ref pinned twice counts once; a pool duplicate counts once", () => {
    const row = mergeRow([ev(1), ev(1), ev(2)], [{ ref: ev(5), slot: 0 }, { ref: ev(5), slot: 3 }], {});
    expect(refs(row)).toEqual([ev(5), ev(1), ev(2)]);
  });

  it("max 0 shows nothing; null shows all", () => {
    expect(refs(mergeRow([ev(1)], [], { max: 0 }))).toEqual([]);
    expect(refs(mergeRow([ev(1), ev(2)], [], { max: null }))).toEqual([ev(1), ev(2)]);
  });
});

describe("planHomepage", () => {
  it("newest skips what most wanted shows, more events skips both", () => {
    const plan = planHomepage(
      [
        { key: "most_wanted", pins: [{ ref: ev(9), slot: 0 }], hidden: [], max: 2 },
        { key: "newest", pins: [], hidden: [], max: 2 },
        { key: "more_events", pins: [], hidden: [], max: null },
      ],
      {
        most_wanted: [ev(1), ev(2), ev(3)],
        newest: [ev(1), ev(9), ev(4), ev(5)],
        more_events: [ev(1), ev(4), ev(6)],
      },
    );
    expect(refs(plan.most_wanted)).toEqual([ev(9), ev(1)]);
    expect(refs(plan.newest)).toEqual([ev(4), ev(5)]);
    expect(refs(plan.more_events)).toEqual([ev(6)]);
  });

  it("a row with no layout row still gets its pool under the default max", () => {
    const pool = Array.from({ length: 20 }, (_, i) => ev(i + 1));
    const plan = planHomepage([], { newest: pool, blk_0000aaaa: pool });
    expect(plan.newest.cards).toHaveLength(12);
    expect(plan.blk_0000aaaa.cards).toHaveLength(12);
  });

  it("passes the row key to showable", () => {
    const seen: string[] = [];
    planHomepage(
      [{ key: "hero", pins: [{ ref: "artist:a", slot: 0 }], hidden: [], max: null }],
      { hero: ["team:t"] },
      (r, key) => {
        seen.push(`${key}|${r}`);
        return true;
      },
    );
    expect(seen).toContain("hero|artist:a");
    expect(seen).toContain("hero|team:t");
  });
});

describe("rowDefaultMax / defaultShowable", () => {
  it("event rows and sliders show 12, the rest all", () => {
    expect(rowDefaultMax("most_wanted")).toBe(12);
    expect(rowDefaultMax("newest")).toBe(12);
    expect(rowDefaultMax("blk_12345678")).toBe(12);
    expect(rowDefaultMax("hero")).toBeNull();
    expect(rowDefaultMax("football")).toBeNull();
    expect(rowDefaultMax("more_events")).toBeNull();
    expect(rowDefaultMax("reviews")).toBeNull();
  });

  it("events show unless sold out; people need to be on sale only in the hero", () => {
    expect(defaultShowable(undefined, "newest", "event:1")).toBe(false);
    expect(defaultShowable({ soldOut: true }, "newest", "event:1")).toBe(false);
    expect(defaultShowable({ soldOut: false }, "newest", "event:1")).toBe(true);
    expect(defaultShowable({ available: false }, "hero", "artist:a")).toBe(false);
    expect(defaultShowable({ available: false }, "artists", "artist:a")).toBe(true);
    expect(defaultShowable({}, "reviews", "review:k")).toBe(true);
  });

  it("only what is on sale may hold a pinned place; a review always may", () => {
    expect(defaultPinnable(undefined, "artists", "artist:a")).toBe(false);
    expect(defaultPinnable({ available: false }, "artists", "artist:a")).toBe(false);
    expect(defaultPinnable({ available: true }, "football", "team:t")).toBe(true);
    expect(defaultPinnable({ soldOut: true }, "newest", "event:1")).toBe(false);
    expect(defaultPinnable({ soldOut: false }, "newest", "event:1")).toBe(true);
    expect(defaultPinnable({}, "reviews", "review:k")).toBe(true);
  });
});
