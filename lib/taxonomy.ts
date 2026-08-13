import { unstable_cache as nextCache } from "next/cache";

import { supabase } from "@/lib/supabase";
import type { Event } from "@/lib/app.types";
import type {
  EventCategory,
  EventCategoryNode,
  EventTag,
  TagType,
} from "@/lib/taxonomy.types";
import { buildTree, descendantIds, slugPathOf } from "@/lib/taxonomy-tree";
import { enrichEventsWithFallbackImages } from "@/lib/events/fallbackImage";
import { AVAILABILITY_WINDOW_DAYS, futureDateISO } from "@/lib/eventsData";

/**
 * Event taxonomy readers.
 *
 * ONE category table: `categories` - the card the backoffice team builds
 * (image, subtitle, blob art) which also carries the tree (`parent_id`) and
 * the tags that compose it. Events are never assigned to a category by hand;
 * they are tagged, and `event_category_links` is the VIEW that derives
 * membership from the category's tags.
 */

export async function getAllCategories(): Promise<EventCategory[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .eq("is_deleted", false)
    .order("display_order", { ascending: true });
  if (error) {
    console.error("getAllCategories failed:", JSON.stringify(error));
    return [];
  }
  return (data ?? []) as EventCategory[];
}

export async function getCategoryBySlug(
  slug: string,
): Promise<EventCategory | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .eq("is_deleted", false)
    .maybeSingle();
  if (error) {
    console.error("getCategoryBySlug failed:", JSON.stringify(error));
    return null;
  }
  return (data as EventCategory) ?? null;
}

/**
 * Events under a category node.
 *
 * A category is COMPOSED OF TAGS (backoffice: Templates → category form): every
 * event carrying one of its tags is pulled in, and that is the whole rule - so
 * a parent collects only what its own tags collect, and `includeDescendants`
 * defaults to FALSE. Roll "כדורגל" into "ספורט" by giving ספורט those tags, not
 * by nesting. Pass `includeDescendants: true` to walk the tree anyway.
 *
 * Same availability rules as the rest of the catalog: not deleted, at least
 * AVAILABILITY_WINDOW_DAYS in the future, soonest first.
 */
export async function getEventsInCategory(
  slug: string,
  opts: { includeDescendants?: boolean } = {},
): Promise<{ category: EventCategory | null; events: Event[] }> {
  const includeDescendants = opts.includeDescendants ?? false;
  const all = await getAllCategories();
  const category = all.find((c) => c.slug === slug) ?? null;
  if (!category) return { category: null, events: [] };

  const categoryIds = includeDescendants
    ? [category.id, ...descendantIds(buildTree(all), category.id)]
    : [category.id];

  const { data: links, error: linkErr } = await supabase
    .from("event_category_links")
    .select("event_id")
    .in("category_id", categoryIds);
  if (linkErr) {
    console.error("getEventsInCategory links failed:", JSON.stringify(linkErr));
    return { category, events: [] };
  }
  const eventIds = [...new Set((links ?? []).map((l) => l.event_id as number))];
  if (!eventIds.length) return { category, events: [] };

  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .in("id", eventIds)
    .is("is_deleted", null)
    .gte("date", futureDateISO(AVAILABILITY_WINDOW_DAYS))
    .order("date", { ascending: true });
  if (error) {
    console.error("getEventsInCategory events failed:", JSON.stringify(error));
    return { category, events: [] };
  }
  return {
    category,
    events: await enrichEventsWithFallbackImages(
      (events ?? []).filter((e) => !e.is_test),
    ),
  };
}

/* ---------- tags (product feed / promotions) ---------- */

export async function getAllTags(): Promise<EventTag[]> {
  const { data, error } = await supabase
    .from("event_tags")
    .select("*")
    .eq("is_active", true)
    .eq("is_deleted", false)
    .order("name", { ascending: true });
  if (error) {
    console.error("getAllTags failed:", JSON.stringify(error));
    return [];
  }
  return (data ?? []) as EventTag[];
}

/**
 * Categories for the site header.
 *
 * The header used to carry four hardcoded links, so the category tree the
 * backoffice builds was unreachable from anywhere but a homepage card.
 *
 * A node is kept when it (or any descendant) actually holds packages, so a
 * tag-less hub like יעדים survives purely to carry its children - "roots
 * only" would hide it while its grandchildren still have live packages. Full
 * tree (not just roots), no cap: roots are 3 by design now. Cached for an ISR
 * window and invalidated with the `events` tag like the rest of the
 * catalogue, since the root layout renders on every request.
 */
export type NavCategory = { href: string; label: string; children?: NavCategory[] };

export const getNavCategories = nextCache(
  async (): Promise<NavCategory[]> => {
    const all = await getAllCategories();
    if (!all.length) return [];

    const { data: links, error } = await supabase
      .from("event_category_links")
      .select("category_id")
      .in(
        "category_id",
        all.map((c) => c.id),
      );
    if (error) {
      console.error("getNavCategories links failed:", JSON.stringify(error));
      return [];
    }
    const counts = new Map<number, number>();
    (links ?? []).forEach((l) => {
      const id = l.category_id as number;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });

    const keep = (node: EventCategoryNode): NavCategory | null => {
      const children = node.children
        .map(keep)
        .filter((c): c is NavCategory => c !== null);
      const count = counts.get(node.id) ?? 0;
      if (count === 0 && children.length === 0) return null;
      return {
        href: `/c/${slugPathOf(node, all).join("/")}`,
        label: node.name,
        ...(children.length ? { children } : {}),
      };
    };
    return buildTree(all).map(keep).filter((c): c is NavCategory => c !== null);
  },
  ["nav-categories"],
  { tags: ["events"], revalidate: 3600 },
);

/**
 * Tag chips (name + type) per event, for the category page's typed facet
 * groups.
 *
 * Tags are what compose a category, so they are also the sharpest way to slice
 * it: "ליגה אנגלית" inside כדורגל. Only tags that are live are returned - a
 * retired tag must not linger as a filter chip. `type` falls back to "other"
 * when the column is unset (pre-migration data).
 */
export type EventTagChip = { name: string; type: TagType };

export async function getTagsForEvents(
  eventIds: number[],
): Promise<Record<number, EventTagChip[]>> {
  if (!eventIds.length) return {};

  const [linksRes, tagsRes] = await Promise.all([
    supabase
      .from("event_tag_links")
      .select("event_id,tag_id")
      .in("event_id", eventIds),
    supabase
      .from("event_tags")
      .select("id,name,type")
      .eq("is_active", true)
      .eq("is_deleted", false),
  ]);
  if (linksRes.error || tagsRes.error) {
    console.error(
      "getTagsForEvents failed:",
      JSON.stringify(linksRes.error ?? tagsRes.error),
    );
    return {};
  }

  const tagById = new Map<number, EventTagChip>(
    (tagsRes.data ?? []).map((t) => [
      t.id as number,
      { name: t.name as string, type: (t.type as TagType) ?? "other" },
    ]),
  );
  const byEvent: Record<number, EventTagChip[]> = {};
  (linksRes.data ?? []).forEach((l) => {
    const tag = tagById.get(l.tag_id as number);
    if (!tag) return;
    (byEvent[l.event_id as number] ??= []).push(tag);
  });
  return byEvent;
}
