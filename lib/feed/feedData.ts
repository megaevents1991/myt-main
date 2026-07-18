/**
 * Meta catalog feed — data assembly (server-only). Fetches the live events the
 * site sells plus their taxonomy links, and maps them through the pure
 * builders in `metaCatalog.ts`. Used by the XML/CSV feed routes and the
 * /product-feed admin page, so all three always agree.
 */
import { supabase } from "@/lib/supabase";
import type { Event } from "@/lib/app.types";
import type { EventCategory, EventTag } from "@/lib/taxonomy.types";
import { getAllTags } from "@/lib/taxonomy";
import { enrichEventsWithFallbackImages } from "@/lib/events/fallbackImage";
import { AVAILABILITY_WINDOW_DAYS, futureDateISO } from "@/lib/eventsData";
import {
  buildFeedItem,
  type EventTaxonomyInfo,
  type FeedBuildResult,
} from "@/lib/feed/metaCatalog";

/**
 * Every sellable product, sold-out included (Meta guidance: mark "out of
 * stock" rather than delete). Past events drop out — Meta hides them via
 * expiration_date anyway, so listing them only bloats the file.
 */
export async function getFeedItems(): Promise<FeedBuildResult> {
  const todayISO = futureDateISO(0);
  const cutoffISO = futureDateISO(AVAILABILITY_WINDOW_DAYS);

  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .is("is_deleted", null)
    .gte("date", todayISO)
    .order("date", { ascending: true });
  if (error) {
    console.error("[feed] events query failed:", JSON.stringify(error));
    return { items: [], skipped: [] };
  }

  const enriched = await enrichEventsWithFallbackImages((events ?? []) as Event[]);
  const taxonomyByEvent = await getTaxonomyByEvent(enriched.map((e) => e.id));

  const result: FeedBuildResult = { items: [], skipped: [] };
  for (const event of enriched) {
    const built = buildFeedItem(
      event,
      taxonomyByEvent.get(event.id) ?? { categoryPath: [], tagSlugs: [] },
      cutoffISO,
      todayISO
    );
    if ("skipped" in built) {
      result.skipped.push({ id: event.id, name: event.name, reason: built.skipped });
    } else {
      result.items.push(built);
    }
  }
  return result;
}

/**
 * product_type + custom-label inputs per event, from the backoffice taxonomy.
 * Category path = the DEEPEST directly-linked category's ancestor chain
 * (name_english preferred — Meta's product_type examples are latin);
 * tag slugs keep the tag list's alphabetical order.
 */
async function getTaxonomyByEvent(
  eventIds: number[]
): Promise<Map<number, EventTaxonomyInfo>> {
  const map = new Map<number, EventTaxonomyInfo>();
  if (!eventIds.length) return map;

  const [cats, tags, catLinks, tagLinks] = await Promise.all([
    // ALL non-deleted categories, hidden included — product_type describes
    // what the event IS; a category hidden from the site (is_active=false,
    // page 404s) must still label its events in the Meta catalog.
    fetchAllCategories(),
    getAllTags(),
    fetchLinks("event_category_links", "category_id", eventIds),
    fetchLinks("event_tag_links", "tag_id", eventIds),
  ]);

  const catById = new Map<number, EventCategory>(cats.map((c) => [c.id, c]));
  const tagById = new Map<number, EventTag>(tags.map((t) => [t.id, t]));

  const pathOf = (catId: number): string[] => {
    const parts: string[] = [];
    const seen = new Set<number>();
    let cur: EventCategory | undefined = catById.get(catId);
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      parts.unshift(cur.name_english || cur.name);
      cur = cur.parent_id != null ? catById.get(cur.parent_id) : undefined;
    }
    return parts;
  };

  for (const id of eventIds) map.set(id, { categoryPath: [], tagSlugs: [] });

  for (const link of catLinks) {
    const info = map.get(link.event_id);
    if (!info || !catById.has(link.other_id)) continue;
    const path = pathOf(link.other_id);
    if (path.length > info.categoryPath.length) info.categoryPath = path;
  }

  for (const link of tagLinks) {
    const info = map.get(link.event_id);
    const tag = tagById.get(link.other_id);
    if (info && tag) info.tagSlugs.push(tag.slug);
  }
  for (const info of map.values()) info.tagSlugs.sort();

  return map;
}

async function fetchAllCategories(): Promise<EventCategory[]> {
  const { data, error } = await supabase
    .from("event_categories")
    .select("*")
    .eq("is_deleted", false);
  if (error) {
    console.error("[feed] event_categories query failed:", JSON.stringify(error));
    return [];
  }
  return (data ?? []) as EventCategory[];
}

async function fetchLinks(
  table: "event_category_links" | "event_tag_links",
  otherCol: "category_id" | "tag_id",
  eventIds: number[]
): Promise<{ event_id: number; other_id: number }[]> {
  const { data, error } = await supabase
    .from(table)
    .select(`event_id,${otherCol}`)
    .in("event_id", eventIds);
  if (error) {
    console.error(`[feed] ${table} query failed:`, JSON.stringify(error));
    return [];
  }
  return ((data ?? []) as unknown as Record<string, number>[]).map((row) => ({
    event_id: row.event_id,
    other_id: row[otherCol],
  }));
}
