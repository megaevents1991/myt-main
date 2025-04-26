import { Suspense } from "react";
import { ClientSideHomepage } from "@/components/ClientSideHomepage";
import { FAQ } from "@/components/ui/FAQ";
import MegaEventsSection from "@/components/ui/aboutUsMega";

const envServer = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
// Server comp
async function getEvents() {
  const response = await fetch(`${envServer}/api/events`, {
    cache: process.env.NODE_ENV === "development" ? "no-store" : "default",
    next:
      process.env.NODE_ENV === "development"
        ? undefined
        : { revalidate: 3600, tags: ["events"] },
  });
  const { events } = await response.json();
  return events;
}

export default async function Home() {
  const events = await getEvents();

  return (
    <main>
      <Suspense fallback={<div>Loading...</div>}>
        <ClientSideHomepage initialEvents={events} />
      </Suspense>

      <Suspense fallback={<div>טוען עלינו...</div>}>
        <MegaEventsSection />
      </Suspense>

      <Suspense fallback={<div>טוען שאלות נפוצות...</div>}>
        <FAQ />
      </Suspense>
    </main>
  );
}
