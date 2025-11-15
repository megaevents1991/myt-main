import { ClientSideHomepage } from "@/components/ClientSideHomepage";
import { FAQ } from "@/components/ui/FAQ";
import MegaEventsSection from "@/components/ui/aboutUsMega";
import { getCachedEvents } from "@/lib/eventsData";
import { StructuredData } from "@/components/StructuredData";
import { contentfulClient } from "@/lib/contentful";
import { FootballFields, ArtistFields, Artist, CarouselFields, FootballTeam } from "@/lib/app.types";

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

async function getFootballTeams(): Promise<FootballTeam[]> {
  try {
    // Fetch the specific carousel entry with its linked football teams
    const carouselEntry = await contentfulClient.getEntry("2VjS97BWIScDQXwjx9Q4nP", {
      include: 2, // Include linked entries (football teams)
    });

    const items = carouselEntry.fields.items;
    
    if (!items || !Array.isArray(items)) {
      console.warn("No items found in football carousel entry");
      return [];
    }

    // Extract the ordered football teams (already have the correct structure)
    const orderedFootballTeams: FootballTeam[] = items
      .filter((item): item is FootballTeam => item !== null && typeof item === 'object' && 'fields' in item) as FootballTeam[];

    return orderedFootballTeams;
  } catch (error) {
    console.error("Page: Failed to get ordered football teams from carousel:", error);
    
    // Fallback: get all football teams if carousel fetch fails
    try {
      const { items } = await contentfulClient.getEntries<FootballFields>({
        content_type: "footballTeamTemplate",
      });
      return items;
    } catch (fallbackError) {
      console.error("Page: Failed to get football teams fallback:", fallbackError);
      return [];
    }
  }
}

async function getOrderedArtists(): Promise<Artist[]> {
  try {
    // Fetch the specific carousel entry with its linked artists
    const carouselEntry = await contentfulClient.getEntry<CarouselFields>("3RxzAgWZi26FSbBYhgMmVO", {
      include: 2, // Include linked entries (artists)
    });

    if (!carouselEntry.fields.items) {
      console.warn("No items found in carousel entry");
      return [];
    }

    // Extract the ordered artists (already have the correct structure)
    const orderedArtists: Artist[] = carouselEntry.fields.items
      .filter((item) => item && 'fields' in item) as Artist[]; // Filter for resolved entries only

    return orderedArtists;
  } catch (error) {
    console.error("Page: Failed to get ordered artists from carousel:", error);
    
    // Fallback: get all artists if carousel fetch fails
    try {
      const { items } = await contentfulClient.getEntries<ArtistFields>({
        content_type: "artistTemplate",
      });
      
      return items.map((item) => ({
        sys: { id: item.sys.id },
        fields: {
          name: item.fields.name,
          nameDBenglish: item.fields.nameDBenglish,
          previewText: item.fields.previewText,
          heroBanner: item.fields.heroBanner,
          bio: item.fields.bio,
        },
      }));
    } catch (fallbackError) {
      console.error("Page: Failed to get artists fallback:", fallbackError);
      return [];
    }
  }
}

export default async function Home() {
  // Add timestamp for cache validation
  const timestamp = Date.now();
  
  const events = await getEventsForPage();
  const footballTeams = await getFootballTeams();
  const artists = await getOrderedArtists();

  return (
    <main>
      {/* Add invisible element with timestamp for client checking */}
      <div id="page-timestamp" data-timestamp={timestamp} style={{ display: 'none' }} />
      <StructuredData events={events.events} />
      <ClientSideHomepage initialEvents={events.events} footballTeams={footballTeams} artists={artists} />
      <MegaEventsSection />
      <FAQ />
    </main>
  );
}
