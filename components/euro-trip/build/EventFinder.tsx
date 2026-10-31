"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { eventCityName } from "@/lib/events/lodging";
import {
  catalogCities,
  catalogItems,
  catalogMonths,
  dayMonth,
  filterCatalog,
  fittingItems,
  hasTripPartner,
  isBrowsing,
  quickFiltered,
  starterEvents,
  topCities,
  type CatalogFilter,
  type CatalogItem,
  type CatalogKind,
  type QuickFilter,
} from "@/lib/itinerary/builder";
import { eventDay } from "@/lib/itinerary/geo";
import { cn } from "@/lib/utils";
import { useItinerary } from "./ItineraryProvider";
import { EventSearchBar, LIST_PAGE, ShowMore, chip } from "./parts";
import { TripEventArt } from "./TripEventArt";

const NO_FILTER: CatalogFilter = { query: "", month: "", kind: "all", city: "" };

/** Suggestions shown before "הצג עוד": two rows of the planner's grid, a short list in the popup. */
const SUGGEST_PAGE = 6;
/** City chips under "מאיפה מתחילים?": one row that scrolls sideways (Dor 31.10). */
const START_CITIES = 14;
/** "רוצה לשלב עם": what the customer may look for next. */
const QUICK_KINDS: { value: CatalogKind; label: string }[] = [
  { value: "music", label: "הופעה" },
  { value: "football", label: "כדורגל" },
];
const NO_QUICK: QuickFilter = { kind: "all", sameCity: false };

