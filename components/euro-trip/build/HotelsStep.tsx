"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { BedDouble, Check, CircleAlert, Plane } from "lucide-react";

import { OrderContext } from "@/app/app.context";
import { HotelFetchProvider } from "@/app/hooks/HotelFetch.provider";
import { HotelSelection } from "@/app/order/HotelSelection";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Event, Flight, OrderHotel } from "@/lib/app.types";
import { dayMonth, stayCityName } from "@/lib/itinerary/builder";
import { stays } from "@/lib/itinerary/dates";
import { dayDiff } from "@/lib/itinerary/geo";
import {
  hotelGuests,
  hotelOnStayDates,
  sameHotel,
  stayEvent,
  stayFlight,
  stayHotelRange,
  stayHotelReady,
  withStayBase,
  type StayRange,
} from "@/lib/itinerary/stayAdapter";
import type { Stay } from "@/lib/itinerary/types";
import { cn } from "@/lib/utils";
import { useItinerary } from "./ItineraryProvider";
import { adapterForStay, type HotelStepCallbacks } from "./orderContextAdapter";
import { ADD_BUTTON, PanelTitle, nightsLabel } from "./parts";

const tabId = (stayKey: string) => `trip-hotels-tab-${stayKey}`;
const panelId = (stayKey: string) => `trip-hotels-panel-${stayKey}`;

/** One stay as the step shows it: the event and flight its hotel step reads, and the range that opens. */
type StayView = {
  stay: Stay;
  /** "פריז" - the city the stay sleeps in. */
  city: string;
  event: Event;
  flight: Flight;
  /** Check-in / check-out the live step opens on (`getDefaultDateRange`), `YYYY-MM-DD`. */
  range: StayRange;
  /** A pane is mounted per stay AND what it searches: other dates or party = a new search. */
  paneKey: string;
};

/** "לאורח אחד" / "ל-N אורחים". */
const guestsLabel = (n: number): string => (n === 1 ? "לאורח אחד" : `ל-${n} אורחים`);

/**
 * Why a picked hotel does not count for its stay (`stayHotelReady`): booked for other nights
 * (the step's date picker) or for another party (its rooms popover). Null = nothing to say.
 */
function pickIssue(hotel: OrderHotel | undefined, view: StayView, pax: number): string | null {
  if (!hotel) return null;
  const parts: string[] = [];
  if (!hotelOnStayDates(hotel, view.range)) {
    parts.push(
      `המלון נבחר ל-${dayMonth(hotel.checkin)}–${dayMonth(hotel.checkout)}, והלינה ב${view.city} במסלול היא ${dayMonth(view.range[0])}–${dayMonth(view.range[1])}.`,
    );
  }
  const guests = hotelGuests(hotel);
  if (guests !== pax) parts.push(`המלון נבחר ${guestsLabel(guests)}, והטיול ${pax === 1 ? "לנוסע אחד" : `ל-${pax} נוסעים`}.`);
  return parts.length ? `${parts.join(" ")} החזירו את החיפוש לתאריכים ולמספר הנוסעים של הטיול כדי להמשיך.` : null;
}

/**
 * One stay's hotel step: the order flow's own HotelSelection, unchanged, in its own
 * HotelFetchProvider (one search result per stay) and reading this stay's slice of the trip
 * through an OrderContext adapter. Mounted once per stay visit and kept mounted (hidden) after,
 * so coming back to a city spends no hotel search.
 */
