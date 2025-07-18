import { ClientSideHomepage } from "@/components/ClientSideHomepage";
import { FAQ } from "@/components/ui/FAQ";
import MegaEventsSection from "@/components/ui/aboutUsMega";
import { getCachedEvents } from "@/lib/eventsData";
import { StructuredData } from "@/components/StructuredData";

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

export default async function Home() {
  const events = await getEventsForPage();

  return (
    <main>
      <StructuredData events={events.events} />
      <ClientSideHomepage initialEvents={events.events} />
      <MegaEventsSection />
      <FAQ />
    </main>
  );
}
