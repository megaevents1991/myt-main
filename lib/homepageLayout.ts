import { supabase } from "@/lib/supabase";
import { getAllCategories, getEventIdsByCategories } from "@/lib/taxonomy";
import { slugPathOf } from "@/lib/taxonomy-tree";
import { ROW_MAX_LIMIT, toRef, type RowLayout, type RowRef } from "@/lib/homepage/merge";
import { EURO_TRIP_SECTION_KEY } from "@/lib/itinerary/settings";

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

/**
 * The sections coded here ("builtin"). `euro_trip` (2026-10-28) is the way into "Build Your Euro
 * Trip" AND the feature's switch: lib/itinerary/settings.server.ts opens the /euro-trip pages only
 * while this row is shown. It carries no cards.
 */
export const HOMEPAGE_SECTION_KEYS = [
  "hero",
  "most_wanted",
  "newest",
  "football",
  "artists",
  "reviews",
  "more_events",
  "euro_trip",
] as const;
export type HomepageSectionKey = (typeof HOMEPAGE_SECTION_KEYS)[number];
export type HomepageItemKind = "event" | "artist" | "team" | "review";

/** Blocks staff add from the board (2026-09-18); text / destinations / gallery since 2026-09-19. */
export const HOMEPAGE_BLOCK_TYPES = ["event_slider", "banner", "text", "destinations", "gallery"] as const;
export type HomepageBlockType = (typeof HOMEPAGE_BLOCK_TYPES)[number];

const HOMEPAGE_PAGE = "home";

export type HomepageBanner = { image_url: string; link_url: string | null; title: string | null };
export type HomepageGalleryImage = { image_url: string; alt: string | null };
/** One tile of a destinations slider - the shape HubTilesRow draws. */
export type HomepageTile = {
  id: number;
  name: string;
  href: string;
  imageUrl: string | null;
  images?: string[];
};

type SectionBase = {
  /** A builtin key, or `blk_xxxxxxxx` for a block. */
  key: string;
  /** Staff title; null = the title coded here (builtin) / no heading (block). */
  title: string | null;
  visible: boolean;
  /** Cards staff removed from THIS row ("event:812", "team:liverpool", ...). A pin beats it. */
  hidden: RowRef[];
  /** How many cards the row shows; null = the row's default (lib/homepage/merge rowDefaultMax). */
  maxItems: number | null;
};
export type HomepageSection =
  | (SectionBase & { type: "builtin"; key: HomepageSectionKey })
  /** Pinned events first, then the category's events (null = pinned only). */
  | (SectionBase & { type: "event_slider"; categoryId: number | null })
  | (SectionBase & { type: "banner"; banners: HomepageBanner[] })
  /** Plain paragraphs (never HTML) under the block's title. */
  | (SectionBase & { type: "text"; paragraphs: string[] })
  /** Category tiles: the chosen ones first, then the parent's active children. */
  | (SectionBase & { type: "destinations"; categoryIds: number[]; parentId: number | null })
  | (SectionBase & { type: "gallery"; images: HomepageGalleryImage[] });

/** A pinned card; `slot` = the place it holds in its row (0 = first). */
export type HomepagePin = { kind: HomepageItemKind; ref_id: string; slot: number };

export type HomepageLayout = {
  /** Site order, hero first, hidden sections included (visible=false). */
  sections: HomepageSection[];
  /** Pinned items per section key in slot order. Builtin keys are always present. */
  pins: Record<string, HomepagePin[]>;
};

/** Per visible event_slider block that names a category: that category's event ids. */
export type HomepageSliderMembers = Record<string, Set<number>>;

/** Per destinations block: its tiles in display order. */
export type HomepageBlockTiles = Record<string, HomepageTile[]>;

/** The subset the client component needs. */
export type HomepageClientLayout = {
  sections: HomepageSection[];
  /**
   * The event ids each event row shows, in order - "most_wanted", "newest",
   * "more_events" and every event slider by its block key. Built on the server
   * (lib/homepage/rows + merge); the client only maps them to its events.
   */
  rows: Record<string, number[]>;
  blockTiles: HomepageBlockTiles;
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
  euro_trip: [],
});

/**
 * Is a builtin the table has no row for shown? Every one is, except the Euro Trip: a missing row is
 * "off" (the same rule as euroTripSwitchOn), or the entry would appear before anyone switched it on.
 */
const visibleByDefault = (key: HomepageSectionKey): boolean => key !== EURO_TRIP_SECTION_KEY;