function StayHotelPane({ view }: { view: StayView }) {
  const api = useItinerary();
  const { pax, hotels } = api.state;
  const stayKey = view.stay.key;
  const hotel = hotels[stayKey];

  // The callback keeps its identity for the pane's life (see adapterForStay), so it reads the
  // provider through a ref; the provider's actions themselves are re-made per render.
  const latest = useRef(api);
  useLayoutEffect(() => {
    latest.current = api;
  });
  const [cb] = useState<HotelStepCallbacks>(() => ({
    setHotel: (h) => {
      const now = latest.current;
      // The step writes its pick from more than one place (the search's auto-pick, then the
      // selected card's commit), often unchanged: a write that changes nothing is not stored.
      if (sameHotel(now.state.hotels[stayKey], h)) return;
      now.setHotel(stayKey, h);
    },
  }));
  const value = useMemo(
    () => adapterForStay({ event: view.event, city: view.stay.city, flight: view.flight, hotel, pax }, cb),
    [view.event, view.stay.city, view.flight, hotel, pax, cb],
  );
  const issue = pickIssue(hotel, view, pax);

  return (
    <>
      {issue && (
        <div
          role="status"
          className="mb-3 flex items-start gap-3 rounded-xl border border-badge-vip/60 bg-badge-vip/20 px-4 py-3 text-sm font-semibold text-foreground"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="flex-1">{issue}</span>
        </div>
      )}
      <HotelFetchProvider>
        <OrderContext.Provider value={value}>
          <HotelSelection />
        </OrderContext.Provider>
      </HotelFetchProvider>
    </>
  );
}