function FinderHeading({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="m-0 font-display text-lg font-extrabold leading-tight">{children}</h3>
      {sub && <p className="m-0 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** What the trip holds so far, at the head of the popup: the customer remembers what they took. */
function PickedEvents() {
  const { state } = useItinerary();
  return (
    <div className="flex flex-col gap-1.5">
      <p className="m-0 text-sm font-bold text-muted-foreground">בטריפ שלכם עד עכשיו</p>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {state.route.map((e) => (
          <li key={e.id} className="flex items-center gap-2.5 rounded-xl border border-primary/60 bg-primary/[0.08] px-2 py-1.5">
            <TripEventArt event={e} sizes="36px" className="size-9 shrink-0 rounded-full border-2 border-white" />
            <span className="flex min-w-0 flex-col leading-tight">
              <b className="truncate text-sm">{e.name}</b>
              <span className="text-xs text-muted-foreground">
                <span className="tabular-nums">{dayMonth(eventDay(e))}</span> · {eventCityName(e)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Finding the next event of the trip - the planner's main column and the "הוסף אירוע" popup alike
 * (Alon + Dor 28.10: "לזרוק עליו את כל האירועים זה מבלבל ... מנוע חיפוש וכל הפילטרים במין כפתור
 * פילטר").
 * - Empty trip: the search bar (`EventSearchBar`, the filters behind its "סינון" button), "מאיפה
 *   מתחילים?" - the busiest cities in one sideways row - and the site's most wanted events
 *   (`starterEvents`) that can make a trip. An event nothing can join says so on its row.
 * - An event in the trip (Dor 31.10: usually 20-30 fit, so no open search): "מה עוד מתאים לטריפ" -
 *   only what can join, best fit first (`fittingItems`) - under "רוצה לשלב עם: הופעה | כדורגל" and
 *   "באותה עיר"; a search icon opens the bar for anything else.
 * - Searching (a word or a filter): every match, the fitting ones first (`catalogItems`).
 * The caller draws the events (`renderItems`): cards in the planner, rows in the popup.
 */
export function EventFinder({
  renderItems,
  hideInRoute = false,
  full = false,
  autoFocus = false,
  barClassName,
  searchClassName,
}: {
  renderItems: (items: CatalogItem[], labelled: boolean) => ReactNode;
  /** The popup lists only events to add; the planner's grid also shows the route's own (to remove). */
  hideInRoute?: boolean;
  /** The trip holds `max_events`: suggestions give way to a line saying so. */
  full?: boolean;
  autoFocus?: boolean;
  barClassName?: string;
  searchClassName?: string;
}) {
  const { state, catalog, settings } = useItinerary();
  const { route } = state;
  const [filter, setFilter] = useState<CatalogFilter>(NO_FILTER);
  const [visible, setVisible] = useState(LIST_PAGE);
  const [suggested, setSuggested] = useState(SUGGEST_PAGE);
  const [quick, setQuick] = useState<QuickFilter>(NO_QUICK);
  const [searchOpen, setSearchOpen] = useState(false);
  const months = useMemo(() => catalogMonths(catalog), [catalog]);
  const cities = useMemo(() => catalogCities(catalog), [catalog]);
  const browsing = isBrowsing(filter);
  const labelled = route.length > 0;

  const results = useMemo(() => {
    if (browsing) return [];
    const all = catalogItems(route, filterCatalog(catalog, filter), settings);
    return hideInRoute ? all.filter((i) => !i.inRoute) : all;
  }, [browsing, route, catalog, filter, settings, hideInRoute]);
  const allFits = useMemo(
    () => (browsing && route.length ? fittingItems(catalogItems(route, catalog, settings), route) : []),
    [browsing, route, catalog, settings],
  );
  const fits = useMemo(() => quickFiltered(allFits, route, quick), [allFits, route, quick]);
  // A first pick nothing can join leads nowhere: not suggested, and said on its row when searched.
  const starters = useMemo(() => {
    if (!browsing || route.length) return [];
    const open = starterEvents(catalog, SUGGEST_PAGE * 4).filter((e) => hasTripPartner(e, catalog, settings));
    return catalogItems(route, open.slice(0, SUGGEST_PAGE), settings);
  }, [browsing, route, catalog, settings]);
  const shownResults = useMemo(() => {
    const page = results.slice(0, visible);
    return route.length ? page : page.map((i) => ({ ...i, lonely: !hasTripPartner(i.event, catalog, settings) }));
  }, [results, visible, route, catalog, settings]);
  const startCities = useMemo(() => topCities(catalog, START_CITIES), [catalog]);

  /** A narrower search shows its results from the top. */
  const update = (patch: Partial<CatalogFilter>) => {
    setFilter((f) => ({ ...f, ...patch }));
    setVisible(LIST_PAGE);
  };

  let body: ReactNode;
  if (!browsing) {
    body = results.length ? (
      <div className="flex flex-col gap-2">
        <p className="m-0 text-sm text-muted-foreground" role="status">
          {results.length === 1 ? "אירוע אחד" : `${results.length} אירועים`}
        </p>
        {renderItems(shownResults, labelled)}
        <ShowMore hidden={results.length - visible} onClick={() => setVisible((v) => v + LIST_PAGE)} />
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
            ניקוי החיפוש
          </button>
        }
      />
    );
  } else if (!route.length) {
    body = (
      <div className="flex flex-col gap-5">
        {startCities.length > 1 && (
          <div className="flex flex-col gap-2.5">
            <FinderHeading sub="חפשו אמן, קבוצה או עיר - או התחילו מאחת הערים:">מאיפה מתחילים?</FinderHeading>
            <ul className="-mx-4 m-0 flex list-none gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden">
              {startCities.map(({ city, count }) => (
                <li key={city} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => update({ city })}
                    className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-4 text-sm font-bold text-foreground transition-colors hover:border-primary/60 hover:bg-primary/[0.06]"
                  >
                    {city}
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">{count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {starters.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <FinderHeading>המבוקשים ביותר</FinderHeading>
            {renderItems(starters, false)}
          </div>
        )}
      </div>
    );
  } else if (full) {
    body = (
      <p role="status" className="m-0 rounded-2xl border-[1.5px] border-dashed border-border p-4 text-center text-sm font-semibold text-muted-foreground">
        המסלול מלא - הסירו אירוע כדי להחליף
      </p>
    );
  } else {
    body = (
      <div className="flex flex-col gap-2.5">
        <FinderHeading sub="לפי המרחק והתאריכים - המתאים ביותר קודם.">
          מה עוד מתאים לטריפ שלכם
        </FinderHeading>
        {!searchOpen && (
          <div className="flex flex-col gap-1.5" role="group" aria-labelledby="trip-quick-label">
            <span id="trip-quick-label" className="text-sm font-bold">
              רוצה לשלב עם:
            </span>
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {QUICK_KINDS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    aria-pressed={quick.kind === k.value}
                    onClick={() => setQuick((q) => ({ ...q, kind: q.kind === k.value ? "all" : k.value }))}
                    className={chip(quick.kind === k.value)}
                  >
                    {k.label}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={quick.sameCity}
                  onClick={() => setQuick((q) => ({ ...q, sameCity: !q.sameCity }))}
                  className={chip(quick.sameCity)}
                >
                  באותה עיר
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="חיפוש אירוע אחר"
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-foreground/[0.03]"
              >
                <Search className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        )}
        {fits.length ? (
          <>
            <p className="m-0 text-sm text-muted-foreground" role="status">
              {fits.length === 1 ? "אירוע אחד מתאים" : `${fits.length} אירועים מתאימים`}
            </p>
            {renderItems(fits.slice(0, suggested), true)}
            <ShowMore hidden={fits.length - suggested} onClick={() => setSuggested((v) => v + LIST_PAGE)} />
          </>
        ) : (
          <p className="m-0 rounded-2xl border-[1.5px] border-dashed border-border p-4 text-center text-sm font-semibold text-muted-foreground">
            {allFits.length
              ? "אין כרגע אירוע כזה שמתאים לטריפ - נסו בלי הסינון."
              : "לא מצאנו עוד אירוע שמתאים בתאריכים ובמרחק - אפשר לחפש ולראות למה."}
          </p>
        )}
      </div>
    );
  }

  // An event in the trip: the bar waits behind the search icon until it is asked for.
  const barShown = !route.length || searchOpen || !browsing;

  return (
    <div className="flex flex-col gap-4">
      {hideInRoute && route.length > 0 && <PickedEvents />}
      {barShown && (
        <EventSearchBar
          filter={filter}
          onChange={update}
          months={months}
          cities={cities}
          autoFocus={autoFocus && (searchOpen || !route.length)}
          className={barClassName}
          searchClassName={searchClassName}
        />
      )}
      {route.length > 0 && barShown && (
        <button
          type="button"
          onClick={() => {
            update(NO_FILTER);
            setSearchOpen(false);
          }}
          className={cn("w-fit text-sm font-bold text-muted-foreground underline underline-offset-2 hover:text-foreground")}
        >
          חזרה להצעות לטריפ
        </button>
      )}
      {body}
    </div>
  );
}
