import { Suspense } from "react";
import { ClientSideHomepage } from "@/components/ClientSideHomepage";
import { FAQ } from "@/components/ui/FAQ";
import MegaEventsSection from "@/components/ui/aboutUsMega";

const envServer =
  process.env.NEXT_PUBLIC_API_URL ||
  `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;

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

function HomePageSkeleton() {
  return (
    <div className="w-full animate-pulse">
      {/* Hero section skeleton */}
      <div className="bg-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-4">
          {/* Hero content */}
          <div className="h-12 bg-gray-200 rounded-lg w-3/4 mx-auto mb-6"></div>
          <div className="h-6 bg-gray-200 rounded-lg w-2/4 mx-auto mb-12"></div>

          {/* Search box */}
          <div className="h-14 bg-gray-200 rounded-lg w-11/12 max-w-2xl mx-auto mb-8"></div>

          {/* Featured events skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-4 rounded-lg shadow">
                <div className="h-40 bg-gray-200 rounded mb-4"></div>
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* About section skeleton */}
      <div className="bg-gradient-to-b from-white to-gray-100 py-16">
        <div className="max-w-3xl mx-auto px-4">
          <div className="h-10 bg-gray-200 rounded-lg w-2/3 mx-auto mb-6"></div>
          <div className="h-6 bg-gray-200 rounded-lg w-3/4 mx-auto mb-12"></div>
          <div className="bg-white rounded-3xl shadow-lg p-6">
            <div className="h-4 bg-gray-200 rounded mb-4 w-full"></div>
            <div className="h-4 bg-gray-200 rounded mb-4 w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded mb-4 w-full"></div>
          </div>
        </div>
      </div>

      {/* FAQ skeleton */}
      <div className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <div className="h-8 bg-gray-200 rounded-lg w-1/3 mx-auto mb-8"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="mb-4 border-b border-gray-200 pb-4">
              <div className="h-6 bg-gray-200 rounded w-5/6 mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const events = await getEvents();

  return (
    <main>
      <Suspense fallback={<HomePageSkeleton />}>
        <div className="content-wrapper">
          <ClientSideHomepage initialEvents={events} />
          <MegaEventsSection />
          <FAQ />
        </div>
      </Suspense>
    </main>
  );
}
