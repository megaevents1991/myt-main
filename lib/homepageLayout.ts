import { supabase } from "@/lib/supabase";

/**
 * Homepage layout - which sections the homepage shows, in what order, and the
 * items pinned to the front of each carousel. The backoffice /homepage board
 * writes `homepage_sections` + `homepage_items` (2026-09-16); this is the read
 * side. Keys mirror myt-backoffice `types/homepage.types.ts` - keep in sync.
 *
 * Server-only (service client). The homepage is ISR, so this runs once per
 * revalidation. Any failure falls back to the default order with everything
 * visible and nothing pinned - the page never breaks because of the board.
 */

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

export type HomepageSection = { key: HomepageSectionKey; visible: boolean };
export type HomepagePin = { kind: HomepageItemKind; ref_id: string };

export type HomepageLayout = {
  /** Site order, hero first, hidden sections included (visible=false). */
  sections: HomepageSection[];
  /** Pinned items per section in position order. */
  pins: Record<HomepageSectionKey, HomepagePin[]>;
};

/** The subset the client component needs: order/visibility + pinned event ids. */
export type HomepageClientLayout = {
  sections: HomepageSection[];
  pinnedEventIds: { most_wanted: number[]; newest: number[] };
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

export const DEFAULT_HOMEPAGE_LAYOUT: HomepageLayout = {
  sections: HOMEPAGE_SECTION_KEYS.map((key) => ({ key, visible: true })),
  pins: emptyPins(),
};

export async function getHomepageLayout(): Promise<HomepageLayout> {
  try {
    const [sectionsRes, itemsRes] = await Promise.all([
      supabase.from("homepage_sections").select("key,position,is_visible"),
      supabase
        .from("homepage_items")
        .select("section,kind,ref_id,position")
        .order("position", { ascending: true }),
    ]);
    if (sectionsRes.error) throw sectionsRes.error;
    if (itemsRes.error) throw itemsRes.error;

    type SectionRow = { key: string; position: number; is_visible: boolean };
    type ItemRow = { section: string; kind: HomepageItemKind; ref_id: string; position: number };

    const stored = ((sectionsRes.data ?? []) as SectionRow[])
      .filter((s) => isKey(s.key))
      .sort((a, b) => a.position - b.position);
    const seen = new Set(stored.map((s) => s.key));
    const sections: HomepageSection[] = stored.map((s) => ({
      key: s.key as HomepageSectionKey,
      visible: s.is_visible !== false,
    }));
    // Keys the table lacks (a section added in code before staff saved the
    // board) are appended in the default order, visible.
    for (const key of HOMEPAGE_SECTION_KEYS) {
      if (!seen.has(key)) sections.push({ key, visible: true });
    }
    // Hero is always first whatever the row says.
    sections.sort((a, b) => (a.key === "hero" ? -1 : b.key === "hero" ? 1 : 0));

    const pins = emptyPins();
    for (const it of (itemsRes.data ?? []) as ItemRow[]) {
      if (!isKey(it.section)) continue;
      pins[it.section].push({ kind: it.kind, ref_id: String(it.ref_id) });
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

export function toClientLayout(layout: HomepageLayout): HomepageClientLayout {
  const ids = (key: "most_wanted" | "newest") =>
    layout.pins[key]
      .filter((p) => p.kind === "event")
      .map((p) => Number(p.ref_id))
      .filter((n) => Number.isFinite(n));
  return {
    sections: layout.sections,
    pinnedEventIds: { most_wanted: ids("most_wanted"), newest: ids("newest") },
  };
}
