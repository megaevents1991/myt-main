"use client";

import { Fragment, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/he";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { computePackagePrice } from "@/lib/events/price";
import { eventCityName, placeLabel } from "@/lib/events/lodging";
import {
  catalogItems,
  catalogMonths,
  dayMonth,
  dayMonthYear,
  filterCatalog,
  type CatalogFilter,
  type CatalogItem,
} from "@/lib/itinerary/builder";
import { eventDay } from "@/lib/itinerary/geo";
import { isAddable } from "@/lib/itinerary/rules";
import { MIN_TRIP_EVENTS } from "@/lib/itinerary/state";
import { TripEventArt } from "./TripEventArt";
import { DayPlanner } from "./DayPlanner";
import { useItinerary } from "./ItineraryProvider";
import { ADD_BUTTON, CompatChip, KindTabs, LIST_PAGE, ShowMore } from "./parts";

const SLOT_LABELS = ["אירוע ראשון", "אירוע שני", "אירוע שלישי (לא חובה)"];

/** A slot's label; past the named three (a wider `max_events`) it is numbered, and optional. */
const slotLabel = (i: number): string => SLOT_LABELS[i] ?? `אירוע ${i + 1} (לא חובה)`;

const NO_FILTER: CatalogFilter = { query: "", month: "", kind: "all" };

/** The category hubs' filter chip (components/CategoryEventsBrowser.tsx). */
const chip = (on: boolean) =>
  cn(
    "flex h-10 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-bold transition-colors",
    on
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-foreground hover:bg-foreground/[0.03]",
  );

const monthLabel = (month: string) => dayjs(`${month}-01`).locale("he").format("MMMM YYYY");

/** The picked events, one slot each (1 ← 2 ← 3, the third optional). */
function Tray() {
  const { state, settings, removeEvent } = useItinerary();
  const slots = Array.from({ length: settings.maxEvents }, (_, i) => i);
  return (
    // A column on a phone (a slot keeps a readable width), a row from 640px.
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-1.5" aria-label="המסלול שלכם">
      {slots.map((i) => {
        const e = state.route[i];
        return (
          <Fragment key={i}>
            {i > 0 && (
              <li aria-hidden className="hidden shrink-0 font-black text-forest dark:text-primary sm:block">
                ←
              </li>
            )}
            <li
              className={cn(
                "flex min-h-[62px] min-w-0 items-center gap-2 rounded-2xl border-[1.5px] p-2 text-[13px] sm:flex-1",
                e ? "border-primary/60 bg-primary/[0.08]" : "border-dashed border-border bg-card",
              )}
            >
              {e ? (
                <>
                  <TripEventArt event={e} sizes="44px" className="size-11 shrink-0 rounded-full border-2 border-white" />
                  <div className="flex min-w-0 flex-col leading-tight">
                    <b className="truncate text-[13.5px]">{e.name}</b>
                    <span className="text-[12.5px] text-muted-foreground">
                      <span className="tabular-nums">{dayMonth(eventDay(e))}</span> · {eventCityName(e)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEvent(e.id)}
                    aria-label={`הסרת ${e.name} מהמסלול`}
                    className="ms-auto flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-display text-xs font-black text-foreground">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{slotLabel(i)}</span>
                </>
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

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
 * Self-build mode: a tray of 2-3 slots, the day planner once two are picked, and the whole
 * eligible catalog - search, month, הכל / כדורגל / הופעות - where every card says whether it
 * fits the route (compatible ones first).
 */
export function SelfBuild() {
  const { state, catalog, settings } = useItinerary();
  const [filter, setFilter] = useState<CatalogFilter>(NO_FILTER);
  const [visible, setVisible] = useState(LIST_PAGE);
  const months = useMemo(() => catalogMonths(catalog), [catalog]);
  const items = useMemo(
    () => catalogItems(state.route, filterCatalog(catalog, filter), settings),
    [state.route, catalog, filter, settings],
  );

  /** A narrower filter shows its results from the top. */
  const update = (patch: Partial<CatalogFilter>) => {
    setFilter((f) => ({ ...f, ...patch }));
    setVisible(LIST_PAGE);
  };
  const range = settings.maxEvents > MIN_TRIP_EVENTS ? `${MIN_TRIP_EVENTS}-${settings.maxEvents}` : `${MIN_TRIP_EVENTS}`;
  const full = state.route.length >= settings.maxEvents;

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-lg leading-snug md:text-[19px]">
        בנו מסלול משלכם: <b>בחרו {range} אירועים.</b> אחרי הראשון נסמן כל אירוע - מתאים, או למה לא.
      </p>

      <Tray />
      <DayPlanner />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/30">
          <input
            type="search"
            value={filter.query}
            onChange={(e) => update({ query: e.target.value })}
            placeholder="לאן טסים? אמן, קבוצה או עיר..."
            aria-label="חיפוש אירוע - אמן, קבוצה או עיר"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent px-2 text-base text-foreground placeholder:text-[15px] placeholder:font-medium placeholder:text-muted-foreground focus:outline-none"
          />
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-hidden>
            <Search className="size-5" />
          </span>
        </div>

        {months.length > 1 && (
          <div
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0"
            role="group"
            aria-label="חודש"
          >
            <button type="button" onClick={() => update({ month: "" })} aria-pressed={filter.month === ""} className={chip(filter.month === "")}>
              כל התאריכים
            </button>
            {months.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => update({ month: filter.month === m ? "" : m })}
                aria-pressed={filter.month === m}
                className={chip(filter.month === m)}
              >
                {monthLabel(m)}
              </button>
            ))}
          </div>
        )}

        <KindTabs value={filter.kind} onChange={(kind) => update({ kind })} />
      </div>

      {full && (
        // Said once here, not on every card.
        <p role="status" className="m-0 rounded-2xl border-[1.5px] border-dashed border-border p-4 text-center text-sm font-semibold text-muted-foreground">
          המסלול מלא - הסירו אירוע כדי להחליף
        </p>
      )}

      {items.length ? (
        <div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.slice(0, visible).map((item) => (
              <EventPick key={item.event.id} item={item} labelled={state.route.length > 0} full={full} />
            ))}
          </div>
          <ShowMore hidden={items.length - visible} onClick={() => setVisible((v) => v + LIST_PAGE)} />
        </div>
      ) : (
        <EmptyState
          title="לא מצאנו אירועים לחיפוש הזה"
          description="נסו שם אחר, חודש אחר או את כל האירועים."
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