const builtin = (
  key: HomepageSectionKey,
  visible = visibleByDefault(key),
  title: string | null = null,
): HomepageSection => ({
  key,
  type: "builtin",
  title,
  visible,
  hidden: [],
  maxItems: null,
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

/** A jsonb list → its positive integer ids, deduped, order kept; junk dropped. */
const positiveIds = (v: unknown): number[] => {
  const out: number[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    const n = Number(x);
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
};

const REF_RE = /^(event|artist|team|review):\S{1,200}$/;
const HIDDEN_MAX = 300;

/**
 * A row's hidden cards: `config.hidden` ("kind:id" strings), plus the older
 * `hidden_event_ids` "החדשים ביותר" stored before every row could hide
 * (2026-10-14) - read as event refs so either form works.
 */
const hiddenRefs = (config: Record<string, unknown>): RowRef[] => {
  const out: RowRef[] = [];
  for (const v of Array.isArray(config.hidden) ? config.hidden : []) {
    if (typeof v === "string" && REF_RE.test(v) && !out.includes(v)) out.push(v);
  }
  for (const id of positiveIds(config.hidden_event_ids)) {
    const ref = toRef("event", id);
    if (!out.includes(ref)) out.push(ref);
  }
  return out.slice(-HIDDEN_MAX);
};

/** `config.max_items` - a whole number 1..ROW_MAX_LIMIT, else null (the row's default). */
const maxItemsOf = (config: Record<string, unknown>): number | null => {
  const n = Number(config.max_items);
  return Number.isInteger(n) && n >= 1 && n <= ROW_MAX_LIMIT ? n : null;
};

/** A stored row → a section, or null when this build cannot render it. */
function toSection(row: SectionRow): HomepageSection | null {
  const type = row.type ?? "builtin";
  const config = isRecord(row.config) ? row.config : {};
  const base = {
    title: cleanTitle(row.title),
    visible: row.is_visible !== false,
    hidden: hiddenRefs(config),
    maxItems: maxItemsOf(config),
  };
  if (type === "builtin") {
    return isKey(row.key) ? { ...base, key: row.key, type: "builtin" } : null;
  }
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
  if (type === "text") {
    const paragraphs =
      typeof config.body === "string"
        ? config.body
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
        : [];
    return paragraphs.length ? { ...base, key: row.key, type: "text", paragraphs } : null;
  }
  if (type === "destinations") {
    const categoryIds = positiveIds(config.category_ids);
    const parent = Number(config.parent_id);
    const parentId = Number.isInteger(parent) && parent > 0 ? parent : null;
    return categoryIds.length || parentId
      ? { ...base, key: row.key, type: "destinations", categoryIds, parentId }
      : null;
  }
  if (type === "gallery") {
    const images: HomepageGalleryImage[] = [];
    for (const g of Array.isArray(config.images) ? config.images : []) {
      if (!isRecord(g) || typeof g.image_url !== "string" || !g.image_url) continue;
      images.push({ image_url: g.image_url, alt: cleanTitle(g.alt) });
    }
    return images.length ? { ...base, key: row.key, type: "gallery", images } : null;
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
    // board) are appended in the default order - visible, except the Euro Trip.
    for (const key of HOMEPAGE_SECTION_KEYS) {
      if (!seen.has(key)) sections.push(builtin(key));
    }
    // Hero is always first whatever the row says.
    sections.sort((a, b) => (a.key === "hero" ? -1 : b.key === "hero" ? 1 : 0));

    // `position` is the card's place in its row (pins saved before 2026-10-14
    // are 0..n-1, which reads the same).
    const pins = emptyPins();
    for (const it of (itemsRes.data ?? []) as ItemRow[]) {
      if (!isKey(it.section) && !seen.has(it.section)) continue;
      const slot = Number(it.position);
      (pins[it.section] ??= []).push({
        kind: it.kind,
        ref_id: String(it.ref_id),
        slot: Number.isFinite(slot) && slot >= 0 ? Math.floor(slot) : 0,
      });
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

/**
 * The category behind every visible event slider: its event ids (the slider's
 * automatic pool is built from them by lib/homepage/rows `sliderPool`). One
 * `event_category_links` read for all sliders; if it fails the sliders keep
 * their pins (getEventIdsByCategories logs and returns empty).
 */
export async function resolveSliderMembers(layout: HomepageLayout): Promise<HomepageSliderMembers> {
  const sliders = layout.sections.flatMap((s) =>
    s.type === "event_slider" && s.visible && s.categoryId ? [s] : [],
  );
  if (!sliders.length) return {};
  const byCategory = await getEventIdsByCategories([
    ...new Set(sliders.map((s) => s.categoryId as number)),
  ]);
  const out: HomepageSliderMembers = {};
  for (const s of sliders) {
    const members = byCategory.get(s.categoryId as number);
    if (members) out[s.key] = members;
  }
  return out;
}

/** Each row's settings in the shape lib/homepage/merge reads. */
export function rowLayouts(layout: HomepageLayout): RowLayout[] {
  return layout.sections.map((s) => ({
    key: s.key,
    pins: (layout.pins[s.key] ?? []).map((p) => ({ ref: toRef(p.kind, p.ref_id), slot: p.slot })),
    hidden: s.hidden,
    max: s.maxItems,
  }));
}

/** Tiles per destinations slider - a ceiling for one scroll row, not a target. */
const BLOCK_TILES_MAX = 24;

/**
 * The tiles behind every visible destinations slider: the categories staff
 * chose in board order, then the active children of the parent it names (in
 * their own display order). One `categories` read for all of them; a category
 * that was switched off since simply drops out. If the read fails
 * (getAllCategories logs and returns empty) the blocks render nothing.
 */
export async function resolveBlockTiles(layout: HomepageLayout): Promise<HomepageBlockTiles> {
  const blocks = layout.sections.flatMap((s) =>
    s.type === "destinations" && s.visible ? [s] : [],
  );
  if (!blocks.length) return {};

  const all = await getAllCategories();
  const byId = new Map(all.map((c) => [c.id, c]));
  const out: HomepageBlockTiles = {};
  for (const s of blocks) {
    const chosen = s.categoryIds.flatMap((id) => byId.get(id) ?? []);
    const chosenIds = new Set(chosen.map((c) => c.id));
    const children = s.parentId
      ? all.filter((c) => c.parent_id === s.parentId && !chosenIds.has(c.id))
      : [];
    out[s.key] = [...chosen, ...children].slice(0, BLOCK_TILES_MAX).map((c) => ({
      id: c.id,
      name: c.name,
      href: `/c/${slugPathOf(c, all).join("/")}`,
      imageUrl: c.image_url,
      images: c.page_content?.tile_images ?? undefined,
    }));
  }
  return out;
}

export function toClientLayout(
  layout: HomepageLayout,
  rows: Record<string, number[]> = {},
  blockTiles: HomepageBlockTiles = {},
): HomepageClientLayout {
  return { sections: layout.sections, rows, blockTiles };
}
