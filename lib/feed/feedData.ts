/**
 * Meta catalog feed - data assembly (server-only). Fetches the live events the
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
import {
  buildActivityItem,
  type ActivityBuildResult,
  type DomainHint,
} from "@/lib/feed/activitiesCatalog";
import { normalizeName } from "@/lib/eventNameMatch";

// PostgREST hard-caps every response at max-rows (1000 on this project) -
// a plain unranged select silently returns the first 1000 rows and drops the
// rest, which for the link tables meant arbitrary events losing their
// custom labels / product_type as soon as total links crossed the cap.
const DB_PAGE_SIZE = 1000;
// `.in("event_id", ids)` serializes into the query string - hundreds of ids
// make the URL long enough to 414, so id-lists are chunked.
const IN_CHUNK_SIZE = 200;

/** Drains a ranged query page by page until a short page arrives. */
async function fetchAllPages<T>(
  label: string,
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += DB_PAGE_SIZE) {
    const { data, error } = await page(from, from + DB_PAGE_SIZE - 1);
    if (error) {
      console.error(`[feed] ${label} query failed:`, JSON.stringify(error));
      break;
    }
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < DB_PAGE_SIZE) break;
  }
  return all;
}

/**
 * Classifier for events the taxonomy doesn't cover: does the event name match
 * a CMS artist or a football team? Most `tx_event` rows have no category link,
 * and Meta's activity_category ("Concert"/"Sports") drives who sees the ad -
 * so falling back to "Other" for a Shakira concert is a real targeting loss.
 * Fixture names ("Bayern - RB Leipzig") are matched side by side.
 */
async function peopleClassifier(): Promise<(eventName: string) => DomainHint> {
  const [artists, teams] = await Promise.all([
    fetchPeopleNames("artists"),
    fetchPeopleNames("football_teams"),
  ]);

  return (eventName: string): DomainHint => {
    const whole = normalizeName(eventName);
    if (!whole) return null;
    // Sides of a fixture, plus a "Competition: A vs B" prefix stripped off.
    const sides = eventName
      .replace(/^[^:]+:\s*/, "")
      .split(/\s+-\s+|\s+vs\.?\s+/i)
      .map((s) => normalizeName(s))
      .filter(Boolean);

    if (teams.has(whole) || sides.some((s) => teams.has(s)))
      return "football-team";
    if (artists.has(whole) || sides.some((s) => artists.has(s)))
      return "artist";
    return null;
  };
}

async function fetchPeopleNames(
  table: "artists" | "football_teams",
): Promise<Set<string>> {
  // artists/football_teams use a BOOLEAN is_deleted (events use a date string).
  const rows = await fetchAllPages<{ name?: string; name_english?: string }>(
    table,
    (from, to) =>
      supabase
        .from(table)
        .select("name, name_english")
        .eq("is_deleted", false)
        .order("id", { ascending: true })
        .range(from, to),
  );
  const names = new Set<string>();
  for (const row of rows) {
    for (const n of [row.name, row.name_english]) {
      const normalized = normalizeName(n);
      if (normalized) names.add(normalized);
    }
  }
  return names;
}

/** Shared fetch for both feed shapes: sellable events + their taxonomy. */
async function getFeedEvents(): Promise<{
  events: Event[];
  taxonomyByEvent: Map<number, EventTaxonomyInfo>;
}> {
  const events = await fetchAllPages<Event>("events", (from, to) =>
    supabase
      .from("events")
      .select("*")
      .is("is_deleted", null)
      .gte("date", futureDateISO(0))
      .order("date", { ascending: true })
      .order("id", { ascending: true }) // stable pages when dates tie
      .range(from, to),
  );

  const enriched = await enrichEventsWithFallbackImages(
    events.filter((e) => !e.is_test),
  );
  return {
    events: enriched,
    taxonomyByEvent: await getTaxonomyByEvent(enriched.map((e) => e.id)),
  };
}

/**
 * Same events in Meta's ACTIVITIES schema - the vertical our Meta catalog
 * actually is (see `activitiesCatalog.ts`). Activities feeds have no
 * availability field, so sold-out and unbookable events are dropped here
 * rather than marked out of stock.
 */
export async function getActivityItems(): Promise<ActivityBuildResult> {
  const cutoffISO = futureDateISO(AVAILABILITY_WINDOW_DAYS);
  const { events, taxonomyByEvent } = await getFeedEvents();
  const classify = await peopleClassifier();

  const result: ActivityBuildResult = { items: [], skipped: [] };
  for (const event of events) {
    const built = buildActivityItem(
      event,
      taxonomyByEvent.get(event.id) ?? { categoryPath: [], tagSlugs: [] },
      cutoffISO,
      classify(event.name),
    );
    if ("skipped" in built) {
      result.skipped.push({
        id: event.id,
        name: event.name,
        reason: built.skipped,
      });
    } else {
      result.items.push(built);
    }
  }
  return result;
}

/**
 * Every sellable product, sold-out included (Meta guidance: mark "out of
 * stock" rather than delete). Past events drop out - Meta hides them via
 * expiration_date anyway, so listing them only bloats the file.
 */
export async function getFeedItems(): Promise<FeedBuildResult> {
  const todayISO = futureDateISO(0);
  const cutoffISO = futureDateISO(AVAILABILITY_WINDOW_DAYS);
  const { events: enriched, taxonomyByEvent } = await getFeedEvents();

  const result: FeedBuildResult = { items: [], skipped: [] };
  for (const event of enriched) {
    const built = buildFeedItem(
      event,
      taxonomyByEvent.get(event.id) ?? { categoryPath: [], tagSlugs: [] },
      cutoffISO,
      todayISO,
    );
    if ("skipped" in built) {
      result.skipped.push({
        id: event.id,
        name: event.name,
        reason: built.skipped,
      });
    } else {
      result.items.push(built);
    }
  }
  return result;
}

/**
 * product_type + custom-label inputs per event, from the backoffice taxonomy.
 * Category path = the DEEPEST directly-linked category's ancestor chain
 * (name_english preferred - Meta's product_type examples are latin);
 * tag slugs keep the tag list's alphabetical order.
 */
async function getTaxonomyByEvent(
  eventIds: number[],
): Promise<Map<number, EventTaxonomyInfo>> {
  const map = new Map<number, EventTaxonomyInfo>();
  if (!eventIds.length) return map;

  const [cats, tags, catLinks, tagLinks] = await Promise.all([
    // ALL non-deleted categories, hidden included - product_type describes
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
  return fetchAllPages<EventCategory>("categories", (from, to) =>
    supabase
      .from("categories")
      .select("*")
      .eq("is_deleted", false)
      .order("id", { ascending: true })
      .range(from, to),
  );
}

async function fetchLinks(
  table: "event_category_links" | "event_tag_links",
  otherCol: "category_id" | "tag_id",
  eventIds: number[],
): Promise<{ event_id: number; other_id: number }[]> {
  const links: { event_id: number; other_id: number }[] = [];
  for (let i = 0; i < eventIds.length; i += IN_CHUNK_SIZE) {
    const chunk = eventIds.slice(i, i + IN_CHUNK_SIZE);
    const rows = await fetchAllPages<Record<string, number>>(
      table,
      (from, to) =>
        supabase
          .from(table)
          .select(`event_id,${otherCol}`)
          .in("event_id", chunk)
          .order("event_id", { ascending: true })
          .order(otherCol, { ascending: true }) // unique pair → fully stable pages
          .range(from, to),
    );
    for (const row of rows) {
      links.push({ event_id: row.event_id, other_id: row[otherCol] });
    }
  }
  return links;
}
