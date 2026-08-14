import { getAllCategories } from "@/lib/taxonomy";
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
