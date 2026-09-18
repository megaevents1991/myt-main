import { supabase } from "@/lib/supabase";
import { getEventIdsByCategories } from "@/lib/taxonomy";

/**
 * Homepage layout - which sections the homepage shows, in what order, under
 * what title, the items pinned to the front of each carousel, and the blocks
 * staff added themselves. The backoffice /homepage board writes
 * `homepage_sections` + `homepage_items`; this is the read side. Keys, block
 * types and config shapes mirror myt-backoffice `types/homepage.types.ts` -
 * keep in sync.
 *
 * Server-only (service client). The homepage is ISR, so this runs once per
 * revalidation. Any failure falls back to the default order with everything
 * visible and nothing pinned - the page never breaks because of the board. A
 * row this build does not understand (unknown key, unknown block type, a config
 * that does not parse) is skipped, never rendered half-way.
 */

/** The sections coded here ("builtin"). */
export const HOMEPAGE_SECTION_KEYS = [
  "hero",
  "most_wanted",
  "newest",
  "football",
  "artists",
  "reviews",
  "more_events",
] as const;
export type HomepageSectionKey = (typeof HOMEPAGE_SECTION_KEYS)[number];
export type HomepageItemKind = "event" | "artist" | "team";

/** Blocks staff add from the board (2026-09-18). Text / destinations / gallery come later. */
export const HOMEPAGE_BLOCK_TYPES = ["event_slider", "banner"] as const;
export type HomepageBlockType = (typeof HOMEPAGE_BLOCK_TYPES)[number];

const HOMEPAGE_PAGE = "home";

export type HomepageBanner = { image_url: string; link_url: string | null; title: string | null };

type SectionBase = {
  /** A builtin key, or `blk_xxxxxxxx` for a block. */
  key: string;
  /** Staff title; null = the title coded here (builtin) / no heading (block). */
  title: string | null;
  visible: boolean;
};
export type HomepageSection =
  | (SectionBase & { type: "builtin"; key: HomepageSectionKey })
  /** Pinned events first, then the category's events (null = pinned only). */
  | (SectionBase & { type: "event_slider"; categoryId: number | null })
  | (SectionBase & { type: "banner"; banners: HomepageBanner[] });

export type HomepagePin = { kind: HomepageItemKind; ref_id: string };

export type HomepageLayout = {
  /** Site order, hero first, hidden sections included (visible=false). */
  sections: HomepageSection[];
  /** Pinned items per section key in position order. Builtin keys are always present. */
  pins: Record<string, HomepagePin[]>;
};

/** Per event_slider block: pinned event ids (board order) + the category's ids (soonest first). */
export type HomepageBlockEvents = Record<string, { pinned: number[]; auto: number[] }>;

/** The subset the client component needs. */
export type HomepageClientLayout = {
  sections: HomepageSection[];
  pinnedEventIds: { most_wanted: number[]; newest: number[] };
  blockEvents: HomepageBlockEvents;
};

const isKey = (k: string): k is HomepageSectionKey =>
  (HOMEPAGE_SECTION_KEYS as readonly string[]).includes(k);

const emptyPins = (): HomepageLayout["pins"] => ({
  hero: [],
  most_wanted: [],
  newest: [],
  football: [],
  artists: [],
  reviews: [],
  more_events: [],
});

const builtin = (key: HomepageSectionKey, visible = true, title: string | null = null): HomepageSection => ({
  key,
  type: "builtin",
  title,
  visible,
});

export const DEFAULT_HOMEPAGE_LAYOUT: HomepageLayout = {
  sections: HOMEPAGE_SECTION_KEYS.map((key) => builtin(key)),
  pins: emptyPins(),
};

