"use client";

import { Modal } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { eventCityName } from "@/lib/events/lodging";
import { dayMonthYear, type CatalogItem } from "@/lib/itinerary/builder";
import { eventDay } from "@/lib/itinerary/geo";
import { describeCompat, isAddable } from "@/lib/itinerary/rules";
import { EventFinder } from "./EventFinder";
import { useItinerary } from "./ItineraryProvider";
import { CompatChip } from "./parts";
import { TripEventArt } from "./TripEventArt";

/**
 * One result, in the site search's row look (components/HeroSearch.tsx): round art, the name,
 * DD/MM/YY · city - and NO price. A fitting row adds the event; a row that does not fit is
 * disabled and its chip says why. The chips start after the first pick, as on the grid.
 * The button is named by what it shows (name, date · city, the chip): a fitting row opens with an
 * sr-only "הוספה למסלול:", a blocked one always carries its reason (`describeCompat`); the art is
 * hidden from screen readers (its alt would repeat the name).
 */
function PickRow({ item: { event: e, compat }, labelled, onPick }: { item: CatalogItem; labelled: boolean; onPick: () => void }) {
  const blocked = !isAddable(compat);
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        disabled={blocked}
        className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-start transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        {!blocked && <span className="sr-only">הוספה למסלול:</span>}
        <span aria-hidden className="shrink-0">
          <TripEventArt
            event={e}
            sizes="44px"
            className={cn("size-11 shrink-0 rounded-full border-2 border-white", blocked && "opacity-40")}
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={cn("text-[15px] font-bold leading-snug text-foreground sm:truncate", blocked && "opacity-50")}>
            {e.name}
          </span>
          <span className={cn("text-xs text-muted-foreground", blocked && "opacity-60")}>
            <span className="tabular-nums">{dayMonthYear(eventDay(e))}</span> · {eventCityName(e)}
          </span>
          {labelled ? (
            <CompatChip compat={compat} />
          ) : (
            blocked && <span className="sr-only">{describeCompat(compat)}</span>
          )}
        </span>
        {!blocked && (
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-forest transition-colors group-hover:bg-primary group-hover:text-primary-foreground dark:text-primary"
            aria-hidden
          >
            <Plus className="size-5" />
          </span>
        )}
      </button>
    </li>
  );
}

/**
 * The popup's content - mounted while it is open (Mantine unmounts a closed modal's body), so
 * every visit starts on a clean search: the search-first finder (`EventFinder`) as rows. The
 * route's own events are not listed - the panel holds them. Only the search row sticks under the
 * modal's own sticky header (title + close, 60px); the filter panel and its chips scroll away
 * with the results - the bar's root is `display: contents`, so the search sticks along this
 * whole column.
 */
function PickerBody({ onPicked }: { onPicked: () => void }) {
  const { addEvent } = useItinerary();
  return (
    <div dir="rtl">
      <EventFinder
        hideInRoute
        autoFocus
        barClassName="contents"
        searchClassName="sticky top-[60px] z-10 -mx-4 bg-[var(--mantine-color-body)] px-4 pb-2"
        renderItems={(items, labelled) => (
          <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
            {items.map((item) => (
              <PickRow
                key={item.event.id}
                item={item}
                labelled={labelled}
                onPick={() => {
                  addEvent(item.event);
                  onPicked();
                }}
              />
            ))}
          </ul>
        )}
      />
    </div>
  );
}

/**
 * "הוסף אירוע" - the planner's event picker (spec C3; search first since 28.10): the search bar
 * with the filters behind "סינון", suggestions or results as rows that say whether each event
 * fits the trip.
 * Full screen below 1024px, like the order flow's hotel picker (SegmentHotelModal).
 */
export function EventPickerModal({
  opened,
  onClose,
  onPicked,
  returnFocus = true,
}: {
  opened: boolean;
  /** Dismissed (Escape, the overlay, ×). */
  onClose: () => void;
  /** An event was added: the popup is done. Defaults to `onClose`. */
  onPicked?: () => void;
  /** Hand the focus back to the opener on close (Mantine's own) - off when the opener is gone. */
  returnFocus?: boolean;
}) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      returnFocus={returnFocus}
      title="הוסף אירוע"
      size="lg"
      centered
      fullScreen={!isDesktop}
      styles={{ title: { fontWeight: 700, fontSize: 18 } }}
    >
      <PickerBody onPicked={onPicked ?? onClose} />
    </Modal>
  );
}
