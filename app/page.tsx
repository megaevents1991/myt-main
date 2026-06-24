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
  }));
}

export default async function Home() {
  // Add timestamp for cache validation
  const timestamp = Date.now();

  const [events, footballTeams, carouselArtists, artists, categories] = await Promise.all([
    getEventsForPage(),
    getFootballTeams(),
    getCarouselArtists(),
    listAllArtists(),
    getCategories(),
  ]);

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
        artists={artists}
        carouselArtists={carouselArtists}
      />
      <CategorySection categories={categories} />
      {/* AirlinesStrip + MegaEventsSection (about / "שותפים לדרך") hidden for now — re-add later */}
      <TrustSection />
      <FAQ />
    </main>
  );
}
