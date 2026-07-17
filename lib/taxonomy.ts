import { supabase } from "@/lib/supabase";
import type { Event } from "@/lib/app.types";
import type { EventCategory, EventCategoryNode, EventTag } from "@/lib/taxonomy.types";
import { buildTree, descendantIds } from "@/lib/taxonomy-tree";
import { enrichEventsWithFallbackImages } from "@/lib/events/fallbackImage";
import { AVAILABILITY_WINDOW_DAYS, futureDateISO } from "@/lib/eventsData";

/**
 * Event taxonomy readers. The backoffice manages the category tree
 * (`event_categories`, self-referencing parent_id) + curated feed tags
 * (`event_tags`); events attach via junction tables that store only the
 * DIRECTLY-assigned nodes. Ancestors are inferred here at read time — an event
 * linked to "ליגה אנגלית" automatically appears on the "כדורגל" page.
 */

export async function getAllCategories(): Promise<EventCategory[]> {
  const { data, error } = await supabase
    .from("event_categories")
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

export async function getCategoryTree(): Promise<EventCategoryNode[]> {
  return buildTree(await getAllCategories());
}

export async function getCategoryBySlug(slug: string): Promise<EventCategory | null> {
  const { data, error } = await supabase
    .from("event_categories")
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
 * Events under a category node. includeDescendants (default true) walks DOWN
 * the tree: the node's own links + every descendant node's links.
 * Same availability rules as the rest of the catalog: not deleted, at least
 * AVAILABILITY_WINDOW_DAYS in the future, soonest first.
 */
export async function getEventsInCategory(
  slug: string,
  opts: { includeDescendants?: boolean } = {}
): Promise<{ category: EventCategory | null; events: Event[] }> {
  const includeDescendants = opts.includeDescendants ?? true;
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
  return { category, events: await enrichEventsWithFallbackImages(events ?? []) };
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

export async function getEventsByTag(
  slug: string
): Promise<{ tag: EventTag | null; events: Event[] }> {
  const { data: tag, error: tagErr } = await supabase
    .from("event_tags")
    .select("*")
    .eq("slug", slug)
    .eq("is_deleted", false)
    .maybeSingle();
  if (tagErr) {
    console.error("getEventsByTag tag failed:", JSON.stringify(tagErr));
    return { tag: null, events: [] };
  }
  if (!tag) return { tag: null, events: [] };

  const { data: links, error: linkErr } = await supabase
    .from("event_tag_links")
    .select("event_id")
    .eq("tag_id", (tag as EventTag).id);
  if (linkErr) {
    console.error("getEventsByTag links failed:", JSON.stringify(linkErr));
    return { tag: tag as EventTag, events: [] };
  }
  const eventIds = (links ?? []).map((l) => l.event_id as number);
  if (!eventIds.length) return { tag: tag as EventTag, events: [] };

  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .in("id", eventIds)
    .is("is_deleted", null)
    .gte("date", futureDateISO(AVAILABILITY_WINDOW_DAYS))
    .order("date", { ascending: true });
  if (error) {
    console.error("getEventsByTag events failed:", JSON.stringify(error));
    return { tag: tag as EventTag, events: [] };
  }
  return { tag: tag as EventTag, events: await enrichEventsWithFallbackImages(events ?? []) };
}
