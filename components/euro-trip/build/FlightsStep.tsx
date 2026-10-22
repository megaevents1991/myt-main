"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DollarSign, Plane, ShieldCheck, Star, TrainFront, type LucideIcon } from "lucide-react";

import { FlightLoadingTransition } from "@/components/ui/FlightLoadingTransition";
import { OrderIssueState } from "@/components/ui/OrderIssueState";
import type { ItineraryFlight } from "@/lib/app.types";
import { moves, trainLegs, tripLegs } from "@/lib/itinerary/dates";
import type { FlightLeg } from "@/lib/itinerary/flightOffers";
import {
  FLIGHTS_PAGE,
  basePerTraveller,
  canSearch,
  cardRows,
  pricedFlight,
  searchKey,
  searchOutcome,
  searchView,
  sortFlights,
  tabTags,
  trainBackOffered,
  trainCallout,
  type FlightSort,
  type SearchView,
} from "@/lib/itinerary/flightsView";
import type { TrainLeg } from "@/lib/itinerary/types";
import { cn } from "@/lib/utils";
import { ItineraryFlightCard } from "./ItineraryFlightCard";
import { useItinerary } from "./ItineraryProvider";
import { PanelTitle, ShowMore } from "./parts";
import { TripDatesPicker, type TripDatesPickerHandle } from "./TripDatesPicker";

/** A change of legs / party waits this long before it searches (the previous search is aborted). */
const SEARCH_DEBOUNCE_MS = 400;
/** Amadeus throttled us: one more try after this long. */
const BUSY_RETRY_MS = 2500;
/** A search answer is reused for its own (legs, party) this long - the order flow's hold. */
const ANSWER_TTL_MS = 15 * 60_000;
/** Answers kept: enough for a train switch flipped back and forth. */
const ANSWERS_KEPT = 6;
/** No direct-only filter in phase 1. */
const NON_STOP = false;
/** Where the trip's dates change: the field over the list (TripDatesPicker). */
const DATES_FIELD_HINT = 'שנו את התאריכים בשדה "ובאיזה תאריכים?" למעלה';

/**
 * Search answers by `searchKey`, outside React: the step unmounts when the customer goes back
 * to the tickets, and coming forward again with the same legs and party must not search again.
 * Only an answer for the SAME key is ever reused, and only one with flights (an empty answer is
 * asked again - a seat may have opened).
 */
const answers = new Map<string, { flights: ItineraryFlight[]; at: number }>();
const freshAnswer = (key: string): ItineraryFlight[] | null => {
  const a = answers.get(key);
  return a && Date.now() - a.at < ANSWER_TTL_MS ? a.flights : null;
};
const keepAnswer = (key: string, flights: ItineraryFlight[]) => {
  answers.delete(key);
  answers.set(key, { flights, at: Date.now() });
  while (answers.size > ANSWERS_KEPT) answers.delete(answers.keys().next().value as string);
};

type SearchResult = { key: string; view: SearchView; flights: ItineraryFlight[] };
type StepView = SearchView | "loading" | "unsearchable";

/**
 * One search per (legs, party): debounced, the previous one aborted, a 429 retried once.
 * `onFresh` runs when a NEW answer lands (not a kept one) - its flight ids are new.
 */
