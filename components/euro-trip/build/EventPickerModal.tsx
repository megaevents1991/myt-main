"use client";

import { useMemo, useState } from "react";
import { Modal } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { eventCityName } from "@/lib/events/lodging";
import {
  catalogCities,
  catalogItems,
  catalogMonths,
  dayMonthYear,
  filterCatalog,
  type CatalogFilter,
  type CatalogItem,
} from "@/lib/itinerary/builder";
import { eventDay } from "@/lib/itinerary/geo";
import { isAddable } from "@/lib/itinerary/rules";
import { useItinerary } from "./ItineraryProvider";
import { CatalogFilters, CompatChip, LIST_PAGE, ShowMore } from "./parts";
import { TripEventArt } from "./TripEventArt";

const NO_FILTER: CatalogFilter = { query: "", month: "", kind: "all", city: "" };

/**
 * One result, in the site search's row look (components/HeroSearch.tsx): round art, the name,
 * DD/MM/YY · city - and NO price. A fitting row adds the event; a row that does not fit is
 * disabled and its chip says why. The chips start after the first pick, as on the grid.
 */
function PickRow({ item: { event: e, compat }, labelled, onPick }: { item: CatalogItem; labelled: boolean; onPick: () => void }) {
  const blocked = !isAddable(compat);
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        disabled={blocked}
        aria-label={blocked ? `${e.name} - לא מתאים למסלול` : `הוספת ${e.name} למסלול`}
        className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-start transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <TripEventArt
          event={e}
          sizes="44px"
          className={cn("size-11 shrink-0 rounded-full border-2 border-white", blocked && "opacity-40")}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={cn("text-[15px] font-bold leading-snug text-foreground sm:truncate", blocked && "opacity-50")}>
            {e.name}
          </span>
          <span className={cn("text-xs text-muted-foreground", blocked && "opacity-60")}>
            <span className="tabular-nums">{dayMonthYear(eventDay(e))}</span> · {eventCityName(e)}
          </span>
          {labelled && <CompatChip compat={compat} />}
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
 * every visit starts on a clean search. The route's own events are not listed: the panel holds
 * them. Compatible events first (`catalogItems`).
 */
function PickerBody({ onPicked }: { onPicked: () => void }) {
  const { state, catalog, settings, addEvent } = useItinerary();
  const [filter, setFilter] = useState<CatalogFilter>(NO_FILTER);
  const [visible, setVisible] = useState(LIST_PAGE);
  const months = useMemo(() => catalogMonths(catalog), [catalog]);
  const cities = useMemo(() => catalogCities(catalog), [catalog]);
  const items = useMemo(
    () => catalogItems(state.route, filterCatalog(catalog, filter), settings).filter((i) => !i.inRoute),
    [state.route, catalog, filter, settings],
  );

  const update = (patch: Partial<CatalogFilter>) => {
    setFilter((f) => ({ ...f, ...patch }));
    setVisible(LIST_PAGE);
  };

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      {/* Under the modal's own sticky header (title + close, 60px). */}
      <div className="sticky top-[60px] z-10 -mx-4 bg-[var(--mantine-color-body)] px-4 pb-2">
        <CatalogFilters filter={filter} onChange={update} months={months} cities={cities} autoFocus />
      </div>

      {items.length ? (
        <div>
          <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
            {items.slice(0, visible).map((item) => (
              <PickRow
                key={item.event.id}
                item={item}
                labelled={state.route.length > 0}
                onPick={() => {
                  addEvent(item.event);
                  onPicked();
                }}
              />
            ))}
          </ul>
          <ShowMore hidden={items.length - visible} onClick={() => setVisible((v) => v + LIST_PAGE)} />
        </div>
      ) : (
        <EmptyState
          title="לא מצאנו אירועים לחיפוש הזה"
          description="נסו שם אחר, חודש אחר, עיר אחרת או את כל האירועים."
          action={
            <button
              type="button"
              onClick={() => update(NO_FILTER)}
              className="h-11 rounded-xl border border-border bg-card px-5 text-sm font-bold text-foreground"
            >
              נקה סינון
            </button>
          }
        />
      )}
    </div>
  );
}

/**
 * "הוסף אירוע" - the planner's event picker (spec C3): the catalog's search and filters (month,
 * הכל / כדורגל / הופעות, city) over a list of rows that say whether each event fits the trip.
 * Full screen below 1024px, like the order flow's hotel picker (SegmentHotelModal).
 */
export function EventPickerModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="הוסף אירוע"
      size="lg"
      centered
      fullScreen={!isDesktop}
      styles={{ title: { fontWeight: 700, fontSize: 18 } }}
    >
      <PickerBody onPicked={onClose} />
    </Modal>
  );
}
