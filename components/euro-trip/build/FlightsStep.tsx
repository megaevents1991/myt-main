"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DollarSign, Route, ShieldCheck, Star, TrainFront, type LucideIcon } from "lucide-react";

import { FlightLoadingTransition } from "@/components/ui/FlightLoadingTransition";
import { MemoizedFlightCard } from "@/components/ui/FlightCard";
import { OrderIssueState } from "@/components/ui/OrderIssueState";
import type { ItineraryFlight } from "@/lib/app.types";
import { groundLink, stayCityName } from "@/lib/itinerary/builder";
import { applyDatePick } from "@/lib/itinerary/datePick";
import { moves, stays, trainLegs, tripDateBounds, tripLegs } from "@/lib/itinerary/dates";
import type { FlightLeg } from "@/lib/itinerary/flightOffers";
import { flightPartsOf, partDone, pickFits, type FlightPart } from "@/lib/itinerary/flightParts";
import {
  FLIGHTS_PAGE,
  basePerTraveller,
  canSearch,
  groundNote,
  pricedFlight,
  searchKey,
  searchOutcome,
  searchView,
  sortFlights,
  tabTags,
  trainHours,
  trainNote,
  type FlightSort,
  type SearchView,
} from "@/lib/itinerary/flightsView";
import type { TrainLeg } from "@/lib/itinerary/types";
import { cn } from "@/lib/utils";
import { DateStepper } from "./DateStepper";
import { useItinerary } from "./ItineraryProvider";
import { MoveFlightCard } from "./MoveFlightCard";
import { PanelTitle, ShowMore } from "./parts";
import { SubStepsRow, type SubStepItem } from "./TicketSubSteps";
import { TripDateRange } from "./TripDateRange";

/** A change of legs / party waits this long before it searches (the previous search is aborted). */
const SEARCH_DEBOUNCE_MS = 400;
/** Amadeus throttled us: one more try after this long. */
const BUSY_RETRY_MS = 2500;
/** A search answer is reused for its own (legs, party) this long - the order flow's hold. */
const ANSWER_TTL_MS = 15 * 60_000;
/** Answers kept: every part of a trip, and a date moved back and forth. */
const ANSWERS_KEPT = 10;
/** No direct-only filter in phase 1. */
const NON_STOP = false;
/** Where a part's dates change: the field over its list. */
const DATES_FIELD_HINT = "שנו את התאריך בשדה למעלה";

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

