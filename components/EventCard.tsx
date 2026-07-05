import Link from "next/link";
import dayjs from "dayjs";
import "dayjs/locale/he";

import { Event } from "@/lib/app.types";
import { cn } from "@/lib/utils";
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
  showName = false,
}: {
  event: Event;
  /** Display title — falls back to the event name. */
  title?: string;
  /** Show the event name above the venue (used on the search results grid,
   * where the same event isn't implied by the page context). */
  showName?: boolean;
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
      className={cn("block h-full", sold ? "cursor-default" : "cursor-pointer")}
      role="listitem"
    >
      <EventButton event={event}>
        <article className="group relative flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-[0_4px_16px_-6px_rgb(0_0_0/0.12)] ring-1 ring-black/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_14px_36px_-10px_hsl(var(--brand-mint)/0.4)]">
          {/* Ticket-only marker — pinned in the top-right corner; the date row
              below gets right-side room so the badge never sits on the date. */}
          {!sold && event.skip_flight && (
            <TicketOnlyBadge className="absolute right-3 top-3 z-20" />
          )}
          {/* Date on the right, price on the left (swapped per mock) */}
          <div className="flex items-start justify-between gap-3">
            <div
              className={cn(
                "flex flex-col items-start",
                !sold && event.skip_flight && "ps-12"
              )}
            >
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

          {/* Event name (search grid only) + destination */}
          {showName && (
            <p className="line-clamp-2 text-lg font-bold leading-tight text-foreground">
              {title ?? event.name}
            </p>
          )}
          <p
            className={cn(
              "font-bold text-foreground",
              showName ? "text-sm text-muted-foreground" : "text-lg"
            )}
          >
            {event.location?.name}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <EventStatusBadge event={event} />
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
              {sold ? "אזל מהמלאי" : "לפרטים והזמנה"}
            </Button>
          </div>
        </article>
      </EventButton>
    </Link>
  );
};
