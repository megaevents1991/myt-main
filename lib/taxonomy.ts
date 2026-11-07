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
import {
  AVAILABILITY_WINDOW_DAYS,
  futureDateISO,
  isListedEvent,
  stripBackofficeOnlyColumns,
} from "@/lib/eventsData";

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
 * AVAILABILITY_WINDOW_DAYS in the future, soonest first. `failed` = a read failed, so the
 * empty list says nothing about the category (it is not "no events").
 */
export async function getEventsInCategory(
  slug: string,
  opts: { includeDescendants?: boolean } = {},
): Promise<{ category: EventCategory | null; events: Event[]; failed?: true }> {
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
    return { category, events: [], failed: true };
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
    return { category, events: [], failed: true };
  }
  // The rows go into the page as they are, so the backoffice's own columns come off first
  // (until 2026-10-07 every category page carried light_detail - competitor prices and our
  // net costs - in its source).
  return {
    category,
    events: await enrichEventsWithFallbackImages(
      stripBackofficeOnlyColumns((events ?? []).filter(isListedEvent)),
    ),
  };
}

/**
 * Event-id membership of ONE category by slug - the light "does this event
 * belong to X" check (e.g. the team page's ליגת האלופות tab). Only the link
 * rows are fetched, never the event rows.
 */
export async function getCategoryEventIdSet(slug: string): Promise<Set<number>> {
  const category = await getCategoryBySlug(slug);
  if (!category) return new Set();
  const map = await getEventIdsByCategories([category.id]);
  return map.get(category.id) ?? new Set();
}

export type CategoryLink = { category_id: number; event_id: number };

export const CATEGORY_LINKS_PAGE = 1000;

/**
 * Every event_category_links row of these categories, read in pages. One select
 * stops at PostgREST's 1,000-row cap without a word, and the whole tree holds
 * ~3,500 links (2026-11-07): the header menu saw a random 1,000 of them and
 * dropped 10 of its 70 live categories, different ones each hour. The fixed
 * order keeps the pages from overlapping. Null when any page fails.
 */
export async function readCategoryLinks(categoryIds: number[]): Promise<CategoryLink[] | null> {
  if (!categoryIds.length) return [];
  const rows: CategoryLink[] = [];
  for (let from = 0; ; from += CATEGORY_LINKS_PAGE) {
    const { data, error } = await supabase
      .from("event_category_links")
      .select("category_id,event_id")
      .in("category_id", categoryIds)
      .order("category_id", { ascending: true })
      .order("event_id", { ascending: true })
      .range(from, from + CATEGORY_LINKS_PAGE - 1);
    if (error) {
      console.error("readCategoryLinks failed:", JSON.stringify(error));
      return null;
    }
    const page = (data ?? []) as CategoryLink[];
    rows.push(...page);
    if (page.length < CATEGORY_LINKS_PAGE) return rows;
  }
}

/** Link rows → event_id set per category. */
export function linksByCategory(rows: CategoryLink[]): Map<number, Set<number>> {
  const map = new Map<number, Set<number>>();
  for (const l of rows) {
    if (!map.has(l.category_id)) map.set(l.category_id, new Set());
    map.get(l.category_id)!.add(l.event_id);
  }
  return map;
}

/**
 * event_id sets per category, for slicing a pool of events by a group of
 * sibling categories (e.g. "which league does each deal belong to" - the
 * החבילות המשתלמות league-diversity cap). No tree walk; an empty map when the
 * read fails.
 */
export async function getEventIdsByCategories(
  categoryIds: number[],
): Promise<Map<number, Set<number>>> {
  const rows = await readCategoryLinks(categoryIds);
  return linksByCategory(rows ?? []);
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
 * A node is kept when it (or any descendant) holds BOOKABLE packages -
 * future events inside the availability window, matching the category pages.
 * A tag-less hub like יעדים survives purely to carry its children - "roots
 * only" would hide it while its grandchildren still have live packages. Full
 * tree (not just roots), no cap: roots are 3 by design now. Cached for an ISR
 * window and invalidated with the `events` tag like the rest of the
 * catalogue, since the root layout renders on every request.
 */
export type NavCategory = { href: string; label: string; children?: NavCategory[] };

/**
 * Ids of the rows that may appear on a listing (`isListedEvent`: not a QA event,
 * not taken off the site, not an unapproved uploader event). The nav counts only
 * these - a hub whose events are all hidden would otherwise get a header link to
 * an empty /c/ page and name an unapproved tour.
 */
export function listedEventIds(
  rows: Array<
    Pick<Event, "id" | "is_test" | "deactivated_reason" | "is_hidden">
  >,
): Set<number> {
  return new Set(rows.filter(isListedEvent).map((row) => row.id));
}

/** The column is not in the database yet (42703; PostgREST says PGRST204). */
const isMissingColumn = (error: { code?: string } | null): boolean =>
  error?.code === "42703" || error?.code === "PGRST204";

/**
 * Future events' listing flags. A deploy that beat the backoffice migration
 * (`events.is_hidden`) must not wipe the nav for the cache's hour, so a missing
 * column reads again without it - nothing is hidden before the column exists.
 */
async function readFutureEventFlags() {
  const future = futureDateISO(AVAILABILITY_WINDOW_DAYS);
  const withHidden = await supabase
    .from("events")
    .select("id,is_test,deactivated_reason,is_hidden")
    .is("is_deleted", null)
    .gte("date", future);
  if (!isMissingColumn(withHidden.error)) return withHidden;
  return supabase
    .from("events")
    .select("id,is_test,deactivated_reason")
    .is("is_deleted", null)
    .gte("date", future);
}

export const getNavCategories = nextCache(
  async (): Promise<NavCategory[]> => {
    const all = await getAllCategories();
    if (!all.length) return [];

    // Count only BOOKABLE packages: a category whose events are all in the
    // past (e.g. last season's ליגת האלופות) must not sit as a dead nav link.
    // Same availability rule as the category pages themselves.
    // Every link, paged (readCategoryLinks): one select used to stop at 1,000 of
    // ~3,500 and the menu lost a random tenth of its categories.
    const [links, futureRes] = await Promise.all([
      readCategoryLinks(all.map((c) => c.id)),
      readFutureEventFlags(),
    ]);
    if (links === null || futureRes.error) {
      console.error(
        "getNavCategories failed:",
        JSON.stringify(futureRes.error ?? "event_category_links read failed"),
      );
      return [];
    }
    const futureIds = listedEventIds(futureRes.data ?? []);
    const counts = new Map<number, number>();
    links.forEach((l) => {
      if (!futureIds.has(l.event_id)) return;
      counts.set(l.category_id, (counts.get(l.category_id) ?? 0) + 1);
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
