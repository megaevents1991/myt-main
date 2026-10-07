import { describe, expect, it } from "vitest";
import { catalogPart, mergeCatalogParts } from "@/lib/events/catalogParts";

type Row = { id: number; date: string; name?: string };

const row = (id: number, date: string, name?: string): Row => ({ id, date, ...(name ? { name } : {}) });

/** A catalog shaped like the real one: ids scattered, many events on the same day. */
const catalog: Row[] = [
  row(566, "2026-10-10"), row(740, "2026-10-10"), row(923, "2026-10-10"), row(943, "2026-10-10"),
  row(641, "2026-10-11"), row(1146, "2026-10-12"), row(1147, "2026-10-12"), row(772, "2026-11-02"),
  row(1026, "2026-11-03"), row(1130, "2026-11-03"), row(1143, "2026-12-01"), row(9, "2027-01-15"),
];

const split = (rows: Row[], parts: number) =>
  Array.from({ length: parts }, (_, part) => catalogPart(rows, part, parts));

describe("catalogPart", () => {
  it("puts every event in exactly one part", () => {
    for (const parts of [1, 2, 3, 4, 7]) {
      const pieces = split(catalog, parts);
      const ids = pieces.flat().map((e) => e.id);
      expect(ids).toHaveLength(catalog.length);
      expect(new Set(ids).size).toBe(catalog.length);
    }
  });

  it("an event always lands in the same part, whatever else is in the catalog", () => {
    const alone = split([row(1146, "2026-10-12")], 4).findIndex((p) => p.length === 1);
    const among = split(catalog, 4).findIndex((p) => p.some((e) => e.id === 1146));
    expect(among).toBe(alone);
  });

  it("keeps the rows untouched and in the order it was given", () => {
    const [only] = split(catalog, 1);
    expect(only).toEqual(catalog);
  });

  it("an empty part is a part", () => {
    expect(catalogPart([row(4, "2026-10-10")], 1, 4)).toEqual([]);
  });
});

describe("mergeCatalogParts", () => {
  it("gives back the whole catalog, soonest first", () => {
    for (const parts of [1, 2, 4, 7]) {
      const merged = mergeCatalogParts(split(catalog, parts));
      expect(merged.map((e) => e.id).sort((a, b) => a - b)).toEqual(catalog.map((e) => e.id).sort((a, b) => a - b));
      for (let i = 1; i < merged.length; i++) {
        expect(merged[i - 1].date <= merged[i].date).toBe(true);
      }
    }
  });

  it("events of the same day come in one fixed order, however the database returned them", () => {
    const shuffled = [...catalog].reverse();
    const a = mergeCatalogParts(split(catalog, 4)).map((e) => e.id);
    const b = mergeCatalogParts(split(shuffled, 4)).map((e) => e.id);
    expect(b).toEqual(a);
    expect(a.slice(0, 4)).toEqual([566, 740, 923, 943]);
  });

  it("does not care how many parts there were", () => {
    const two = mergeCatalogParts(split(catalog, 2));
    const seven = mergeCatalogParts(split(catalog, 7));
    expect(seven).toEqual(two);
  });

  it("parts read at different moments never show an event twice or drop one", () => {
    // Part 2 (ids 566, 1026, 1130, 1146 - by id % 4) was refreshed later than the others:
    // by then event 1146 had been renamed and event 9998 added.
    const older = split(catalog, 4);
    const newer = split([...catalog.map((e) => (e.id === 1146 ? { ...e, name: "renamed" } : e)), row(9998, "2026-10-12")], 4);
    const mixed = older.map((piece, part) => (part === 2 ? newer[2] : piece));
    const merged = mergeCatalogParts(mixed);
    const ids = merged.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(merged.find((e) => e.id === 1146)?.name).toBe("renamed");
    expect(ids).toContain(9998);
    for (const e of catalog) expect(ids).toContain(e.id);
  });

  it("keeps one copy when an event somehow sits in two parts", () => {
    const merged = mergeCatalogParts([[row(5, "2026-10-10", "first")], [row(5, "2026-10-10", "second")]]);
    expect(merged).toEqual([row(5, "2026-10-10", "first")]);
  });

  it("nothing in, nothing out", () => {
    expect(mergeCatalogParts([[], [], []])).toEqual([]);
  });
});
