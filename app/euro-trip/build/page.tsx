import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCachedEvents } from "@/lib/eventsData";
import { isItineraryEligible } from "@/lib/itinerary/eligibility";
import { itineraryOn } from "@/lib/itinerary/settings";
import { getItinerarySettings } from "@/lib/itinerary/settings.server";
import { slimTripEvent } from "@/lib/itinerary/slim";
import { HeaderTitle } from "@/components/HeaderTitle";
import { ItineraryProvider } from "@/components/euro-trip/build/ItineraryProvider";
import { ItineraryFlow } from "@/components/euro-trip/build/ItineraryFlow";

/**
 * "Build Your Euro Trip" - the builder: pick 2-3 events (or open a route from `?events=`), plan
 * the days, then tickets, flights and hotels for the whole trip.
 *
 * ISR like the hub. Never reads searchParams, cookies() or headers() (the 2026-09-17 outage):
 * the route in `?events=` is read on the client, after hydration.
 */
export const revalidate = 3600;

const TITLE = "Build Your Euro Trip";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getItinerarySettings();
  return {
    title: `${TITLE} - בנו את היורו טריפ שלכם | מגה איבנטס`,
    description: "בנו טיול עם 2-3 אירועים: טיסה לעיר הראשונה וחזרה מהאחרונה, מלון בכל עיר.",
    // Indexable only once staff switched the feature on (a preview / dev page stays out of Google).
    ...(settings.enabled
      ? { alternates: { canonical: "https://www.mega-events.co.il/euro-trip/build" } }
      : { robots: { index: false, follow: false } }),
  };
}

export default async function EuroTripBuildPage() {
  const settings = await getItinerarySettings();
  if (!itineraryOn(settings, process.env.VERCEL_ENV)) notFound();

  const { events } = await getCachedEvents();
  // Never cache a builder with an empty catalog (a DB blip at regeneration): throwing keeps the
  // last good page, the homepage's rule (app/page.tsx).
  if (!events.length) throw new Error("Euro trip builder: events unavailable - keeping last good static page");

  const todayIso = new Date().toISOString().slice(0, 10);
  // Only what the builder reads goes to the browser (1.6 MB -> a fraction): lib/itinerary/slim.ts.
  const catalog = events.filter((e) => isItineraryEligible(e, todayIso)).map(slimTripEvent);

  return (
    <>
      <HeaderTitle name={TITLE} />
      <ItineraryProvider catalog={catalog} settings={settings}>
        <Suspense>
          <ItineraryFlow />
        </Suspense>
      </ItineraryProvider>
    </>
  );
}