function useFlightSearch(legs: FlightLeg[], pax: number, searchable: boolean, onFresh: () => void) {
  const key = searchable ? searchKey(legs, pax, NON_STOP) : null;
  const [result, setResult] = useState<SearchResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const onFreshRef = useRef(onFresh);
  useLayoutEffect(() => {
    onFreshRef.current = onFresh;
  });

  useEffect(() => {
    if (!key) return;
    const kept = freshAnswer(key);
    if (kept) {
      setResult({ key, view: "ok", flights: kept });
      return;
    }
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async (retried: boolean) => {
      let status = 0;
      let body: unknown = null;
      try {
        const res = await fetch("/api/itinerary/flights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ legs, adults: pax, nonStop: NON_STOP }),
          signal: ctrl.signal,
        });
        status = res.status;
        body = await res.json().catch(() => null);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        console.error("[EuroTrip] Flight search failed:", err);
      }
      if (ctrl.signal.aborted) return;
      const outcome = searchOutcome(status, body);
      const view = searchView(outcome, retried);
      if (view === "retrying") {
        setResult({ key, view, flights: [] });
        timer = setTimeout(() => void run(true), BUSY_RETRY_MS);
        return;
      }
      const flights = outcome.kind === "ok" ? outcome.flights : [];
      if (outcome.kind === "ok") keepAnswer(key, flights);
      if (outcome.kind === "ok" || outcome.kind === "empty") onFreshRef.current();
      setResult({ key, view, flights });
    };
    timer = setTimeout(() => void run(false), SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // `key` is made of `legs` and `pax`: a new key is a new search, the same key is not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  let view: StepView = "loading";
  let flights: ItineraryFlight[] = [];
  if (!key) {
    view = "unsearchable";
  } else if (result?.key === key) {
    view = result.view;
    flights = result.flights;
  } else {
    // Between a change of key and its effect: a kept answer shows at once.
    const kept = freshAnswer(key);
    if (kept) {
      view = "ok";
      flights = kept;
    }
  }

  return {
    key,
    view,
    flights,
    retry: () => {
      setResult(null);
      setAttempt((a) => a + 1);
    },
  };
}

const SORT_TABS: { key: FlightSort; title: string; sub: string; Icon: LucideIcon }[] = [
  { key: "best", title: "הטוב ביותר", sub: "ערך מיטבי לכסף", Icon: Star },
  { key: "cheapest", title: "הזול ביותר", sub: "המחיר הנמוך ביותר", Icon: DollarSign },
  { key: "israeli", title: "ישראלי", sub: "חברות תעופה ישראליות", Icon: ShieldCheck },
];

/** הטוב ביותר / הזול ביותר / ישראלי - the live flight step's tabs (cards on desktop, pills on a phone). */
function SortTabs({ value, onChange }: { value: FlightSort; onChange: (s: FlightSort) => void }) {
  return (
    <>
      <div className="hidden gap-3 lg:grid lg:grid-cols-3" role="tablist" aria-label="מיון טיסות">
        {SORT_TABS.map(({ key, title, sub, Icon }) => {
          const active = value === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(key)}
              className={cn(
                "flex items-center gap-3 rounded-md border-[1.5px] px-4 py-3 text-start outline-none transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest dark:focus-visible:outline-glow",
                active ? "border-main bg-main/10 dark:border-foreground/40" : "border-border bg-card hover:border-main",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
                  active ? "bg-main dark:bg-foreground" : "bg-muted",
                )}
              >
                <Icon
                  className={cn("size-[18px]", active ? "text-white dark:text-background" : "text-muted-foreground")}
                  strokeWidth={1.8}
                  aria-hidden
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-bold text-foreground">{title}</span>
                <span className="mt-0.5 text-[11px] text-muted-foreground">{sub}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div
        role="tablist"
        aria-label="מיון טיסות"
        className="flex min-w-0 gap-[2px] rounded-md border border-border bg-card p-[3px] lg:hidden"
      >
        {SORT_TABS.map(({ key, title, Icon }) => {
          const active = value === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(key)}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded px-1 py-2 leading-tight transition-colors",
                active ? "bg-main dark:bg-foreground" : "hover:bg-muted",
              )}
            >
              <Icon
                className={cn("size-3.5 shrink-0", active ? "text-white dark:text-background" : "text-muted-foreground")}
                strokeWidth={1.8}
                aria-hidden
              />
              <span
                className={cn(
                  "whitespace-nowrap text-[11px] font-bold",
                  active ? "text-white dark:text-background" : "text-foreground",
                )}
              >
                {title}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/** The price of the chosen flight is being checked (`key` = the search it came from). */
type PickState = { key: string; id: string; status: "pricing" | "failed" };

/**
 * "Build Your Euro Trip" - the flights step: ONE multi-city search for the whole trip
 * (TLV -> first city -> ... -> TLV), a card per offer with every leg, and the switch that
 * turns a between-cities flight into the customer's own train (the search runs again as an
 * open jaw). A pick is priced through `/api/flights/pricing` (as the order summary does)
 * before it becomes the trip's flight.
 */
export function FlightsStep() {
  const api = useItinerary();
  const { state, toggleTrain, setDates } = api;
  const { route, dates, pax, train } = state;

  // Callbacks that run after a fetch read the provider through a ref (its actions are re-made per render).
  const latest = useRef(api);
  useLayoutEffect(() => {
    latest.current = api;
  });

  const trainSet = useMemo(() => new Set(train), [train]);
  const allLegs = useMemo(() => tripLegs(route, dates, new Set()), [route, dates]);
  const flown = useMemo(() => tripLegs(route, dates, trainSet), [route, dates, trainSet]);
  // Every move as a train between its stays: the names and km the switch and the train row show.
  const hops = useMemo(
    () => new Map(trainLegs(route, dates, new Set(moves(route).map((m) => m.key))).map((t): [string, TrainLeg] => [t.key, t])),
    [route, dates],
  );
  const legs = useMemo<FlightLeg[]>(() => flown.map(({ from, to, date }) => ({ from, to, date })), [flown]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const searchable = route.length >= 2 && canSearch(legs, pax, todayIso);

  // A new answer has new flight ids: a flight picked from an older one no longer points into the list.
  const search = useFlightSearch(legs, pax, searchable, () => {
    if (latest.current.state.flight) latest.current.setFlight(null);
  });

  const [sort, setSort] = useState<FlightSort>("best");
  const [page, setPage] = useState({ at: "", count: FLIGHTS_PAGE });
  const [pick, setPick] = useState<PickState | null>(null);
  const pricing = useRef<AbortController | null>(null);

  // A new search (or leaving the step) drops a price check on its way - and what it showed: a
  // card left spinning would still spin when a kept answer brings the same key back.
  useEffect(
    () => () => {
      pricing.current?.abort();
      pricing.current = null;
      setPick(null);
    },
    [search.key],
  );

  const flights = search.flights;
  const sorted = useMemo(() => sortFlights(flights, sort), [flights, sort]);
  const { bestId, cheapestId } = useMemo(() => tabTags(flights, sort), [flights, sort]);
  const base = useMemo(() => basePerTraveller(flights, pax), [flights, pax]);

  const callout = useMemo(
    () => trainCallout(flown.flatMap((l) => (l.kind === "mid" && l.key && hops.get(l.key) ? [hops.get(l.key) as TrainLeg] : []))),
    [flown, hops],
  );

  const choose = async (f: ItineraryFlight) => {
    const key = search.key;
    if (!key) return;
    pricing.current?.abort();
    const ctrl = new AbortController();
    pricing.current = ctrl;
    setPick({ key, id: f.id, status: "pricing" });
    let status = 0;
    let body: unknown = null;
    try {
      // The order summary's call (app/order/OrderForm.tsx): the whole offer, whatever its legs.
      const res = await fetch("/api/flights/pricing", {
        method: "POST",
        body: JSON.stringify({ flightOffer: f.offer, virtual: false, eventId: route[0]?.id, fareUpgraded: false }),
        signal: ctrl.signal,
      });
      status = res.status;
      body = await res.json().catch(() => null);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      console.error("[EuroTrip] Flight pricing failed:", err);
    }
    if (ctrl.signal.aborted) return;
    pricing.current = null;
    const priced = pricedFlight(f, status, body, trainLegs(route, dates, trainSet));
    if (!priced) {
      setPick({ key, id: f.id, status: "failed" });
      return;
    }
    setPick(null);
    latest.current.setFlight(priced);
  };

  const pickNow = pick && pick.key === search.key ? pick : null;
  const selectedId = state.flight?.id;

  // "הצג עוד" counts per (search, tab), and never hides the flight already chosen.
  const pageAt = `${search.key}|${sort}`;
  const count = page.at === pageAt ? page.count : FLIGHTS_PAGE;
  const selectedAt = selectedId ? sorted.findIndex((f) => f.id === selectedId) : -1;
  const visible = sorted.slice(0, Math.max(count, selectedAt + 1));

  // The dates are changed in the field over the list: the empty states' button opens it.
  const datesField = useRef<TripDatesPickerHandle>(null);
  const toDates = () => datesField.current?.open();

  let body: ReactNode;
  switch (search.view) {
    case "loading":
    case "retrying":
      body = (
        <FlightLoadingTransition
          className="min-h-72 translate-y-0 sm:translate-y-0 lg:translate-y-0"
          title={search.view === "retrying" ? "עומס זמני, מנסים שוב…" : "מחפשים טיסות לכל המסלול"}
          subtitle={search.view === "retrying" ? "עוד כמה שניות" : `${legs.length} טיסות בחיפוש אחד - כמה שניות`}
        />
      );
      break;
    case "unsearchable":
    case "invalid":
      body = (
        <OrderIssueState
          title="אי אפשר לחפש טיסות לתאריכים האלה"
          subtitle={DATES_FIELD_HINT}
          onRetry={toDates}
          retryLabel="לשינוי התאריכים"
        />
      );
      break;
    case "empty":
      body = (
        <OrderIssueState
          title="לא מצאנו טיסות לתאריכים האלה - נסו להזיז יום"
          subtitle={DATES_FIELD_HINT}
          onRetry={toDates}
          retryLabel="לשינוי התאריכים"
        />
      );
      break;
    case "busy":
      body = (
        <OrderIssueState
          variant="error"
          title="עומס זמני על חיפוש הטיסות"
          subtitle="נסו שוב בעוד רגע."
          onRetry={search.retry}
        />
      );
      break;
    case "error":
      body = (
        <OrderIssueState
          variant="error"
          title="אופס, חיפוש הטיסות נתקע לרגע"
          subtitle="משהו השתבש בדרך. נסו שוב בעוד רגע."
          onRetry={search.retry}
          whatsAppText="היי, ניסיתי לחפש טיסות לטיול של כמה אירועים באתר וקיבלתי שגיאה. אשמח לעזרה :)"
        />
      );
      break;
    case "ok":
      body = (
        <>
          <SortTabs value={sort} onChange={setSort} />
          {sorted.length === 0 ? (
            <OrderIssueState
              className="mt-2"
              title="אין טיסות של חברות תעופה ישראליות לתאריכים האלה"
              subtitle="בטאב 'הטוב ביותר' מחכות כל שאר הטיסות."
            />
          ) : (
            <div role="region" aria-label="רשימת טיסות למסלול" className="flex flex-col gap-3">
              {visible.map((f) => (
                <ItineraryFlightCard
                  key={f.id}
                  flight={f}
                  pax={pax}
                  rows={cardRows(allLegs, f.legs, trainSet)}
                  hops={hops}
                  basePrice={base ?? f.price / pax}
                  selected={f.id === selectedId}
                  pricing={pickNow?.id === f.id && pickNow.status === "pricing"}
                  failed={pickNow?.id === f.id && pickNow.status === "failed"}
                  isBest={f.id === bestId}
                  isCheapest={f.id === cheapestId}
                  onSelect={(chosen) => void choose(chosen)}
                  onToggleTrain={toggleTrain}
                />
              ))}
              <ShowMore
                hidden={sorted.length - visible.length}
                onClick={() => setPage({ at: pageAt, count: visible.length + FLIGHTS_PAGE })}
              />
            </div>
          )}
        </>
      );
      break;
  }

  return (
    <section aria-labelledby="trip-flights-title" className="mx-auto flex w-full max-w-4xl flex-col gap-3">
      <div className="flex flex-col gap-1">
        <PanelTitle>
          <span id="trip-flights-title">טיסות לכל המסלול</span>
        </PanelTitle>
        <p className="m-0 text-sm text-muted-foreground">
          {legs.length} טיסות · {pax === 1 ? "נוסע אחד" : `${pax} נוסעים`} · המחירים לנוסע
        </p>
      </div>
      {/* The trip's dates are set HERE, in trip order: a new set clears the flight and searches again. */}
      <TripDatesPicker ref={datesField} route={route} dates={dates} train={trainSet} onCommit={setDates} />
      {callout && (
        <div className="flex items-start gap-2.5 rounded-xl border border-brand-aqua/40 bg-brand-aqua/10 px-3.5 py-3 text-sm leading-relaxed text-foreground">
          <TrainFront className="mt-0.5 size-4 shrink-0 text-forest dark:text-brand-aqua" aria-hidden />
          <p className="m-0">
            <b>{callout.lead}</b> {callout.text}
          </p>
        </div>
      )}
      {body}
      {trainBackOffered(search.view, train) && (
        // The "אגיע עצמאית" switch lives on the cards: with none on screen, this is the way back.
        <button
          type="button"
          onClick={() => {
            for (const key of train) toggleTrain(key);
          }}
          className="mx-auto flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest dark:focus-visible:outline-glow"
        >
          <Plane className="size-4" aria-hidden />
          חזרה לטיסה בין הערים
        </button>
      )}
    </section>
  );
}
