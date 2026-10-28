"use client";

import { cn } from "@/lib/utils";
import { computePackagePrice } from "@/lib/events/price";
import { placeLabel } from "@/lib/events/lodging";
import { dayMonthYear, type CatalogItem } from "@/lib/itinerary/builder";
import { eventDay } from "@/lib/itinerary/geo";
import { isAddable } from "@/lib/itinerary/rules";
import { MIN_TRIP_EVENTS } from "@/lib/itinerary/state";
import { EventFinder } from "./EventFinder";
import { TripEventArt } from "./TripEventArt";
import { useItinerary } from "./ItineraryProvider";
import { ADD_BUTTON, CompatChip } from "./parts";
import { TripPanel } from "./TripPanel";

/**
 * A compact catalog card: the homepage card's art and body, with the route's add / remove.
 * `full` = the route already holds `max_events`: nothing is "not fitting", there is just no room -
 * no chip, no dimming, a neutral "המסלול מלא".
 */
function EventPick({
  item: { event: e, compat, inRoute },
  labelled,
  full,
}: {
  item: CatalogItem;
  labelled: boolean;
  full: boolean;
}) {
  const { addEvent, removeEvent } = useItinerary();
  const blocked = !inRoute && !full && !isAddable(compat);
  const price = computePackagePrice(e);
  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-card text-start shadow-card",
        inRoute ? "border-primary ring-[3px] ring-primary/15" : "border-border",
      )}
    >
      <TripEventArt
        event={e}
        sizes="(max-width: 640px) 45vw, 260px"
        className={cn("h-[118px] w-full", blocked && "opacity-40")}
      />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className={cn("line-clamp-2 min-h-[2lh] text-[15px] font-bold leading-tight", blocked && "opacity-40")} title={e.name}>
          {e.name}
        </h3>
        <p className={cn("text-[12.5px] text-muted-foreground", blocked && "opacity-40")}>
          <b className="tabular-nums text-foreground">{dayMonthYear(eventDay(e))}</b> • {placeLabel(e)}
        </p>
        {labelled && !inRoute && !full && <CompatChip compat={compat} className="mt-1" />}
        {price !== null && (
          <div className={cn("mt-auto flex items-baseline justify-between gap-1.5 pt-2", blocked && "opacity-40")}>
            <span className="text-[11px] text-muted-foreground">מחיר ממוצע לחבילה</span>
            <b className="text-lg font-extrabold tabular-nums">${price.toLocaleString("en-US")}</b>
          </div>
        )}
        {inRoute ? (
          <button
            type="button"
            onClick={() => removeEvent(e.id)}
            aria-label={`הסרת ${e.name} מהמסלול`}
            className="mt-2 w-full rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            ✓ במסלול · הסרה
          </button>
        ) : full ? (
          <button type="button" disabled aria-label={`${e.name} - המסלול מלא`} className={cn(ADD_BUTTON, "mt-2 w-full")}>
            המסלול מלא
          </button>
        ) : (
          <button
            type="button"
            onClick={() => addEvent(e)}
            disabled={blocked}
            aria-label={blocked ? `${e.name} - לא מתאים למסלול` : `הוספת ${e.name} למסלול`}
            className={cn(ADD_BUTTON, "mt-2 w-full")}
          >
            {blocked ? "לא מתאים למסלול" : "+ הוספה למסלול"}
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * Self-build mode (the planner): from 1024px two columns - the search-first finder (`EventFinder`:
 * one search bar with the filters behind "סינון", suggestions instead of the whole catalog, every
 * card saying whether it fits the route) and, on the inline-end side, the trip's panel
 * (`TripPanel`, sticky). Below 1024px only the panel, full width: events are picked through its
 * "הוסף אירוע" popup (the same finder, as rows).
 */
export function SelfBuild() {
  const { state, settings } = useItinerary();
  const range = settings.maxEvents > MIN_TRIP_EVENTS ? `${MIN_TRIP_EVENTS}-${settings.maxEvents}` : `${MIN_TRIP_EVENTS}`;
  const full = state.route.length >= settings.maxEvents;

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
      <div className="hidden min-w-0 flex-col gap-4 lg:flex">
        <p className="m-0 text-lg leading-snug md:text-[19px]">
          בנו מסלול משלכם: <b>בחרו {range} אירועים.</b> חפשו את הראשון - ואנחנו נציע מה מתאים אליו.
        </p>

        <EventFinder
          full={full}
          renderItems={(items, labelled) => (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <EventPick key={item.event.id} item={item} labelled={labelled} full={full} />
              ))}
            </div>
          )}
        />
      </div>

      {/* The trip: first on a phone (the only thing there), the inline-end column from 1024px. */}
      <TripPanel className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-13rem)] lg:overflow-y-auto myt-scroll" />
    </div>
  );
}
