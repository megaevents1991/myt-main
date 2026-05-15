import Link from "next/link";
import dayjs from "dayjs";

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
        <article className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover">
          <div className="flex items-start justify-between gap-3">
            <span
              className={`text-2xl font-extrabold ${
                sold ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              {price !== null
                ? `$${price.toLocaleString("en-US")}`
                : "—"}
            </span>
            <span className="text-xl font-extrabold tabular-nums text-foreground">
              {dateLabel}
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            {event.location?.name}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <EventStatusBadge event={event} />
            {!sold && event.skip_flight && <TicketOnlyBadge />}
          </div>

          <div className="mt-auto flex items-end justify-between gap-3 pt-1">
            <Button
              variant="pill"
              size="sm"
              disabled={sold}
              className="pointer-events-none"
              tabIndex={-1}
            >
              {sold ? "אזל מהמלאי" : "בחרו תאריך"}
            </Button>
            <PackageIcons highlight="ticket" />
          </div>
        </article>
      </EventButton>
    </Link>
  );
};