type SectionRow = {
  key: string;
  position: number;
  is_visible: boolean;
  page?: string | null;
  type?: string | null;
  title?: string | null;
  config?: unknown;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const cleanTitle = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/** A stored row → a section, or null when this build cannot render it. */
function toSection(row: SectionRow): HomepageSection | null {
  const type = row.type ?? "builtin";
  const base = { title: cleanTitle(row.title), visible: row.is_visible !== false };
  if (type === "builtin") {
    return isKey(row.key) ? { ...base, key: row.key, type: "builtin" } : null;
  }
  const config = isRecord(row.config) ? row.config : {};
  if (type === "event_slider") {
    const id = Number(config.category_id);
    return {
      ...base,
      key: row.key,
      type: "event_slider",
      categoryId: Number.isInteger(id) && id > 0 ? id : null,
    };
  }
  if (type === "banner") {
    const banners: HomepageBanner[] = [];
    for (const b of Array.isArray(config.banners) ? config.banners : []) {
      if (!isRecord(b) || typeof b.image_url !== "string" || !b.image_url) continue;
      banners.push({
        image_url: b.image_url,
        link_url: typeof b.link_url === "string" && b.link_url ? b.link_url : null,
        title: cleanTitle(b.title),
      });
    }
    return banners.length ? { ...base, key: row.key, type: "banner", banners } : null;
  }
  return null;
}

// "column does not exist" - the blocks migration (backoffice
// 20260918120000_homepage_blocks.sql) has not reached this database yet.
const isMissingColumn = (e: { code?: string; message?: string }) =>
  e.code === "42703" || e.code === "PGRST204" || /column .* does not exist/i.test(e.message ?? "");

async function readSectionRows(): Promise<SectionRow[]> {
  const full = await supabase
    .from("homepage_sections")
    .select("key,position,is_visible,page,type,title,config");
  if (!full.error) return (full.data ?? []) as SectionRow[];
  if (!isMissingColumn(full.error)) throw full.error;
  // Deployed ahead of the migration: keep the saved order, without titles/blocks.
  const legacy = await supabase.from("homepage_sections").select("key,position,is_visible");
  if (legacy.error) throw legacy.error;
  return (legacy.data ?? []) as SectionRow[];
}

export async function getHomepageLayout(): Promise<HomepageLayout> {
  try {
    const [rows, itemsRes] = await Promise.all([
      readSectionRows(),
      supabase
        .from("homepage_items")
        .select("section,kind,ref_id,position")
        .order("position", { ascending: true }),
    ]);
    if (itemsRes.error) throw itemsRes.error;

    type ItemRow = { section: string; kind: HomepageItemKind; ref_id: string; position: number };

    const sections: HomepageSection[] = [];
    const seen = new Set<string>();
    for (const row of [...rows].sort((a, b) => a.position - b.position)) {
      if ((row.page ?? HOMEPAGE_PAGE) !== HOMEPAGE_PAGE || seen.has(row.key)) continue;
      const section = toSection(row);
      if (!section) continue;
      seen.add(section.key);
      sections.push(section);
    }
    // Keys the table lacks (a section added in code before staff saved the
    // board) are appended in the default order, visible.
    for (const key of HOMEPAGE_SECTION_KEYS) {
      if (!seen.has(key)) sections.push(builtin(key));
    }
    // Hero is always first whatever the row says.
    sections.sort((a, b) => (a.key === "hero" ? -1 : b.key === "hero" ? 1 : 0));

    const pins = emptyPins();
    for (const it of (itemsRes.data ?? []) as ItemRow[]) {
      if (!isKey(it.section) && !seen.has(it.section)) continue;
      (pins[it.section] ??= []).push({ kind: it.kind, ref_id: String(it.ref_id) });
    }
    return { sections, pins };
  } catch (error) {
    console.error("[homepageLayout] falling back to defaults:", error);
    return {
      sections: DEFAULT_HOMEPAGE_LAYOUT.sections.map((s) => ({ ...s })),
      pins: emptyPins(),
    };
  }
}

/** `ref_id` → index for one kind of a section's pins (lower = earlier). */
export function pinRank(
  pins: HomepagePin[],
  kind: HomepageItemKind,
): Map<string, number> {
  const m = new Map<string, number>();
  pins.forEach((p, i) => {
    if (p.kind === kind && !m.has(p.ref_id)) m.set(p.ref_id, i);
  });
  return m;
}

/**
 * Pinned entries first in pin order, then the rest in their incoming order.
 * Stable, so a list that arrives name-sorted stays name-sorted after the pins.
 */
export function pinnedFirst<T>(
  list: T[],
  rank: Map<string, number>,
  keyOf: (item: T) => string,
): T[] {
  const withIdx = list.map((item, i) => ({ item, i, r: rank.get(keyOf(item)) }));
  withIdx.sort((a, b) => {
    const ra = a.r ?? Number.MAX_SAFE_INTEGER;
    const rb = b.r ?? Number.MAX_SAFE_INTEGER;
    return ra - rb || a.i - b.i;
  });
  return withIdx.map((x) => x.item);
}

/** Category events handed to the client per slider - it shows 12 of them at most. */
const BLOCK_AUTO_POOL = 60;

const pinnedEventIds = (pins: HomepagePin[] | undefined): number[] =>
  (pins ?? [])
    .filter((p) => p.kind === "event")
    .map((p) => Number(p.ref_id))
    .filter((n) => Number.isFinite(n));

/**
 * The events behind every visible event slider: its pins, plus - when it names
 * a category - that category's events from the homepage's own pool, soonest
 * first. One `event_category_links` read for all sliders; if it fails the
 * sliders keep their pins (getEventIdsByCategories logs and returns empty).
 * The client trims to one row and collapses several dates of one artist.
 */
export async function resolveBlockEvents(
  layout: HomepageLayout,
  events: { id: number; date: string }[],
): Promise<HomepageBlockEvents> {
  const sliders = layout.sections.flatMap((s) =>
    s.type === "event_slider" && s.visible ? [s] : [],
  );
  if (!sliders.length) return {};

  const categoryIds = [...new Set(sliders.flatMap((s) => (s.categoryId ? [s.categoryId] : [])))];
  const byCategory = await getEventIdsByCategories(categoryIds);
  const byDate = [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const out: HomepageBlockEvents = {};
  for (const s of sliders) {
    const members = s.categoryId ? byCategory.get(s.categoryId) : undefined;
    out[s.key] = {
      pinned: pinnedEventIds(layout.pins[s.key]),
      // Far more than one row needs, so the client can still fill it after it
      // drops sold-out events and collapses an artist's dates into one card.
      auto: members
        ? byDate
            .filter((e) => members.has(e.id))
            .slice(0, BLOCK_AUTO_POOL)
            .map((e) => e.id)
        : [],
    };
  }
  return out;
}

export function toClientLayout(
  layout: HomepageLayout,
  blockEvents: HomepageBlockEvents = {},
): HomepageClientLayout {
  return {
    sections: layout.sections,
    pinnedEventIds: {
      most_wanted: pinnedEventIds(layout.pins.most_wanted),
      newest: pinnedEventIds(layout.pins.newest),
    },
    blockEvents,
  };
}
