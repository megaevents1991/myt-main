import { ClientSideHomepage } from "@/components/ClientSideHomepage";
import { FAQ } from "@/components/ui/FAQ";
import MegaEventsSection from "@/components/ui/aboutUsMega";
import { TrustSection } from "@/components/TrustSection";
import { AirlinesStrip } from "@/components/ui/AirlinesStrip";
import { getCachedEvents } from "@/lib/eventsData";
import { StructuredData } from "@/components/StructuredData";
import { Artist, FootballTeam } from "@/lib/app.types";
import { CategorySection, type HomeCategory } from "@/components/CategorySection";
import { getCategories as getCategoryRows } from "@/lib/categories";
import { getAllArtists as listAllArtists, getFeaturedArtists } from "@/lib/artists";
import { getAllFootballTeams, getFeaturedFootballTeams } from "@/lib/football";
import { getAvailabilityChecker } from "@/lib/tourStatus";
import type { HeroCarouselItem } from "@/components/HeroCarousel";

// Force static generation with ISR
export const dynamic = "force-static";
export const revalidate = 3600; // Revalidate every hour (reduced from 24h for fresher content)

async function getEventsForPage() {
  try {
    const events = await getCachedEvents();
    return events;
  } catch (error) {
    console.error("Page: Failed to get events for rendering:", error);
    return { events: [] };
  }
}

// Featured football teams (carousel order via `featured_order`), falling back
// to all teams when none are marked featured. Source: Supabase.
async function getFootballTeams(): Promise<FootballTeam[]> {
  const featured = await getFeaturedFootballTeams();
  return featured.length ? featured : getAllFootballTeams();
}

// Featured artists (hero carousel order), falling back to all. Source: Supabase.
async function getCarouselArtists(): Promise<Artist[]> {
  const featured = await getFeaturedArtists();
  return featured.length ? featured : listAllArtists();
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

// Hero carousel ring: EVERY artist + football team we currently have an
// available event for ("זמין באתר" — same availability rule as the catalog
// pages), featured entries first, artists and teams interleaved so the ring
// mixes music and football.
function buildHeroItems(
  featuredArtists: Artist[],
  allArtists: Artist[],
  featuredTeams: FootballTeam[],
  allTeams: FootballTeam[],
  isAvailable: (nameEnglish?: string) => boolean
): HeroCarouselItem[] {
  const featuredFirst = <T extends Artist | FootballTeam>(
    featured: T[],
    all: T[]
  ) => {
    const seen = new Set(featured.map((x) => x.sys.id));
    return [...featured, ...all.filter((x) => !seen.has(x.sys.id))];
  };

  const artists = featuredFirst(featuredArtists, allArtists).filter((a) =>
    isAvailable(String(a.fields.nameDBenglish ?? ""))
  );
  const teams = featuredFirst(featuredTeams, allTeams).filter((t) =>
    isAvailable(String(t.fields.nameDBenglish ?? ""))
  );

  const items: HeroCarouselItem[] = [];
  for (let i = 0; i < Math.max(artists.length, teams.length); i++) {
    if (artists[i]) items.push({ kind: "artist", entry: artists[i] });
    if (teams[i]) items.push({ kind: "team", entry: teams[i] });
  }
  return items;
}

// Homepage artist/football slides: EVERY entry, ordered with the ones we have
// an available event for ("זמין באתר") FIRST and the rest appended at the end.
// Within each group: backoffice manual order (Templates → Homepage Order,
// `display_order`), unordered entries after it alphabetically (stable sort
// keeps the DB name order). (The hero carousel, by contrast, shows only the
// available ones and is ordered by `featured_order`.)
function availableFirst<T extends Artist | FootballTeam>(
  list: T[],
  isAvailable: (nameEnglish?: string) => boolean
): T[] {
  const avail: T[] = [];
  const rest: T[] = [];
  for (const item of list) {
    if (isAvailable(String(item.fields.nameDBenglish ?? ""))) avail.push(item);
    else rest.push(item);
  }
  const byDisplayOrder = (a: T, b: T) =>
    (a.fields.displayOrder ?? Number.MAX_SAFE_INTEGER) -
    (b.fields.displayOrder ?? Number.MAX_SAFE_INTEGER);
  avail.sort(byDisplayOrder);
  rest.sort(byDisplayOrder);
  return [...avail, ...rest];
}

export default async function Home() {
  // Add timestamp for cache validation
  const timestamp = Date.now();

  const [events, footballTeams, carouselArtists, artists, categories, allFootballTeams, isAvailable] = await Promise.all([
    getEventsForPage(),
    getFootballTeams(),
    getCarouselArtists(),
    listAllArtists(),
    getCategories(),
    getAllFootballTeams(),
    getAvailabilityChecker(),
  ]);

  const heroItems = buildHeroItems(
    carouselArtists,
    artists,
    footballTeams,
    allFootballTeams,
    isAvailable
  );

  // Homepage "אמנים מובילים" / "כדורגל" slides — all entries, available first.
  const homeArtists = availableFirst(artists, isAvailable);
  const homeFootball = availableFirst(allFootballTeams, isAvailable);

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
        footballTeams={footballTeams}
        allFootballTeams={allFootballTeams}
        artists={artists}
        carouselArtists={carouselArtists}
        heroItems={heroItems}
        homeArtists={homeArtists}
        homeFootball={homeFootball}
      />
      {/* קטגוריות (categories) visual hidden for now — needs rework before re-enabling. */}
      {/* <CategorySection categories={categories} /> */}
      {/* AirlinesStrip + MegaEventsSection (about / "שותפים לדרך") hidden for now — re-add later */}
      <TrustSection />
      <FAQ />
    </main>
  );
}
