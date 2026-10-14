import { NextResponse } from "next/server";
import { getCachedEvents } from "@/lib/eventsData";
import { getAllArtists } from "@/lib/artists";
import { getAllFootballTeams } from "@/lib/football";
import { getAvailabilityChecker } from "@/lib/tourStatus";
import { getGoogleReviews } from "@/lib/googleReviews";
import { getEventIdsByCategories } from "@/lib/taxonomy";
import { buildPools, homepageCards, sliderPool, type PoolInput } from "@/lib/homepage/rows";

/**
 * GET /api/homepage-pools - what the homepage's rows are made of, for the
 * backoffice /homepage board (2026-10-14).
 *
 * Every row's AUTOMATIC pool in the site's own order (lib/homepage/rows - the
 * same function app/page.tsx renders with), the pool of each category an event
 * slider may name (`?categories=12,40`), and a card per thing the board may
 * place (every live event, artist, team and review) carrying the picture the
 * site's card draws and whether it can be shown. The board merges them with its
 * draft through lib/homepage/merge (the same file as here), so what it draws is
 * what the site will show. Read-only.
 *
 * Called server-to-server with the shared secret in `x-hotel-secret`
 * (NEXT_SECRET_REVALIDATION_SECRET), like /api/hotels-warm. Reads the same
 * cached loaders as the homepage, i.e. the catalog the site holds right now.
 */
export const dynamic = "force-dynamic";

const MAX_CATEGORIES = 30;

export async function GET(request: Request) {
  const secret = process.env.NEXT_SECRET_REVALIDATION_SECRET;
  if (!secret || request.headers.get("x-hotel-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = new URL(request.url).searchParams.get("categories") ?? "";
  const categoryIds = [
    ...new Set(
      raw
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ].slice(0, MAX_CATEGORIES);

  try {
    const [events, artists, teams, isAvailable, reviews, byCategory] = await Promise.all([
      getCachedEvents(),
      getAllArtists(),
      getAllFootballTeams(),
      getAvailabilityChecker(),
      getGoogleReviews(),
      categoryIds.length ? getEventIdsByCategories(categoryIds) : Promise.resolve(new Map<number, Set<number>>()),
    ]);
    const input: PoolInput = {
      events: events.events,
      artists,
      teams,
      isAvailable,
      reviews: reviews?.reviews ?? [],
    };
    const sliderPools: Record<string, string[]> = {};
    for (const id of categoryIds) sliderPools[String(id)] = sliderPool(input, byCategory.get(id));

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        pools: buildPools(input),
        sliderPools,
        cards: homepageCards(input),
        reviewsReady: reviews !== null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[homepage-pools]", error);
    return NextResponse.json({ error: "Could not build the homepage pools" }, { status: 500 });
  }
}