/** The flights step's sub-steps, to a screen reader. */
const PART_WORDS = { done: "נבחרה טיסה", shut: "" };

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
 * One part of the trip's flights: its own search (`useFlightSearch`), its recommended flight
 * arriving picked, and - while it is the part on screen - the regular flow's list: הטוב ביותר /
 * הזול ביותר / ישראלי over the cards. A pick is priced through `/api/flights/pricing` (as the order
 * summary does) before it counts.
 *
 * Mounted from the moment the customer leaves the planner, on screen or not (Dor 31.10: "מחיר מדויק
 * כבר בשלב של בחירת כרטיס 1"): the recommended pick is the price on the continue bar. Off screen it
 * draws nothing.
 */
function PartPane({
  part,
  shown,
  onView,
  children,
}: {
  part: FlightPart;
  shown: boolean;
  /** How this part's search stands (the flow's "still working out the price"). */
  onView: (key: string, searching: boolean) => void;
  /** Over the list: the dates, the train switch. */
  children?: ReactNode;
}) {
  const api = useItinerary();
  const { state } = api;
  const { pax } = state;
  const picked = state.flightParts[part.key];

  // Callbacks that run after a fetch read the provider through a ref (its actions are re-made per render).
  const latest = useRef(api);
  useLayoutEffect(() => {
    latest.current = api;
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const searchable = !part.byTrain && canSearch(part.legs, pax, todayIso);

  // A new answer has new flight ids: a flight picked from an older one no longer points into the list.
  const search = useFlightSearch(part.legs, pax, searchable, () => {
    if (latest.current.state.flightParts[part.key]) latest.current.setFlightPart(part.key, null);
  });

  const [sort, setSort] = useState<FlightSort>("best");
  const [page, setPage] = useState({ at: "", count: FLIGHTS_PAGE });
  const [pick, setPick] = useState<PickState | null>(null);
  const pricing = useRef<AbortController | null>(null);

  // A new search (or leaving for good) drops a price check on its way - and what it showed: a card
  // left spinning would still spin when a kept answer brings the same key back.
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
        body: JSON.stringify({ flightOffer: f.offer, virtual: false, eventId: latest.current.state.route[0]?.id, fareUpgraded: false }),
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
    const priced = pricedFlight(f, status, body, []);
    if (!priced) {
      setPick({ key, id: f.id, status: "failed" });
      return;
    }
    setPick(null);
    latest.current.setFlightPart(part.key, priced);
  };

  const pickNow = pick && pick.key === search.key ? pick : null;
  const selectedId = pickFits(part, picked, pax) ? picked.id : undefined;

  // The recommended flight ("★ הטוב ביותר", the default tab's first) arrives picked while nothing is
  // picked; a customer's own pick or a failed check is never overridden (the card says so, and the
  // next choice is theirs).
  const chooseRef = useRef(choose);
  chooseRef.current = choose;
  useEffect(() => {
    if (search.view !== "ok" || !search.key || selectedId || pick) return;
    const best = sortFlights(flights, "best")[0];
    if (best) void chooseRef.current(best);
  }, [search.view, search.key, flights, selectedId, pick]);

  const searching = !part.byTrain && (search.view === "loading" || search.view === "retrying" || !!pickNow && pickNow.status === "pricing");
  useEffect(() => {
    onView(part.key, searching);
  }, [onView, part.key, searching]);
  useEffect(() => () => onView(part.key, false), [onView, part.key]);

  if (!shown) return null;

  // "הצג עוד" counts per (search, tab), and never hides the flight already chosen.
  const pageAt = `${search.key}|${sort}`;
  const count = page.at === pageAt ? page.count : FLIGHTS_PAGE;
  const chosenId = pickNow?.status === "pricing" ? pickNow.id : selectedId;
  const selectedAt = chosenId ? sorted.findIndex((f) => f.id === chosenId) : -1;
  const visible = sorted.slice(0, Math.max(count, selectedAt + 1));

  let body: ReactNode = null;
  if (!part.byTrain) {
    switch (search.view) {
      case "loading":
      case "retrying":
        body = (
          <FlightLoadingTransition
            className="min-h-72 translate-y-0 sm:translate-y-0 lg:translate-y-0"
            title={search.view === "retrying" ? "עומס זמני, מנסים שוב…" : part.kind === "main" ? "מחפשים טיסות הלוך חזור" : "מחפשים טיסה בין הערים"}
            subtitle={search.view === "retrying" ? "עוד כמה שניות" : "כמה שניות"}
          />
        );
        break;
      case "unsearchable":
      case "invalid":
        body = <OrderIssueState title="אי אפשר לחפש טיסות לתאריכים האלה" subtitle={DATES_FIELD_HINT} />;
        break;
      case "empty":
        body = <OrderIssueState title="לא מצאנו טיסות לתאריכים האלה - נסו להזיז יום" subtitle={DATES_FIELD_HINT} />;
        break;
      case "busy":
        body = (
          <OrderIssueState variant="error" title="עומס זמני על חיפוש הטיסות" subtitle="נסו שוב בעוד רגע." onRetry={search.retry} />
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
            {pickNow?.status === "failed" && part.kind === "main" && (
              <p role="alert" className="m-0 text-center text-sm font-bold text-destructive">
                לא הצלחנו לאמת את הטיסה - נסו שוב או בחרו טיסה אחרת
              </p>
            )}
            {sorted.length === 0 ? (
              <OrderIssueState
                className="mt-2"
                title="אין טיסות של חברות תעופה ישראליות לתאריכים האלה"
                subtitle="בטאב 'הטוב ביותר' מחכות כל שאר הטיסות."
              />
            ) : (
              <div role="region" aria-label="רשימת טיסות" className="flex flex-col gap-6 py-3 lg:gap-4">
                {visible.map((f) =>
                  part.kind === "main" ? (
                    // The regular flow's own card (Dor 31.10: "כרטיס רגיל"): an outbound and an inbound.
                    <MemoizedFlightCard
                      key={f.id}
                      {...f}
                      minPrice={Math.ceil(base ?? f.price / pax)}
                      isLoading={false}
                      price={Math.ceil(f.price / pax)}
                      flightId={f.id}
                      selectedFlightId={chosenId}
                      onClick={(id: string) => {
                        const chosen = flights.find((x) => x.id === id);
                        if (chosen && id !== chosenId) void choose(chosen);
                      }}
                      isBest={f.id === bestId}
                      isCheapest={f.id === cheapestId}
                    />
                  ) : (
                    <MoveFlightCard
                      key={f.id}
                      flight={f}
                      pax={pax}
                      basePrice={base ?? f.price / pax}
                      selected={f.id === selectedId}
                      pricing={pickNow?.id === f.id && pickNow.status === "pricing"}
                      failed={pickNow?.id === f.id && pickNow.status === "failed"}
                      isBest={f.id === bestId}
                      isCheapest={f.id === cheapestId}
                      onSelect={(chosen) => void choose(chosen)}
                    />
                  ),
                )}
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
  }

  return (
    <div className="flex flex-col gap-3">
      {children}
      {body}
    </div>
  );
}

/** "אגיע עצמאית" - a switch: the move leaves the flights (or comes back to them). */
function TrainSwitch({ hop, on, onToggle }: { hop: TrainLeg; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-brand-aqua/40 bg-brand-aqua/10 px-3.5 py-3 text-sm leading-relaxed text-foreground">
      <p className="m-0 flex items-start gap-2.5">
        <TrainFront className="mt-0.5 size-4 shrink-0 text-forest dark:text-brand-aqua" aria-hidden />
        <span>{trainNote(hop)}</span>
      </p>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={cn(
          "inline-flex w-fit items-center gap-2 rounded-full border bg-background py-1 pe-3 ps-1 text-xs font-bold text-foreground transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest dark:focus-visible:outline-glow",
          on ? "border-brand-aqua/60" : "border-border hover:border-forest dark:hover:border-glow",
        )}
      >
        <span aria-hidden className={cn("relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors", on ? "bg-brand-aqua" : "bg-muted")}>
          <span
            className={cn(
              "absolute top-[2px] size-[14px] rounded-full bg-white shadow-sm transition-[inset-inline-start] duration-200",
              on ? "start-[14px]" : "start-[2px]",
            )}
          />
        </span>
        אגיע עצמאית, בלי טיסה
      </button>
      {on && (
        <p className="m-0 text-xs text-muted-foreground">
          בכוחות עצמכם, לא כלול במחיר · כ-{trainHours(hop.km)} שעות
        </p>
      )}
    </div>
  );
}

/**
 * "Build Your Euro Trip" - the flights step, cut like the tickets step (Dor 31.10): a part for the
 * way there and back and one per move between flight cities (`flightPartsOf`), each searched,
 * picked and shown on its own in the regular flow's look; a trip with no move is just the regular
 * step, with no sub-steps at all. A move also offers "אגיע עצמאית" and the train's note. A
 * sub-location (Manchester, from London) has no flight of its own: it says so over the list.
 *
 * `shown` = the flights step is on screen. It is mounted hidden from the moment the planner is left,
 * so the trip's price is real from the first ticket on. `onSearching` tells the flow whether any part
 * is still working on its pick.
 */
export function FlightsStep({
  shown = true,
  onSearching,
}: {
  shown?: boolean;
  onSearching?: (searching: boolean) => void;
}) {
  const { state, setDates, toggleTrain, setActiveFlightPart } = useItinerary();
  const { route, dates, pax, train, flightParts } = state;
  const trainSet = useMemo(() => new Set(train), [train]);
  const parts = useMemo(() => flightPartsOf(route, dates, trainSet), [route, dates, trainSet]);
  const allLegs = useMemo(() => tripLegs(route, dates, new Set()), [route, dates]);
  // Every move as a train between its stays: the names and km its pane shows.
  const hops = useMemo(
    () => new Map(trainLegs(route, dates, new Set(moves(route).map((m) => m.key))).map((t): [string, TrainLeg] => [t.key, t])),
    [route, dates],
  );
  const bounds = useMemo(() => tripDateBounds(route, dates), [route, dates]);
  const active = Math.min(state.activeFlightPart, Math.max(0, parts.length - 1));

  // Which parts are still working (their search or the check of their pick).
  const [working, setWorking] = useState<Record<string, boolean>>({});
  const onView = useMemo(
    () => (key: string, searching: boolean) =>
      setWorking((prev) => (!!prev[key] === searching ? prev : { ...prev, [key]: searching })),
    [],
  );
  const anyWorking = parts.some((p) => working[p.key]);
  useEffect(() => {
    onSearching?.(anyWorking);
  }, [anyWorking, onSearching]);

  const list = useMemo(() => (route.length ? stays(route, dates) : []), [route, dates]);
  const moveCity = (key: string): string => {
    const m = moves(route).find((x) => x.key === key);
    return m ? stayCityName(m.b) : "";
  };
  const items: SubStepItem[] = parts.map((p, i) => {
    const hop = hops.get(p.key);
    return {
      index: i,
      label: p.kind === "main" ? "הלוך חזור" : `מעבר ${i}`,
      name:
        p.kind === "main"
          ? list.length > 1
            ? `ל${stayCityName(list[0].events[0])}, חזרה מ${stayCityName(list[list.length - 1].events[0])}`
            : `ל${stayCityName(route[0])}`
          : hop
            ? `${hop.fromName} ← ${hop.toName}`
            : moveCity(p.key),
      done: partDone(p, flightParts, pax),
      current: i === active,
      enabled: true,
    };
  });

  const notes = [...new Set(route.flatMap((e) => {
    const g = groundLink(e);
    return g ? [groundNote(g)] : [];
  }))];
  const openLeg = allLegs.length;

  return (
    <section
      aria-labelledby="trip-flights-title"
      hidden={!shown}
      className={cn("mx-auto flex w-full max-w-4xl flex-col gap-3", !shown && "hidden")}
    >
      {shown && (
        <>
          <div className="flex flex-col gap-1">
            <PanelTitle>
              <span id="trip-flights-title">{parts.length > 1 ? "טיסות ומעברים" : "טיסות"}</span>
            </PanelTitle>
            <p className="m-0 text-sm text-muted-foreground">
              {openLeg === 2 ? "הלוך וחזור" : `${openLeg} טיסות`} · {pax === 1 ? "נוסע אחד" : `${pax} נוסעים`} · המחירים לנוסע
            </p>
          </div>
          {parts.length > 1 && <SubStepsRow items={items} label="חלקי הטיסות" words={PART_WORDS} onOpen={setActiveFlightPart} />}
          {notes.map((note) => (
            <p
              key={note}
              className="m-0 flex items-start gap-2.5 rounded-xl border border-brand-aqua/40 bg-brand-aqua/10 px-3.5 py-3 text-sm leading-relaxed text-foreground"
            >
              <TrainFront className="mt-0.5 size-4 shrink-0 text-forest dark:text-brand-aqua" aria-hidden />
              {note}
            </p>
          ))}
        </>
      )}
      {parts.map((p, i) => {
        const hop = hops.get(p.key);
        const moveRange = bounds.moves[p.key];
        return (
          <PartPane key={p.key} part={p} shown={shown && i === active} onView={onView}>
            {p.kind === "main" ? (
              <TripDateRange route={route} dates={dates} onCommit={setDates} />
            ) : (
              <>
                {moveRange && (
                  <DateStepper
                    label={`מעבר ל${moveCity(p.key)}`}
                    value={p.legs[0].date}
                    range={moveRange}
                    icon={<Route className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                    onChange={(day) => setDates(applyDatePick(route, dates, p.key, day))}
                  />
                )}
                {hop && <TrainSwitch hop={hop} on={p.byTrain} onToggle={() => toggleTrain(p.key)} />}
              </>
            )}
          </PartPane>
        );
      })}
    </section>
  );
}
