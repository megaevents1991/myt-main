import { NextResponse } from "next/server";

import { getCachedEvents } from "@/lib/eventsData";
import { getAllArtists } from "@/lib/artists";
import { getNavCategories, type NavCategory } from "@/lib/taxonomy";

// Feeds the global header search modal (GlobalSearch): events for the package
// search, artists for the "all shows of <artist>" link, and hubs for the
// "כל האירועים ב<יעד/ליגה/ז'אנר>" link (Dor 21.8 - the artist footer link,
// generalized). ISR-cached like the rest of the event data - only refetched
// on revalidate, not per request.
export const revalidate = 3600;

/** Flatten the nav tree to the leaf pages worth landing on: destinations,
 *  leagues, genres. The people hubs (teams / artists) are skipped - an artist
 *  match already has its own link, and a team match lands on the event. */
const HUB_KINDS = new Set(["destinations", "leagues", "genres"]);
function flattenHubs(
  nodes: NavCategory[],
  parentSlug = "",
): { name: string; href: string; kind: string }[] {
  return nodes.flatMap((node) => {
    const slug = node.href.split("#")[0].split("/").filter(Boolean).pop() ?? "";
    const own = HUB_KINDS.has(parentSlug)
      ? [{ name: node.label, href: node.href, kind: parentSlug }]
      : [];
    return [...own, ...flattenHubs(node.children ?? [], slug)];
  });
}

export async function GET() {
  try {
    const [{ events }, artists, nav] = await Promise.all([
      getCachedEvents(),
      getAllArtists().catch(() => []),
      getNavCategories().catch(() => [] as NavCategory[]),
    ]);
    return NextResponse.json({ events, artists, hubs: flattenHubs(nav) });
  } catch (error) {
    console.error("search-events route failed:", error);
    return NextResponse.json({ events: [], artists: [], hubs: [] });
  }
}
