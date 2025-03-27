import { Suspense } from "react";
import { ClientSideHomepage } from "@/components/ClientSideHomepage";

// Server component
async function getEvents() {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/events`,
    {
      next: {
        revalidate: 3660, // Revalidate every hour
      },
    }
  );
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
    </main>
  );
}
