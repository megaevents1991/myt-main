import { describe, expect, it, vi } from "vitest";

// hubEvents imports the data readers, which build the Supabase client at import
// time; these tests touch the two pure functions only.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { emptyLeafIds, matchCmsTwin } from "../hubEvents";
import type { EventCategory } from "../taxonomy.types";
import type { FootballTeam } from "../app.types";

const cat = (id: number, slug: string, name: string, parent_id: number | null, name_english: string | null = null) =>
  ({ id, slug, name, name_english, parent_id }) as EventCategory;
const person = (name: string, nameDBenglish: string) =>
  ({ sys: { id: nameDBenglish }, fields: { name, nameDBenglish } }) as FootballTeam;

const all = [
  cat(1, "music", "הופעות מוזיקה", null),
  cat(2, "artists", "אמנים", 1),
  cat(3, "oasis", "אואזיס", 2, "Oasis"),
  cat(4, "coldplay", "קולדפליי", 2, "Coldplay"),
  cat(5, "destinations", "יעדים", null),
  cat(6, "london", "לונדון", 5),
  cat(7, "paris", "פריז", 5),
];
const artists = [person("אואזיס", "Oasis"), person("קולדפליי", "Coldplay")];
const catalog = [
  { id: 100, name_english: "Oasis - Manchester" },
  { id: 101, name_english: "Arsenal vs Chelsea" },
];
const links = new Map([[6, new Set([101, 999])]]); // 999 = not on sale

describe("matchCmsTwin", () => {
  it("finds the template by English name, then by Hebrew name", () => {
    expect(matchCmsTwin(all[2], artists)?.fields.nameDBenglish).toBe("Oasis");
    expect(matchCmsTwin(cat(9, "x", "קולדפליי", 2), artists)?.fields.nameDBenglish).toBe("Coldplay");
  });

  it("ignores a template without both names, as the page does", () => {
    expect(matchCmsTwin(all[2], [{ sys: { id: "o" }, fields: { name: "אואזיס" } } as FootballTeam])).toBeNull();
  });
});

describe("emptyLeafIds", () => {
  it("marks a leaf whose page would list nothing", () => {
    const empty = emptyLeafIds({ all, catalog, links, teams: [], artists });
    // coldplay: template, no event by name; paris: no tagged event on sale.
    expect([...empty].sort()).toEqual([4, 7]);
  });

  it("never marks a hub that draws child tiles", () => {
    const empty = emptyLeafIds({ all, catalog, links: new Map(), teams: [], artists });
    expect(empty.has(1)).toBe(false);
    expect(empty.has(2)).toBe(false);
    expect(empty.has(5)).toBe(false);
  });

  it("counts a template leaf by name, not by tags", () => {
    expect(emptyLeafIds({ all, catalog, links, teams: [], artists }).has(3)).toBe(false);
  });

  it("marks nothing it could not read", () => {
    expect(emptyLeafIds({ all, catalog: [], links, teams: [], artists }).size).toBe(0);
    // links unread: tag-counted leaves are unknown; template leaves still count.
    expect([...emptyLeafIds({ all, catalog, links: null, teams: [], artists })]).toEqual([4]);
    // artists unread: their leaves are unknown.
    expect([...emptyLeafIds({ all, catalog, links, teams: [], artists: [] })]).toEqual([7]);
  });
});
