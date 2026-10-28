"use client";

import { useMemo, useState, type ReactNode } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import {
  catalogCities,
  catalogItems,
  catalogMonths,
  filterCatalog,
  fittingItems,
  isBrowsing,
  starterEvents,
  topCities,
  type CatalogFilter,
  type CatalogItem,
} from "@/lib/itinerary/builder";
import { useItinerary } from "./ItineraryProvider";
import { EventSearchBar, LIST_PAGE, ShowMore } from "./parts";

const NO_FILTER: CatalogFilter = { query: "", month: "", kind: "all", city: "" };

/** Suggestions shown before "הצג עוד": two rows of the planner's grid, a short list in the popup. */
const SUGGEST_PAGE = 6;
/** City chips under "מאיפה מתחילים?". */
const START_CITIES = 8;

function FinderHeading({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="m-0 font-display text-lg font-extrabold leading-tight">{children}</h3>
      {sub && <p className="m-0 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

/**
 * Finding the next event of the trip - the planner's main column and the "הוסף אירוע" popup alike
 * (Alon + Dor 28.10: "לזרוק עליו את כל האירועים זה מבלבל ... מנוע חיפוש וכל הפילטרים במין כפתור
 * פילטר"). One search bar (`EventSearchBar`, the filters behind its "סינון" button), and below it:
 * - searching (a word or a filter): every match, the fitting ones first (`catalogItems`);
 * - nothing typed, empty trip: "מאיפה מתחילים?" - the busiest cities as one-tap starts and the
 *   site's most wanted events (`starterEvents`);
 * - nothing typed, an event in the trip: "מה עוד מתאים לטריפ" - only the events that can join it,
 *   best fit first (`fittingItems`); the full catalog is never dumped on the customer.
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
  const months = useMemo(() => catalogMonths(catalog), [catalog]);
  const cities = useMemo(() => catalogCities(catalog), [catalog]);
  const browsing = isBrowsing(filter);
  const labelled = route.length > 0;

  const results = useMemo(() => {
    if (browsing) return [];
    const all = catalogItems(route, filterCatalog(catalog, filter), settings);
    return hideInRoute ? all.filter((i) => !i.inRoute) : all;
  }, [browsing, route, catalog, filter, settings, hideInRoute]);
  const fits = useMemo(
    () => (browsing && route.length ? fittingItems(catalogItems(route, catalog, settings)) : []),
    [browsing, route, catalog, settings],
  );
  const starters = useMemo(
    () => (browsing && !route.length ? catalogItems(route, starterEvents(catalog, SUGGEST_PAGE), settings) : []),
    [browsing, route, catalog, settings],
  );
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
        {renderItems(results.slice(0, visible), labelled)}
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
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {startCities.map(({ city, count }) => (
                <li key={city}>
                  <button
                    type="button"
                    onClick={() => update({ city })}
                    className="flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-sm font-bold text-foreground transition-colors hover:border-primary/60 hover:bg-primary/[0.06]"
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
        <FinderHeading sub="לפי המרחק והתאריכים של האירועים שבחרתם - המתאים ביותר קודם.">
          מה עוד מתאים לטריפ שלכם
        </FinderHeading>
        {fits.length ? (
          <>
            {renderItems(fits.slice(0, suggested), true)}
            <ShowMore hidden={fits.length - suggested} onClick={() => setSuggested((v) => v + LIST_PAGE)} />
          </>
        ) : (
          <p className="m-0 rounded-2xl border-[1.5px] border-dashed border-border p-4 text-center text-sm font-semibold text-muted-foreground">
            לא מצאנו עוד אירוע שמתאים בתאריכים ובמרחק - אפשר לחפש למעלה ולראות למה.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <EventSearchBar
        filter={filter}
        onChange={update}
        months={months}
        cities={cities}
        autoFocus={autoFocus}
        className={barClassName}
        searchClassName={searchClassName}
      />
      {body}
    </div>
  );
}
