import Link from "next/link";
import dayjs from "dayjs";
import "dayjs/locale/he";

import { Event } from "@/lib/app.types";
import { computePackagePrice, isEventSoldOut } from "@/lib/events/price";
import { Button } from "@/components/ui/button";
import { PackageIcons } from "@/components/ui/PackageIcons";
import { TicketOnlyBadge } from "@/components/TicketOnlyBadge";
import { EventStatusBadge } from "@/components/EventStatusBadge";
import EventButton from "@/components/EventButton";

/**
 * Date-card used in the "אירועים קרובים" lists on artist/football detail
 * pages. White rounded card: price + date row, venue, badge, package icons,
 * dark-pill CTA. Sold-out greys the price and disables the CTA.
 */
export const EventCard = ({
  event,
  title,
}: {
  event: Event;
  /** Display title — falls back to the event name. */
  title?: string;
}) => {
  const sold = isEventSoldOut(event);
  const price = computePackagePrice(event);
  const dateLabel = event.date
    ? dayjs(event.date).format("DD/MM/YY")
    : "תאריך יפורסם בקרוב";
  const weekday = event.date
    ? dayjs(event.date).locale("he").format("dddd")
    : null;

  return (
    <Link
      href={sold ? "#no-op" : `/order/${event.id}`}
      aria-label={
        sold ? "אירוע — אזל מהמלאי" : `הזמנת כרטיסים — ${title ?? event.name}`
      }
      className={sold ? "cursor-default" : "cursor-pointer"}
      role="listitem"
    >
      <EventButton event={event}>
        <article className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_14px_36px_-10px_hsl(var(--brand-mint)/0.4)]">
          {/* Date on the right, price on the left (swapped per mock) */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col items-start">
              <span className="text-xl font-extrabold tabular-nums text-foreground">
                {dateLabel}
              </span>
              {weekday && (
                <span className="text-xs text-muted-foreground">
                  יום {weekday}
                </span>
              )}
            </div>
            <span
              className={`text-2xl font-extrabold ${
                sold ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              {price !== null
                ? `$${price.toLocaleString("en-US")}`
                : "—"}
            </span>
          </div>

          {/* Destination — larger per mock */}
          <p className="text-lg font-bold text-foreground">
            {event.location?.name}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <EventStatusBadge event={event} />
            {!sold && event.skip_flight && <TicketOnlyBadge />}
          </div>

          {/* Icons on the right, button on the left (swapped per mock) */}
          <div className="mt-auto flex items-end justify-between gap-3 pt-1">
            <PackageIcons cycle />
            <Button
              variant="pill"
              size="sm"
              disabled={sold}
              className="pointer-events-none"
              tabIndex={-1}
            >
              {sold ? "אזל מהמלאי" : "בחרו תאריך"}
            </Button>
          </div>
        </article>
      </EventButton>
    </Link>
  );
};
