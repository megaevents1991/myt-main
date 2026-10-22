import Link from "next/link";
import { Plane } from "lucide-react";

import { EventArt } from "@/components/ui/EventArt";
import { PackageIcons } from "@/components/ui/PackageIcons";
import type { RouteCardData } from "@/lib/itinerary/routeCard";

/** `YYYY-MM-DD` -> `DD/MM`. */
const dayMonth = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

/**
 * A "Build Your Euro Trip" route on the homepage card's shell
 * (components/ClientSideHomepage.tsx EventCard): the same article, body, price block,
 * package icons and CTA strip - with the art split between the route's events and a route
 * pill over it. Opens the route in the builder.
 */
export function RouteCard({
  data,
  eager = false,
}: {
  data: RouteCardData;
  /**
   * The first row: its art loads with the page (normal priority, not preloaded - the grid is
   * below the hero, and `priority` on every card saturated the phone network on the homepage).
   * The rest stays lazy.
   */
  eager?: boolean;
}) {
  const names = data.events.map((e) => e.name).join(" + ");
  const tickets = data.events.length;
  const hotels = data.stays > 1 ? `${data.stays} מלונות` : "מלון";
  // One city: the pill says how many events it holds (as the approved mock) - "לונדון · 2 אירועים".
  const pill = data.cities.length > 1 ? data.title : `${data.title} · ${tickets} אירועים`;

  return (
    <div className="flex h-full w-full flex-col">
      <Link
        href={`/euro-trip/build?events=${data.ids.join(",")}`}
        className="flex flex-1 cursor-pointer flex-col"
        aria-label={`${names} - ${data.title}, ${data.nights} לילות`}
      >
        <article className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
          {/* Split art: one EventArt per event, 2px card-coloured seams between them. */}
          <div className="relative flex h-40 w-full sm:h-44">
            {data.events.map((e, i) => (
              <div
                key={e.id}
                className={`relative min-w-0 flex-1 ${i > 0 ? "border-s-2 border-card" : ""}`}
              >
                <EventArt
                  id={e.id}
                  imageUrl={e.art.imageUrl}
                  awayImageUrl={e.art.awayImageUrl}
                  alt={`תמונת האירוע ${e.name} ב${e.cityName}`}
                  variant={e.art.variant}
                  colorIndex={e.art.colorIndex}
                  shapeIndex={e.art.shapeIndex}
                  imageScale={e.art.imageScale}
                  bgScale={e.art.bgScale}
                  imageOffsetX={e.art.imageOffsetX}
                  imageOffsetY={e.art.imageOffsetY}
                  loading={eager ? "eager" : "lazy"}
                  sizes={tickets > 2 ? "(max-width: 640px) 30vw, 160px" : "(max-width: 640px) 45vw, 240px"}
                  className="h-full w-full"
                />
              </div>
            ))}
            <span className="absolute bottom-2.5 start-2.5 flex max-w-[calc(100%-1.25rem)] items-center gap-1.5 rounded-full border border-white/15 bg-surface-inverse/90 px-3 py-1 text-xs font-extrabold text-surface-inverse-foreground backdrop-blur-sm">
              <Plane className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{pill}</span>
            </span>
          </div>

          {/* Body */}
          <div className="flex flex-1 flex-col p-4 text-start" dir="rtl">
            <h3 className="line-clamp-2 min-h-[2lh] text-lg font-bold leading-tight" title={names}>
              {data.staffTitle ?? names}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {data.events.map((e, i) => (
                <span key={e.id}>
                  {i > 0 && (
                    <span className="mx-1.5" aria-hidden="true">
                      •
                    </span>
                  )}
                  <span className="font-bold tabular-nums text-foreground">{dayMonth(e.day)}</span> {e.cityName}
                </span>
              ))}
            </p>

            <div className="mt-2 min-h-[28px]">
              {data.saving !== null && (
                <span className="inline-flex items-center rounded-full border border-primary/50 bg-primary/15 px-2.5 py-1 text-xs font-bold leading-none text-forest dark:text-primary">
                  חוסכים ${data.saving.toLocaleString("en-US")} מול {tickets} חבילות נפרדות
                </span>
              )}
            </div>

            {/* Price on the start side, package icons on the end side (as the homepage card). */}
            <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
              <div className="text-start">
                <p className="text-[11px] leading-none text-muted-foreground">מחיר ממוצע</p>
                <div className="mt-1 text-2xl font-extrabold leading-none tabular-nums">
                  ${data.perTraveller.toLocaleString("en-US")}
                </div>
                <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
                  לנוסע · {tickets} כרטיסים, {hotels} וטיסות
                </p>
              </div>
              <PackageIcons cycle />
            </div>

            <div className="mt-4 w-full rounded-md bg-main py-3 text-center text-xs font-semibold text-main-foreground transition-colors group-hover:bg-secondary group-hover:text-black group-active:bg-secondary group-active:text-black dark:bg-foreground dark:text-background dark:group-hover:bg-foreground/90 dark:group-hover:text-background dark:group-active:bg-foreground/90 dark:group-active:text-background">
              לפרטים והזמנה
            </div>
          </div>
        </article>
      </Link>
    </div>
  );
}
