import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarHeart, Hotel, Plane } from "lucide-react";

import type { Event } from "@/lib/app.types";
import { getCachedEvents } from "@/lib/eventsData";
import { itineraryOn } from "@/lib/itinerary/settings";
import { getItinerarySettings } from "@/lib/itinerary/settings.server";
import { recommendRoutes } from "@/lib/itinerary/recommend";
import { toRouteCard, type RouteCardData } from "@/lib/itinerary/routeCard";
import ClientTracker from "@/components/ClientTracker";
import { HeaderTitle } from "@/components/HeaderTitle";
import { TrustBadges } from "@/components/ui/TrustBadges";
import { SectionHeading } from "@/components/vertical-hub/SectionHeading";
import { EuroTripHub } from "@/components/euro-trip/EuroTripHub";

/**
 * "Build Your Euro Trip" - the hub: suggested routes of 2-3 events and the way into the builder.
 * ISR like the /c/ hubs. Never reads searchParams, cookies() or headers() (the 2026-09-17 outage):
 * the filters live on the client.
 */
export const revalidate = 3600;

const TITLE = "Build Your Euro Trip";
const LINE = "2-3 אירועים בטיול אחד · טיסה לעיר הראשונה וחזרה מהאחרונה · מלון בכל עיר";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getItinerarySettings();
  return {
    title: `${TITLE} | מגה איבנטס`,
    description: LINE,
    // Indexable only once staff switched the feature on (a preview / dev page stays out of Google).
    ...(settings.enabled
      ? { alternates: { canonical: "https://www.mega-events.co.il/euro-trip" } }
      : { robots: { index: false, follow: false } }),
  };
}

const STEPS = [
  {
    Icon: CalendarHeart,
    title: "בוחרים 2-3 אירועים",
    text: "הופעות וכדורגל במיקס - בערים קרובות ובימים קרובים.",
  },
  {
    Icon: Plane,
    title: "טסים לעיר הראשונה",
    text: "טיסה לאירוע הראשון, מעבר בין הערים וחזרה הביתה מהאחרון.",
  },
  {
    Icon: Hotel,
    title: "מלון בכל עיר",
    text: "בוחרים מלון לכל עצירה, וכל הטיול מסודר במקום אחד.",
  },
];

export default async function EuroTripPage() {
  const settings = await getItinerarySettings();
  if (!itineraryOn(settings, process.env.VERCEL_ENV)) notFound();

  const { events } = await getCachedEvents();
  const todayIso = new Date().toISOString().slice(0, 10);
  const byId = new Map(events.map((e) => [e.id, e]));
  const cards: RouteCardData[] = recommendRoutes(events, settings, todayIso).flatMap((r) => {
    const route = r.ids.flatMap((id): Event[] => {
      const e = byId.get(id);
      return e ? [e] : [];
    });
    // An id the catalog no longer has: the route is skipped, never shown short.
    return route.length === r.ids.length ? [toRouteCard(route, settings)] : [];
  });

  return (
    <>
      <ClientTracker />
      <HeaderTitle name={TITLE} />

      {/* Hero - the hub covers' look (components/vertical-hub/HubCover.tsx), sized for a page
          that opens under the solid header. */}
      <section
        className="relative isolate overflow-hidden bg-main px-4 pb-10 pt-10 text-main-foreground md:px-6 md:pb-12 md:pt-14"
        dir="rtl"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 55% at 18% -10%, hsl(150 60% 62% / 0.28), transparent 70%)," +
              "radial-gradient(60% 55% at 82% -10%, hsl(150 60% 62% / 0.22), transparent 70%)," +
              "radial-gradient(90% 60% at 50% 108%, hsl(160 55% 24% / 0.55), transparent 72%)",
          }}
        />
        <svg
          aria-hidden
          viewBox="0 0 800 300"
          preserveAspectRatio="xMidYMax slice"
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-48 w-full text-main-foreground/[0.07] md:h-64"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="400" cy="300" r="60" />
          <circle cx="400" cy="300" r="120" />
          <circle cx="400" cy="300" r="180" />
          <circle cx="400" cy="300" r="240" />
          <circle cx="400" cy="300" r="4" fill="currentColor" stroke="none" />
        </svg>

        <div className="container mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-secondary">בנו את היורו טריפ שלכם</p>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl" dir="ltr">
            {TITLE}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-main-foreground/80 md:text-lg">{LINE}</p>
          <Link
            href="/euro-trip/build"
            className="mt-7 inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-base font-bold text-primary-foreground shadow-card transition-all duration-200 hover:bg-primary/90 hover:shadow-[0_6px_24px_-4px_hsl(var(--brand-mint)/0.55)] active:scale-[0.98]"
          >
            בנו טריפ משלכם
          </Link>
          <TrustBadges className="mt-8 justify-center text-main-foreground/70" />
        </div>
      </section>

      <div className="w-full bg-background px-4 py-10 md:px-6 lg:py-14" dir="rtl">
        <div className="container mx-auto space-y-12 lg:space-y-16">
          <section aria-labelledby="euro-trip-routes-heading">
            <SectionHeading id="euro-trip-routes-heading">מסלולים מומלצים</SectionHeading>
            <EuroTripHub cards={cards} headingId="euro-trip-routes-heading" />
          </section>

          <section aria-labelledby="euro-trip-how-heading">
            <SectionHeading id="euro-trip-how-heading">איך זה עובד</SectionHeading>
            <ol className="grid gap-4 sm:grid-cols-3">
              {STEPS.map(({ Icon, title, text }, i) => (
                <li key={title} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-card">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">שלב {i + 1}</p>
                    <h3 className="mt-0.5 font-display text-lg font-bold">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
