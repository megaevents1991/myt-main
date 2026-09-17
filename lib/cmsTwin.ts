import { unstable_cache } from "next/cache";
import { getAllCategories } from "@/lib/taxonomy";
import { getArtistBySlug } from "@/lib/artists";
import { getFootballTeamBySlug } from "@/lib/football";
import { slugPathOf } from "@/lib/taxonomy-tree";
import type { EventCategory } from "@/lib/taxonomy.types";

/**
 * CMS person (artist / football-team card) → its taxonomy-category URL.
 *
 * The /c/ tree is the canonical URL space (LEGACY-ROUTE migration,
 * 2026-08-14): catalog cards link straight to /c/..., and the legacy
 * /football/<id> + /artists/<id> routes 308 here when a twin exists.
 * Matching mirrors app/c/[...slug]/page.tsx's twin lookup: category
 * name_english or name vs the card's nameDBenglish / name.
 *
 * See docs/LEGACY-ROUTES-TODO.md for the full removal checklist.
 */

type PersonLike = {
  sys: { id: string };
  fields: { name?: unknown; nameDBenglish?: unknown };
};

const HUB_SLUG = { teams: "teams", artists: "artists" } as const;
export type PersonKind = keyof typeof HUB_SLUG;

function hrefFor(cat: EventCategory, all: EventCategory[]): string {
  return `/c/${slugPathOf(cat, all).join("/")}`;
}

function matchCategory(
  person: PersonLike,
  kind: PersonKind,
  all: EventCategory[],
  hubId: number | undefined,
): EventCategory | null {
  if (hubId == null) return null;
  const en = String(person.fields.nameDBenglish ?? "").trim().toLowerCase();
  const he = String(person.fields.name ?? "").trim().toLowerCase();
  return (
    all.find((c) => {
      if (c.parent_id !== hubId) return false;
      const catEn = (c.name_english ?? "").trim().toLowerCase();
      const catHe = c.name.trim().toLowerCase();
      return (en && (catEn === en || catHe === en)) || (he && catHe === he);
    }) ?? null
  );
}

/** sys.id → /c/ href for every person that has a live category twin. */
export async function buildPersonHrefIndex(
  kind: PersonKind,
  people: PersonLike[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const all = await getAllCategories();
    const hub = all.find((c) => c.slug === HUB_SLUG[kind]);
    for (const p of people) {
      const cat = matchCategory(p, kind, all, hub?.id);
      if (cat) map.set(p.sys.id, hrefFor(cat, all));
    }
  } catch (e) {
    console.error("buildPersonHrefIndex failed:", JSON.stringify(e));
  }
  return map;
}

/** /c/ href for one person, or null when no live category twin exists. */
export async function personCategoryHref(
  kind: PersonKind,
  person: PersonLike,
): Promise<string | null> {
  const index = await buildPersonHrefIndex(kind, [person]);
  return index.get(person.sys.id) ?? null;
}

/**
 * Legacy slug -> its /c/ twin URL, cached. The legacy /artists/<slug> and
 * /football/<slug> routes are force-dynamic (so the 308 is a real status code)
 * and crawlers still hit them thousands of times a day - uncached, each hit was
 * a person read + the whole categories table (2026-09-17 DB outage). Null when
 * the person is missing or has no twin; the page then falls back to its own
 * uncached path. Dropped with the rest of the catalog by revalidateTag("events").
 */
export const cachedLegacyTwinHref = unstable_cache(
  async (kind: PersonKind, slug: string): Promise<string | null> => {
    const person =
      kind === "artists"
        ? await getArtistBySlug(slug)
        : await getFootballTeamBySlug(slug);
    if (!person?.fields) return null;
    return personCategoryHref(kind, person);
  },
  ["legacy-twin-href"],
  { revalidate: 3600, tags: ["events"] },
);
