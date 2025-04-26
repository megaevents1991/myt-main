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
      <Suspense
        fallback={
          <div className="min-h-[80vh] flex items-center justify-center">
            Loading...
          </div>
        }
      >
        <div className="content-wrapper">
          <ClientSideHomepage initialEvents={events} />
          <MegaEventsSection />
          <FAQ />
        </div>
      </Suspense>
    </main>
  );
}
