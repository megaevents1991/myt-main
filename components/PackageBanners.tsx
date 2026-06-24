"use client";

import Link from "next/link";
import dayjs from "dayjs";

import { Event } from "@/lib/app.types";
import { computePackagePrice, isEventSoldOut } from "@/lib/events/price";
import { EventArt } from "@/components/ui/EventArt";
import { EventStatusBadge } from "@/components/EventStatusBadge";

// Tags that mark an event worth surfacing as a promo banner.
const FEATURED_TAGS = ["VIPevent", "LastTickets", "Popular", "Restock"];

/**
 * Promo "package" banners on the homepage — wide cards highlighting featured
 * events (per Dor's mock). Content is auto-selected from the events list:
 * tagged events first, falling back to the next available ones. No new data
 * source — purely a richer presentation of existing events.
 */
export const PackageBanners = ({ events }: { events: Event[] }) => {
  const live = events.filter((e) => !isEventSoldOut(e));
  const tagged = live.filter((e) => FEATURED_TAGS.includes(e.tags ?? ""));
  const featured = (tagged.length >= 3 ? tagged : live).slice(0, 4);

  if (featured.length === 0) return null;

  return (
    <section
      aria-labelledby="package-banners-heading"
      className="w-full bg-background px-4 py-8 md:px-6 lg:py-10"
      dir="rtl"
    >
      <div className="container mx-auto">
        <div className="mb-4 flex flex-row items-stretch justify-start lg:mb-6">
          <h2
            id="package-banners-heading"
            className="mx-2 text-center font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl"
          >
            חבילות שכדאי לחטוף
          </h2>
          <div className="mx-1 bg-secondary" style={{ height: 40, width: 23 }} />
          <div className="mx-1 hidden bg-secondary sm:block" style={{ height: 40, width: 46 }} />
        </div>

        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible">
          {featured.map((event) => {
            const price = computePackagePrice(event);
            return (
              <Link
                key={event.id}
                href={`/order/${event.id}`}
                className="group relative w-[88vw] shrink-0 snap-start overflow-hidden rounded-3xl border border-border bg-card shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover sm:w-auto"
                aria-label={`${event.name} — ${dayjs(event.date).format("DD/MM/YYYY")} ב${event.location.name}`}
              >
                {/* Banner art with green brand wash + title overlay */}
                <div className="relative h-44 sm:h-52">
                  <EventArt
                    id={event.id}
                    imageUrl={event.art_image_url || event.card_image_url}
                    alt={`תמונת האירוע ${event.name}`}
                    variant={event.art_image_url ? "blob" : "photo"}
                    colorIndex={event.art_color_index ?? undefined}
                    shapeIndex={event.art_shape_index ?? undefined}
                    className="h-full w-full"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/75 to-transparent" />
                  <h3 className="absolute inset-x-4 bottom-3 line-clamp-2 text-right text-2xl font-extrabold leading-tight text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.85)]">
                    {event.name}
                  </h3>
                </div>

                {/* Info strip */}
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0 text-right">
                    <p className="truncate text-sm text-muted-foreground">
                      <span className="font-bold text-foreground">
                        {dayjs(event.date).format("DD/MM/YY")}
                      </span>
                      <span className="mx-1.5" aria-hidden>•</span>
                      {event.location.name}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <EventStatusBadge event={event} />
                      {price !== null && (
                        <span className="text-lg font-extrabold tabular-nums text-foreground">
                          ${price.toLocaleString("en-US")}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-main px-5 py-2.5 text-sm font-bold text-main-foreground transition-colors group-hover:bg-main/90">
                    בחרו תאריך
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};
