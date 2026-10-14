import { ClientSideHomepage } from "@/components/ClientSideHomepage";
import { getGoogleReviews } from "@/lib/googleReviews";
import { FAQ } from "@/components/ui/FAQ";
import MegaEventsSection from "@/components/ui/aboutUsMega";
import { TrustSection } from "@/components/TrustSection";
import { AirlinesStrip } from "@/components/ui/AirlinesStrip";
import { getCachedEvents } from "@/lib/eventsData";
import { StructuredData } from "@/components/StructuredData";
import { CategorySection, type HomeCategory } from "@/components/CategorySection";
import { getCategories as getCategoryRows } from "@/lib/categories";
import { getAllArtists as listAllArtists } from "@/lib/artists";
import { getAllFootballTeams } from "@/lib/football";
import { getAvailabilityChecker } from "@/lib/tourStatus";
import {
  getHomepageLayout,
  resolveBlockTiles,
  resolveSliderMembers,
  rowLayouts,
  toClientLayout,
} from "@/lib/homepageLayout";
import { buildPools, showFlags, sliderPool, type PoolInput } from "@/lib/homepage/rows";
import {
  defaultPinnable,
  defaultShowable,
  planHomepage,
  refId,
  refKind,
  type MergedRow,
} from "@/lib/homepage/merge";
import type { HeroCarouselItem } from "@/components/HeroCarousel";

// Force static generation with ISR
export const dynamic = "force-static";
export const revalidate = 3600; // Revalidate every hour (reduced from 24h for fresher content)

async function getEventsForPage() {
  const events = await getCachedEvents();
  // Never publish a homepage snapshot with zero events - a transient DB
  // failure during ISR regeneration used to bake an empty page (site-wide
  // "sold out") into the static cache for an hour (2026-07-19). Throwing makes
  // the regeneration fail, so Next keeps serving the last good page instead.
  if (!events.events.length) {
    throw new Error("Homepage: events unavailable - keeping last good static page");
  }
  return events;
}

async function getCategories(): Promise<HomeCategory[]> {
  // Live source: backoffice-managed Supabase `categories` table.
  const rows = await getCategoryRows();
  return rows.map((c) => ({
    slug: c.slug,
    name: c.name,
    subtitle: c.subtitle ?? undefined,
    tag: c.tag ?? undefined,
    sport: c.sport ?? undefined,
    imageUrl: c.image_url ?? undefined,
    linkUrl: c.link_url ?? undefined,
    artImageUrl: c.art_image_url ?? undefined,
    artColorIndex: c.art_color_index ?? undefined,
    artShapeIndex: c.art_shape_index ?? undefined,
    artImageScale: c.art_image_scale ?? undefined,
    artBgScale: c.art_bg_scale ?? undefined,
    artImageOffsetX: c.art_image_offset_x ?? undefined,
    artImageOffsetY: c.art_image_offset_y ?? undefined,
  }));
}

export default async function Home() {
  // Add timestamp for cache validation
  const timestamp = Date.now();

  const [events, artists, categories, allFootballTeams, isAvailable, googleReviews, layout] =
    await Promise.all([
      getEventsForPage(),
      listAllArtists(),
      getCategories(),
      getAllFootballTeams(),
      getAvailabilityChecker(),
      getGoogleReviews(),
      getHomepageLayout(),
    ]);

  // The category behind every event slider staff added on the board, and the
  // category tiles behind every destinations slider.
  const [sliderMembers, blockTiles] = await Promise.all([
    resolveSliderMembers(layout),
    resolveBlockTiles(layout),
  ]);

  // Every carousel = its automatic pool (lib/homepage/rows - the site's rules)
  // merged with what staff set on the backoffice board: cards pinned in their
  // places, cards hidden from the row, the row's length (lib/homepage/merge).
  // The board draws with the same two files, so it shows exactly this.
  const poolInput: PoolInput = {
    events: events.events,
    artists,
    teams: allFootballTeams,
    isAvailable,
    reviews: googleReviews?.reviews ?? [],
  };
  const pools = buildPools(poolInput);
  const sliderKeys = layout.sections.flatMap((s) => (s.type === "event_slider" ? [s.key] : []));
  for (const key of sliderKeys) pools[key] = sliderPool(poolInput, sliderMembers[key]);
  const flags = showFlags(poolInput);
  const plan = planHomepage(
    rowLayouts(layout),
    pools,
    (ref, key) => defaultShowable(flags.get(ref), key, ref),
    (ref, key) => defaultPinnable(flags.get(ref), key, ref)
  );
  const refsOf = (row: MergedRow | undefined, kind: string) =>
    (row?.cards ?? []).filter((c) => refKind(c.ref) === kind).map((c) => refId(c.ref));

  // Event rows go to the client as ids, in order.
  const rows: Record<string, number[]> = {};
  for (const key of ["most_wanted", "newest", "more_events", ...sliderKeys]) {
    rows[key] = refsOf(plan[key], "event").map(Number);
  }

  const artistBySlug = new Map(artists.map((a) => [a.sys.id, a]));
  const teamBySlug = new Map(allFootballTeams.map((t) => [t.sys.id, t]));
  const heroItems: HeroCarouselItem[] = (plan.hero?.cards ?? []).flatMap((c): HeroCarouselItem[] => {
    const id = refId(c.ref);
    if (refKind(c.ref) === "artist") {
      const entry = artistBySlug.get(id);
      return entry ? [{ kind: "artist", entry }] : [];
    }
    if (refKind(c.ref) === "team") {
      const entry = teamBySlug.get(id);
      return entry ? [{ kind: "team", entry }] : [];
    }
    return [];
  });
  const homeArtists = refsOf(plan.artists, "artist").flatMap((id) => artistBySlug.get(id) ?? []);
  const homeFootball = refsOf(plan.football, "team").flatMap((id) => teamBySlug.get(id) ?? []);
  const reviewByKey = new Map((googleReviews?.reviews ?? []).map((r) => [r.key, r]));
  const homeReviews = googleReviews
    ? {
        ...googleReviews,
        reviews: refsOf(plan.reviews, "review").flatMap((k) => reviewByKey.get(k) ?? []),
      }
    : null;

  return (
    <main>
      {/* Add invisible element with timestamp for client checking */}
      <div id="page-timestamp" data-timestamp={timestamp} style={{ display: 'none' }} />
      <noscript>
        <div className="w-full py-6 px-4 text-white bg-main text-center">
          <h1 className="text-3xl font-bold sm:text-4xl md:text-5xl">
            האירועים הכי שווים בעולם במקום אחד, בחרו, הרכיבו וטוסו ליהנות
          </h1>
        </div>
      </noscript>
      <StructuredData events={events.events} />
      <ClientSideHomepage
        initialEvents={events.events}
        footballTeams={allFootballTeams}
        allFootballTeams={allFootballTeams}
        artists={artists}
        carouselArtists={artists}
        heroItems={heroItems}
        homeArtists={homeArtists}
        homeFootball={homeFootball}
        googleReviews={homeReviews}
        layout={toClientLayout(layout, rows, blockTiles)}
      />
      {/* קטגוריות (categories) visual hidden for now - needs rework before re-enabling. */}
      {/* <CategorySection categories={categories} /> */}
      {/* AirlinesStrip + MegaEventsSection (about / "שותפים לדרך") hidden for now - re-add later */}
      <TrustSection />
      <FAQ />
    </main>
  );
}