/** The stays as tabs: "מלון ב{city}", "DD/MM–DD/MM · N לילות", and a check once its hotel is ready (`stayHotelReady`). */
function StayTabs({
  views,
  active,
  isDone,
  onSelect,
}: {
  views: StayView[];
  active: number;
  isDone: (v: StayView) => boolean;
  onSelect: (i: number) => void;
}) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  // The tab pattern's keys, manual activation: the arrows (RTL: the next tab is the one to the
  // left), Home and End move the focus only - opening a tab spends a hotel search for a city
  // not opened yet, so that waits for Enter / Space (the button's own click).
  const onKeyDown = (ev: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = views.length;
    const to =
      ev.key === "ArrowLeft"
        ? (i + 1) % n
        : ev.key === "ArrowRight"
          ? (i - 1 + n) % n
          : ev.key === "Home"
            ? 0
            : ev.key === "End"
              ? n - 1
              : -1;
    if (to < 0) return;
    ev.preventDefault();
    tabs.current[to]?.focus();
  };

  return (
    <div role="tablist" aria-label="המלונות בטיול" className="flex gap-2">
      {views.map((v, i) => {
        const selected = i === active;
        const done = isDone(v);
        return (
          <button
            key={v.stay.key}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabId(v.stay.key)}
            aria-selected={selected}
            aria-controls={panelId(v.stay.key)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(i)}
            onKeyDown={(ev) => onKeyDown(ev, i)}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl border bg-card px-2 py-2.5 text-center shadow-sm transition-colors sm:flex-row sm:gap-3 sm:px-3 sm:text-start",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest dark:focus-visible:outline-glow",
              selected
                ? "border-forest ring-1 ring-forest dark:border-glow dark:ring-glow"
                : "border-border hover:bg-foreground/[0.03]",
            )}
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-forest md:size-12 dark:text-glow"
              aria-hidden
            >
              <BedDouble className="size-5 md:size-6" />
            </span>
            <span className="flex w-full min-w-0 flex-col">
              <span className="truncate text-sm font-bold leading-tight">מלון ב{v.city}</span>
              <span className="truncate text-xs tabular-nums text-muted-foreground">
                {dayMonth(v.range[0])}–{dayMonth(v.range[1])} · {nightsLabel(dayDiff(v.range[0], v.range[1]))}
              </span>
            </span>
            {done && (
              <span className="absolute end-1.5 top-1.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-forest text-white sm:static sm:size-6 dark:bg-glow dark:text-black">
                <Check className="size-3.5 sm:size-4" aria-hidden />
                <span className="sr-only">מלון נבחר</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * "Build Your Euro Trip" - the hotels step: one tab per stay (consecutive events in one city
 * share it), each the live order flow's hotel step (search, sort, filters, HotelCard, sellable
 * rates, the supplier's limit handling) for that city and those nights.
 *
 * RateHawk allows 10 searches a minute for the whole account, shared with the live site, so a
 * city is searched only when its tab is open on screen: the open stay's pane is mounted, a stay
 * opened before stays mounted but hidden (its search and pick kept), a stay never opened is not
 * mounted at all. Nothing is searched ahead.
 *
 * `shown` = the hotels step is the step on screen. The flow keeps this step mounted (hidden)
 * while the trip has its flight (ItineraryFlow), so a visit to the summary or an earlier step
 * and back finds every opened city as it was - its search, the customer's pick, rate and
 * filters - with no new search. Hidden, nothing new mounts.
 */
export function HotelsStep({ shown = true }: { shown?: boolean }) {
  const { state, setActiveStay, goStep } = useItinerary();
  const { route, dates, flight, hotels, pax, train } = state;

  const views = useMemo<StayView[]>(() => {
    if (!flight || !route.length) return [];
    const trainSet = new Set(train);
    return stays(route, dates).map((stay, i) => {
      const lodging = stayEvent(stay.events[0], stay.city);
      const f = stayFlight(i, flight, route, dates, trainSet);
      const range = stayHotelRange(lodging, f);
      return {
        stay,
        city: stayCityName(stay.events[0]),
        // The step's "included" line, measured against the package base for THESE nights.
        event: withStayBase(lodging, range),
        flight: f,
        range,
        paneKey: `${stay.key}|${range[0]}|${range[1]}|${pax}`,
      };
    });
  }, [flight, route, dates, train, pax]);

  const active = Math.min(Math.max(0, state.activeStay), Math.max(0, views.length - 1));
  const activeKey = views[active]?.paneKey;
  // Panes opened while the step was on screen (their search is done - keep them).
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    if (!activeKey || !shown) return;
    setOpened((prev) => (prev.has(activeKey) ? prev : new Set(prev).add(activeKey)));
  }, [activeKey, shown]);

  // The live step's date field opens a "רוצים תאריכים אחרים?" tooltip that only a press outside
  // it closes (Mantine useClickOutside on mousedown), and it is portalled out of the hidden
  // pane. A switch made by mouse makes that press; one made from the keyboard (a tab, the
  // continue bar, a slot) left it on screen in the page's corner - over another city or another
  // step. Press outside once, as the mouse would have.
  const onScreen = `${shown ? active : "hidden"}`;
  const lastOnScreen = useRef(onScreen);
  useEffect(() => {
    if (lastOnScreen.current === onScreen) return;
    lastOnScreen.current = onScreen;
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  }, [onScreen]);

  if (!flight) {
    if (!shown) return null;
    // The hotels' dates come from the flight (a change of party or dates drops it).
    return (
      <EmptyState
        icon={<Plane className="size-7" aria-hidden />}
        title="קודם בוחרים טיסה"
        description="תאריכי המלונות נקבעים לפי הטיסות. בחרו טיסה לכל המסלול ונמשיך למלונות."
        action={
          <button type="button" onClick={() => goStep("flights")} className={ADD_BUTTON}>
            לבחירת טיסה
          </button>
        }
      />
    );
  }
  if (!views.length) return null;

  const isDone = (v: StayView) => stayHotelReady(hotels[v.stay.key], v.range, pax);
  const doneCount = views.filter(isDone).length;

  return (
    <section
      aria-labelledby="trip-hotels-title"
      // `hidden` alone loses to `.flex` (author CSS beats the [hidden] rule) - the class hides it.
      className={cn("flex flex-col gap-3", !shown && "hidden")}
      hidden={!shown}
    >
      <div className="flex flex-col gap-1">
        <PanelTitle>
          <span id="trip-hotels-title">מלון בכל עיר</span>
        </PanelTitle>
        <p className="m-0 text-sm text-muted-foreground">
          {views.length === 1 ? "מלון אחד" : `${views.length} מלונות`} לפי תאריכי הטיסות, עיר אחרי עיר · {doneCount}{" "}
          מתוך {views.length} נבחרו
        </p>
      </div>
      <StayTabs views={views} active={active} isDone={isDone} onSelect={setActiveStay} />
      {views.map((v, i) => {
        const open = i === active;
        // Mounted = searched: only for the tab open on screen, or a pane opened before.
        const mounted = (shown && open) || opened.has(v.paneKey);
        return (
          <div
            key={v.stay.key}
            role="tabpanel"
            id={panelId(v.stay.key)}
            aria-labelledby={tabId(v.stay.key)}
            hidden={!open}
          >
            {mounted && <StayHotelPane key={v.paneKey} view={v} />}
          </div>
        );
      })}
    </section>
  );
}
