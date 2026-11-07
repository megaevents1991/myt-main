import type { Event, FootballTeam } from "@/lib/app.types";
import { getAllArtists } from "@/lib/artists";
import { eventMatchesName } from "@/lib/eventNameMatch";
import { getCachedEvents, getEventsByName } from "@/lib/eventsData";
import { getAllFootballTeams } from "@/lib/football";
import { supabase } from "@/lib/supabase";
import { getEventsInCategory } from "@/lib/taxonomy";
import type { EventCategory } from "@/lib/taxonomy.types";

/**
 * Which events a /c/ hub lists, found the way its page finds them: a team or
 * artist leaf with a CMS template (TeamCmsPage / ArtistCmsPage) by NAME
 * (getEventsByName), every other hub by its own tags (getEventsInCategory).
 * Its metadata, its JSON-LD and the sitemap ask here so they agree with the page.
 */

/** A hub that draws child tiles instead of an event list is never "empty". */
export const isLeafHub = (cat: EventCategory, all: EventCategory[]): boolean =>
  !all.some((c) => c.parent_id === cat.id);

const parentSlug = (cat: EventCategory, all: EventCategory[]) =>
  cat.parent_id != null ? all.find((c) => c.id === cat.parent_id)?.slug : undefined;

/**
 * The CMS template a teams/artists leaf renders, by English then Hebrew name
 * (Dor, 2026-08-13). Null when none - or when it lacks either name, since the
 * page then draws the generic category body instead.
 */
export function matchCmsTwin(cat: EventCategory, entries: FootballTeam[]): FootballTeam | null {
  const en = (cat.name_english ?? "").trim().toLowerCase();
  const he = cat.name.trim().toLowerCase();
  const twin = entries.find((e) => {
    const cmsEn = String(e.fields.nameDBenglish ?? "").trim().toLowerCase();
    const cmsName = String(e.fields.name ?? "").trim().toLowerCase();
    return (en && (cmsEn === en || cmsName === en)) || cmsName === he;
  });
  return twin?.fields?.name && twin.fields.nameDBenglish ? twin : null;
}

export async function cmsTwinOf(
  cat: EventCategory,
  all: EventCategory[],
): Promise<FootballTeam | null> {
  const parent = parentSlug(cat, all);
  if (parent !== "teams" && parent !== "artists") return null;
  try {
    const entries = parent === "teams" ? await getAllFootballTeams() : await getAllArtists();
    return matchCmsTwin(cat, entries);
  } catch (e) {
    console.error("CMS twin lookup failed:", JSON.stringify(e));
    return null;
  }
}

/**
 * The hub's listed events. `reliable` is false when a read failed, so an empty
 * list must not be taken for "no events" (never noindex on a DB hiccup).
 */
export async function hubListedEvents(
  cat: EventCategory,
  twin: FootballTeam | null,
  readCategory: typeof getEventsInCategory = getEventsInCategory,
): Promise<{ events: Event[]; reliable: boolean }> {
  if (twin) {
    const [{ events }, { events: catalog }] = await Promise.all([
      getEventsByName(String(twin.fields.nameDBenglish)),
      getCachedEvents(),
    ]);
    return { events, reliable: catalog.length > 0 };
  }
  const { events, failed } = await readCategory(cat.slug);
  return { events, reliable: !failed };
}

/**
 * Leaf hubs that list no event, for the whole tree at once (the sitemap). A
 * source that could not be read marks nothing it decides: an empty catalog, a
 * failed links read (null) or an empty team / artist list (their readers
 * return [] on failure).
 */
export function emptyLeafIds({
  all,
  catalog,
  links,
  teams,
  artists,
}: {
  all: EventCategory[];
  catalog: Pick<Event, "id" | "name_english">[];
  links: Map<number, Set<number>> | null;
  teams: FootballTeam[];
  artists: FootballTeam[];
}): Set<number> {
  const empty = new Set<number>();
  if (!catalog.length) return empty;
  const onSale = new Set(catalog.map((e) => e.id));
  for (const cat of all) {
    if (!isLeafHub(cat, all)) continue;
    const parent = parentSlug(cat, all);
    const entries = parent === "teams" ? teams : parent === "artists" ? artists : null;
    if (entries && !entries.length) continue;
    const twin = entries ? matchCmsTwin(cat, entries) : null;
    let count: number;
    if (twin) {
      const name = String(twin.fields.nameDBenglish);
      count = catalog.filter((e) => eventMatchesName(e.name_english, name)).length;
    } else {
      if (!links) continue;
      count = [...(links.get(cat.id) ?? [])].filter((id) => onSale.has(id)).length;
    }
    if (count === 0) empty.add(cat.id);
  }
  return empty;
}

/**
 * Every link row of these categories, paged. One select stops at PostgREST's
 * 1,000-row cap without a word, and the leaves hold ~3,500 links (2026-11-07):
 * an unpaged read made hubs with events look empty. Null on any failed page.
 */
async function readCategoryLinks(categoryIds: number[]): Promise<Map<number, Set<number>> | null> {
  const PAGE = 1000;
  const map = new Map<number, Set<number>>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("event_category_links")
      .select("category_id,event_id")
      .in("category_id", categoryIds)
      .order("category_id", { ascending: true })
      .order("event_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("readCategoryLinks failed:", JSON.stringify(error));
      return null;
    }
    for (const l of data ?? []) {
      const cid = l.category_id as number;
      if (!map.has(cid)) map.set(cid, new Set());
      map.get(cid)!.add(l.event_id as number);
    }
    if ((data ?? []).length < PAGE) return map;
  }
}

/** emptyLeafIds over live data: the cached catalog, every leaf link, the two people lists. */
export async function readEmptyLeafIds(all: EventCategory[]): Promise<Set<number>> {
  const leafIds = all.filter((c) => isLeafHub(c, all)).map((c) => c.id);
  const [{ events: catalog }, links, teams, artists] = await Promise.all([
    getCachedEvents(),
    readCategoryLinks(leafIds),
    getAllFootballTeams().catch(() => []),
    getAllArtists().catch(() => []),
  ]);
  return emptyLeafIds({ all, catalog, links, teams, artists });
}
