import { ClientSideHomepage } from "@/components/ClientSideHomepage";
import { FAQ } from "@/components/ui/FAQ";
import MegaEventsSection from "@/components/ui/aboutUsMega";
import { getCachedEvents } from "@/lib/eventsData";
import { StructuredData } from "@/components/StructuredData";
import { contentfulClient } from "@/lib/contentful";
import { FootballFields } from "@/lib/app.types";

// Force static generation
export const dynamic = "force-static";
export const revalidate = 3600; // Revalidate every hour

async function getEventsForPage() {
  try {
    const events = await getCachedEvents();
    return events;
  } catch (error) {
    console.error("Page: Failed to get events for rendering:", error);
    return { events: [] };
  }
}

async function getFootballTeams() {
  try {
    const { items } = await contentfulClient.getEntries<FootballFields>({
      content_type: "footballTeamTemplate",
    });
    return items;
  } catch (error) {
    console.error("Page: Failed to get football teams for rendering:", error);
    return [];
  }
}

export default async function Home() {
  const events = await getEventsForPage();
  const footballTeams = await getFootballTeams();

  return (
    <main>
      <StructuredData events={events.events} />
      <ClientSideHomepage initialEvents={events.events} footballTeams={footballTeams} />
      <MegaEventsSection />
      <FAQ />
    </main>
  );
}
