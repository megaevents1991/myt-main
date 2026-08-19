import Link from "next/link";
import dayjs from "dayjs";

import type { Event } from "@/lib/app.types";
import { computePackagePrice, isEventSoldOut } from "@/lib/events/price";
import { EventArt } from "@/components/ui/EventArt";
import { EventStatusBadge } from "@/components/EventStatusBadge";
import { PackageIcons } from "@/components/ui/PackageIcons";
import EventButton from "@/components/EventButton";

/**
 * The homepage event card, for the hub pages' בולטים / חבילות מומלצות
 * sections - same art (neon blob / crest-VS-crest / photo), same body and CTA,
 * so a package looks identical wherever it is promoted. Kept separate from the
 * homepage's local card because that one also carries the multi-dates strip
 * (needs the full events+CMS pools, which the hub sections don't load).
 */
export const HubEventCard = ({ event }: { event: Event }) => {
  const sold = isEventSoldOut(event);
  const price = computePackagePrice(event);

  return (
    <Link
      href={sold ? "#no-op" : `/order/${event.id}`}
      aria-label={`${event.name} - ${dayjs(event.date).format("DD/MM/YYYY")} ב${event.location?.name ?? ""}${sold ? " - אזלו הכרטיסים" : ""}`}
      aria-disabled={sold}
      className={sold ? "block h-full cursor-default" : "block h-full cursor-pointer"}
      role="listitem"
    >
      <EventButton event={event}>
        <article className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
          {/* Art - neon blob + cut-out for artists, crest VS crest for matches */}
          <EventArt
            id={event.id}
            imageUrl={
              event.match_away_logo_url
                ? event.match_home_logo_url
                : event.art_image_url || event.card_image_url
            }
            awayImageUrl={event.match_away_logo_url}
            alt={`תמונת האירוע ${event.name}`}
            variant={event.art_image_url ? "blob" : "photo"}
            colorIndex={event.art_color_index ?? undefined}
            shapeIndex={event.art_shape_index ?? undefined}
            imageScale={event.art_image_scale}
            bgScale={event.art_bg_scale}
            imageOffsetX={event.art_image_offset_x}
            imageOffsetY={event.art_image_offset_y}
            sizes="(max-width: 640px) 85vw, 320px"
            className="h-48 w-full sm:h-52"
          />

          {/* Body */}
          <div className="flex flex-1 flex-col p-4 text-right" dir="rtl">
            <h3 className="line-clamp-2 text-xl font-bold leading-tight" title={event.name}>
              {event.name}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              <span className="font-bold text-foreground">
                {dayjs(event.date).format("DD/MM/YY")}
              </span>
              <span className="mx-1.5" aria-hidden="true">
                •
              </span>
              {event.location?.name}
            </p>

            <div className="mt-2 min-h-[28px]">
              <EventStatusBadge event={event} />
            </div>

            <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
              <div className="text-right">
                {price !== null ? (
                  <>
                    <p className="text-[11px] leading-none text-muted-foreground">מחיר ממוצע</p>
                    <div className="mt-1 text-2xl font-extrabold leading-none tabular-nums">
                      ${price.toLocaleString("en-US")}
                    </div>
                  </>
                ) : (
                  <div className="text-lg font-extrabold text-destructive">אזלו הכרטיסים</div>
                )}
                <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
                  לנוסע · כולל טיסה, מלון וכרטיס
                </p>
              </div>
              <PackageIcons cycle />
            </div>

            <div className="mt-4 w-full rounded-md bg-main py-3 text-center text-xs font-semibold text-main-foreground transition-colors group-hover:bg-secondary group-hover:text-black group-active:bg-secondary group-active:text-black">
              {sold ? "אזל מהמלאי" : "לפרטים והזמנה"}
            </div>
          </div>
        </article>
      </EventButton>
    </Link>
  );
};
