import { ClientSideHomepage } from "@/components/ClientSideHomepage";
import { getGoogleReviews } from "@/lib/googleReviews";
import { FAQ } from "@/components/ui/FAQ";
import MegaEventsSection from "@/components/ui/aboutUsMega";
import { TrustSection } from "@/components/TrustSection";
import { AirlinesStrip } from "@/components/ui/AirlinesStrip";
import { getCachedEvents } from "@/lib/eventsData";
import { StructuredData } from "@/components/StructuredData";
import { Artist, FootballTeam } from "@/lib/app.types";
import { CategorySection, type HomeCategory } from "@/components/CategorySection";
import { getCategories as getCategoryRows } from "@/lib/categories";
import { getAllArtists as listAllArtists } from "@/lib/artists";
import { getAllFootballTeams } from "@/lib/football";
import { getAvailabilityChecker } from "@/lib/tourStatus";
import {
  getHomepageLayout,
  resolveBlockEvents,
  resolveBlockTiles,
  pinRank,
  pinnedFirst,
  toClientLayout,
  type HomepagePin,
} from "@/lib/homepageLayout";
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

// Hero carousel ring: the artists/teams PINNED on the backoffice Homepage
// board first, in the board's order (only those we currently have an
// available event for - "זמין באתר", same rule as the catalog pages), then
// every other available artist + team interleaved so the ring mixes music
// and football.
function buildHeroItems(
  heroPins: HomepagePin[],
  allArtists: Artist[],
  allTeams: FootballTeam[],
  isAvailable: (nameEnglish?: string) => boolean
): HeroCarouselItem[] {
  const available = <T extends Artist | FootballTeam>(x: T) =>
    isAvailable(String(x.fields.nameDBenglish ?? ""));
  const artistBySlug = new Map(allArtists.map((a) => [a.sys.id, a]));
  const teamBySlug = new Map(allTeams.map((t) => [t.sys.id, t]));

  const items: HeroCarouselItem[] = [];
  const used = new Set<string>();
  for (const pin of heroPins) {
    const key = `${pin.kind}:${pin.ref_id}`;
    if (used.has(key)) continue;
    if (pin.kind === "artist") {
      const entry = artistBySlug.get(pin.ref_id);
      if (!entry || !available(entry)) continue;
      items.push({ kind: "artist", entry });
    } else if (pin.kind === "team") {
      const entry = teamBySlug.get(pin.ref_id);
      if (!entry || !available(entry)) continue;
      items.push({ kind: "team", entry });
    } else {
      continue;
    }
    used.add(key);
  }

  const artists = allArtists.filter((a) => available(a) && !used.has(`artist:${a.sys.id}`));
  const teams = allTeams.filter((t) => available(t) && !used.has(`team:${t.sys.id}`));
  for (let i = 0; i < Math.max(artists.length, teams.length); i++) {
    if (artists[i]) items.push({ kind: "artist", entry: artists[i] });
    if (teams[i]) items.push({ kind: "team", entry: teams[i] });
  }
  return items;
}

// Homepage artist/football slides: EVERY entry, ordered with the ones we have
// an available event for ("זמין באתר") FIRST and the rest appended at the end.
// Within each group: the order pinned on the backoffice Homepage board
// (`homepage_items`), unpinned entries after it alphabetically (stable sort
// keeps the DB name order). (The hero ring, by contrast, shows only the
// available ones - see buildHeroItems.)
function availableFirst<T extends Artist | FootballTeam>(
  list: T[],
  rank: Map<string, number>,
  isAvailable: (nameEnglish?: string) => boolean
): T[] {
  const avail: T[] = [];
  const rest: T[] = [];
  for (const item of list) {
    if (isAvailable(String(item.fields.nameDBenglish ?? ""))) avail.push(item);
    else rest.push(item);
  }
  const bySlug = (x: T) => x.sys.id;
  return [...pinnedFirst(avail, rank, bySlug), ...pinnedFirst(rest, rank, bySlug)];
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

  const heroItems = buildHeroItems(layout.pins.hero, artists, allFootballTeams, isAvailable);

  // Event sliders staff added on the backoffice Homepage board: their pinned
  // events + the events of the category each one names.
  // ...and the category tiles behind every destinations slider.
  const [blockEvents, blockTiles] = await Promise.all([
    resolveBlockEvents(layout, events.events),
    resolveBlockTiles(layout),
  ]);

  // Homepage "אמנים מובילים" / "כדורגל" slides - all entries, available first.
  const homeArtists = availableFirst(artists, pinRank(layout.pins.artists, "artist"), isAvailable);
  const homeFootball = availableFirst(
    allFootballTeams,
    pinRank(layout.pins.football, "team"),
    isAvailable
  );

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
        googleReviews={googleReviews}
        layout={toClientLayout(layout, blockEvents, blockTiles)}
      />
      {/* קטגוריות (categories) visual hidden for now - needs rework before re-enabling. */}
      {/* <CategorySection categories={categories} /> */}
      {/* AirlinesStrip + MegaEventsSection (about / "שותפים לדרך") hidden for now - re-add later */}
      <TrustSection />
      <FAQ />
    </main>
  );
}
