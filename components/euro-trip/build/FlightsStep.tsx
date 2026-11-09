"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DollarSign, Route, ShieldCheck, Star, TrainFront, type LucideIcon } from "lucide-react";

import { FlightLoadingTransition } from "@/components/ui/FlightLoadingTransition";
import { MemoizedFlightCard } from "@/components/ui/FlightCard";
import { OrderIssueState } from "@/components/ui/OrderIssueState";
import type { Event, ItineraryFlight } from "@/lib/app.types";
import { cityName } from "@/lib/events/lodging";
import { groundLink } from "@/lib/itinerary/builder";
import { applyDatePick } from "@/lib/itinerary/datePick";
import { moves, stays, trainLegs, tripDateBounds, tripLegs } from "@/lib/itinerary/dates";
import { directOutcome } from "@/lib/itinerary/directPairs";
import type { FlightLeg } from "@/lib/itinerary/flightOffers";
import { MAIN_PART, flightPartsOf, partDone, pickFits, type FlightPart } from "@/lib/itinerary/flightParts";
import {
  FLIGHTS_PAGE,
  basePerTraveller,
  canSearch,
  groundNoteShort,
  moveOptions,
  pricedTickets,
  pricingOffers,
  searchKey,
  searchOutcome,
  searchView,
  sortFlights,
  tabTags,
  trainHours,
  type FlightSort,
  type SearchOutcome,
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

/** One search of `/api/itinerary/flights`, as the step reads its answer. */
async function askFlights(legs: FlightLeg[], pax: number, nonStop: boolean, signal: AbortSignal): Promise<SearchOutcome> {
  let status = 0;
  let body: unknown = null;
  try {
    const res = await fetch("/api/itinerary/flights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legs, adults: pax, nonStop }),
      signal,
    });
    status = res.status;
    body = await res.json().catch(() => null);
  } catch (err) {
    if (!signal.aborted) console.error("[EuroTrip] Flight search failed:", err);
  }
  return searchOutcome(status, body);
}

/**
 * A part's answer. "טיסות ישירות בלבד" on the way there and back is three non-stop searches at
 * once - the round trip, the way out, the way home - merged with the one-ways paired
 * (`directOutcome`): one ticket often has no direct flight both ways when each way alone has one.
 */
async function askPart(legs: FlightLeg[], pax: number, nonStop: boolean, signal: AbortSignal): Promise<SearchOutcome> {
  if (!nonStop || legs.length !== 2) return askFlights(legs, pax, nonStop, signal);
  const [roundTrip, out, home] = await Promise.all([
    askFlights(legs, pax, true, signal),
    askFlights([legs[0]], pax, true, signal),
    askFlights([legs[1]], pax, true, signal),
  ]);
  return directOutcome(roundTrip, out, home, pax);
}

/**
 * One search per (legs, party, direct-only): debounced, the previous one aborted, a 429 retried once.
 * `onFresh` runs when a NEW answer lands (not a kept one) - its flight ids are new.
 */
function useFlightSearch(legs: FlightLeg[], pax: number, searchable: boolean, nonStop: boolean, onFresh: () => void) {
  const key = searchable ? searchKey(legs, pax, nonStop) : null;
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
      const outcome = await askPart(legs, pax, nonStop, ctrl.signal);
      if (ctrl.signal.aborted) return;
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
    // `key` is made of `legs`, `pax` and `nonStop`: a new key is a new search, the same key is not.
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

/** The check of a chosen flight said it cannot be sold (`key` = the search it came from). */
type PickState = { key: string; id: string; status: "failed" };

/**
 * One part of the trip's flights: its own search (`useFlightSearch`), its recommended flight
 * arriving picked, and - while it is the part on screen - the regular flow's list: הטוב ביותר /
 * הזול ביותר / ישראלי over the cards. A move lists its non-stop flights alone, without the tabs
 * (`moveOptions`, Alon 01.11). A pick counts at once, at the search's price (Alon 01.11: "למה הוא בודק
 * כאן מחיר אם כבר הכל מתומחר?"): `/api/flights/pricing` runs behind it for the fare's penalties and
 * never changes the total. When it says the offer cannot be sold, the pick goes and the card says so.
 *
 * Mounted from the moment the customer leaves the planner, on screen or not (Dor 31.10: "מחיר מדויק
 * כבר בשלב של בחירת כרטיס 1"): the recommended pick is the price on the continue bar. Off screen it
 * draws nothing.
 */
function PartPane({
  part,
  shown,
  nonStop = false,
  onView,
  children,
}: {
  part: FlightPart;
  shown: boolean;
  /** "טיסות ישירות בלבד" (the way there and back only). */
  nonStop?: boolean;
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
  const shownRef = useRef(shown);
  useLayoutEffect(() => {
    latest.current = api;
    shownRef.current = shown;
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const searchable = !part.byTrain && canSearch(part.legs, pax, todayIso);

  // A new answer has new flight ids: a flight picked from an older one no longer points into the list.
  const search = useFlightSearch(part.legs, pax, searchable, nonStop, () => {
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
  const isMove = part.kind === "move";
  const sorted = useMemo(
    () => (isMove ? moveOptions(sortFlights(flights, "best")) : sortFlights(flights, sort)),
    [flights, sort, isMove],
  );
  const { bestId, cheapestId } = useMemo(() => tabTags(isMove ? sorted : flights, isMove ? "best" : sort), [flights, sorted, sort, isMove]);
  const base = useMemo(() => basePerTraveller(flights, pax), [flights, pax]);

  const choose = async (f: ItineraryFlight) => {
    const key = search.key;
    if (!key) return;
    pricing.current?.abort();
    const ctrl = new AbortController();
    pricing.current = ctrl;
    setPick(null);
    latest.current.setFlightPart(part.key, f);
    let answers: { status: number; body: unknown }[] = [];
    try {
      // The order summary's call (app/order/OrderForm.tsx): the whole offer, whatever its legs - and
      // a pair of one-ways is two tickets, each priced on its own.
      const eventId = latest.current.state.route[0]?.id;
      answers = await Promise.all(
        pricingOffers(f).map(async (flightOffer) => {
          const res = await fetch("/api/flights/pricing", {
            method: "POST",
            body: JSON.stringify({ flightOffer, virtual: false, eventId, fareUpgraded: false }),
            signal: ctrl.signal,
          });
          return { status: res.status, body: await res.json().catch(() => null) };
        }),
      );
    } catch (err) {
      if (ctrl.signal.aborted) return;
      console.error("[EuroTrip] Flight pricing failed:", err);
    }
    if (ctrl.signal.aborted) return;
    pricing.current = null;
    const priced = pricedTickets(f, answers, []);
    if (priced) {
      latest.current.setFlightPart(part.key, priced);
      return;
    }
    setPick({ key, id: f.id, status: "failed" });
    latest.current.setFlightPart(part.key, null);
    if (!shownRef.current) latest.current.showNotice("אחת הטיסות שבחרתם כבר לא זמינה. בחרו טיסה אחרת בשלב הטיסות.");
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

  const searching = !part.byTrain && (search.view === "loading" || search.view === "retrying");
  useEffect(() => {
    onView(part.key, searching);
  }, [onView, part.key, searching]);
  useEffect(() => () => onView(part.key, false), [onView, part.key]);

  if (!shown) return null;

  const noDirect = isMove && sorted.length > 0 && sorted.every((f) => f.legs.some((l) => l.stops.length > 1));

  // "הצג עוד" counts per (search, tab), and never hides the flight already chosen.
  const pageAt = `${search.key}|${sort}`;
  const count = page.at === pageAt ? page.count : FLIGHTS_PAGE;
  const chosenId = selectedId;
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
            title={
              search.view === "retrying"
                ? "עומס זמני, מנסים שוב…"
                : part.kind === "main"
                  ? nonStop
                    ? "מחפשים טיסות ישירות הלוך חזור"
                    : "מחפשים טיסות הלוך חזור"
                  : "מחפשים טיסה בין הערים"
            }
            subtitle={search.view === "retrying" ? "עוד כמה שניות" : "כמה שניות"}
          />
        );
        break;
      case "unsearchable":
      case "invalid":
        body = <OrderIssueState title="אי אפשר לחפש טיסות לתאריכים האלה" subtitle={DATES_FIELD_HINT} />;
        break;
      case "empty":
        body = nonStop ? (
          <OrderIssueState
            title="אין טיסות ישירות בשני הכיוונים בתאריכים האלה"
            subtitle="אפשר לכבות את 'טיסות ישירות בלבד' או להזיז יום בשדה למעלה"
          />
        ) : (
          <OrderIssueState title="לא מצאנו טיסות לתאריכים האלה - נסו להזיז יום" subtitle={DATES_FIELD_HINT} />
        );
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
            {!isMove && <SortTabs value={sort} onChange={setSort} />}
            {isMove && noDirect && (
              <p className="m-0 text-xs text-muted-foreground">אין טיסה ישירה בתאריך הזה. אלו הטיסות עם עצירה.</p>
            )}
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
                    // A pair of one-ways draws each way's own airline and says it is two tickets.
                    <div key={f.id} className="flex flex-col gap-1">
                      <MemoizedFlightCard
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
                        inboundMetadata={f.oneWays?.[1].metadata}
                      />
                      {f.oneWays && (
                        <p className="m-0 px-2 text-[11px] text-muted-foreground">הלוך וחזור בשני כרטיסים נפרדים</p>
                      )}
                    </div>
                  ) : (
                    <MoveFlightCard
                      key={f.id}
                      flight={f}
                      pax={pax}
                      basePrice={base ?? f.price / pax}
                      selected={f.id === selectedId}
                      failed={pickNow?.id === f.id && pickNow.status === "failed"}
                      isBest={sorted.length > 1 && f.id === bestId}
                      isCheapest={sorted.length > 1 && f.id === cheapestId}
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

/**
 * "אגיע עצמאית" - a small switch under the move's date (Alon 01.11: "עם הטוגל צמוד אליו בקטן וזהו"):
 * the move leaves the flights, or comes back to them.
 */
function TrainSwitch({ hop, on, onToggle }: { hop: TrainLeg; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex w-fit items-center gap-1.5 rounded-full text-start text-xs font-semibold text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest dark:focus-visible:outline-glow"
    >
      <span aria-hidden className={cn("relative h-4 w-7 shrink-0 rounded-full transition-colors", on ? "bg-brand-aqua" : "bg-foreground/20")}>
        <span
          className={cn(
            "absolute top-[2px] size-3 rounded-full bg-white shadow-sm transition-[inset-inline-start] duration-200",
            on ? "start-[14px]" : "start-[2px]",
          )}
        />
      </span>
      {on ? `הגעה עצמאית, כ-${trainHours(hop.km)} שעות ברכבת, לא כלול` : "אגיע עצמאית, בלי טיסה"}
    </button>
  );
}

/**
 * "טיסות ישירות בלבד" under the way there and back (Dor 09.11) - the regular flow's "טיסה ישירה"
 * filter, searched by Amadeus itself: off = every flight, as before.
 */
function DirectSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex w-fit items-center gap-1.5 rounded-full text-start text-xs font-semibold text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest dark:focus-visible:outline-glow"
    >
      <span aria-hidden className={cn("relative h-4 w-7 shrink-0 rounded-full transition-colors", on ? "bg-brand-aqua" : "bg-foreground/20")}>
        <span
          className={cn(
            "absolute top-[2px] size-3 rounded-full bg-white shadow-sm transition-[inset-inline-start] duration-200",
            on ? "start-[14px]" : "start-[2px]",
          )}
        />
      </span>
      טיסות ישירות בלבד
    </button>
  );
}

/** One small line over a part's list: how an event a flight does not land next to is reached. */
function GroundLine({ text }: { text: string }) {
  return (
    <p className="m-0 flex items-center gap-1.5 text-xs text-muted-foreground">
      <TrainFront className="size-3.5 shrink-0" aria-hidden />
      {text}
    </p>
  );
}

/**
 * "Build Your Euro Trip" - the flights step, cut like the tickets step (Dor 31.10): a part for the
 * way there and back and one per move between flight cities (`flightPartsOf`), each searched,
 * picked and shown on its own in the regular flow's look; a trip with no move is just the regular
 * step, with no sub-steps at all. A move also offers "אגיע עצמאית". A sub-location (Manchester, from
 * London) has no flight of its own: one small line over the part that lands next to it says so. The
 * head of the step stays low, the flights are what the customer came for (Alon 01.11).
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
  const { state, setDates, toggleTrain, setActiveFlightPart, setFlightPart } = useItinerary();
  const { route, dates, pax, train, flightParts } = state;
  // "טיסות ישירות בלבד" on the way there and back. The step lives from the planner on, so this
  // lasts the visit; a switch is a new search, so the pick made under the other answer goes.
  const [nonStop, setNonStop] = useState(false);
  const toggleNonStop = () => {
    setNonStop((v) => !v);
    setFlightPart(MAIN_PART, null);
  };
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
  // A flight is named by the city its airport serves: a Manchester stay still flies home from London.
  const airport = (e: Event | undefined): string => (e ? cityName(e, "flight") : "");
  const out = airport(route[0]);
  const home = airport(route[route.length - 1]);
  const moveCity = (key: string): string => airport(moves(route).find((x) => x.key === key)?.b);
  const items: SubStepItem[] = parts.map((p, i) => {
    const hop = hops.get(p.key);
    return {
      index: i,
      label: p.kind === "main" ? "הלוך חזור" : `מעבר ${i}`,
      name:
        p.kind === "main"
          ? out === home
            ? `ל${out}`
            : `ל${out}, חזרה מ${home}`
          : hop
            ? `${hop.fromName} ← ${hop.toName}`
            : moveCity(p.key),
      done: partDone(p, flightParts, pax),
      current: i === active,
      enabled: true,
    };
  });

  // The way from the airport to a stay away from it (Manchester from London), said only over the
  // part that lands there or leaves from there: the first stay and the last one, a move's next stay.
  const groundOf = (p: FlightPart): string[] => {
    const events =
      p.kind === "main"
        ? [list[0]?.events[0], list[list.length - 1]?.events[0]]
        : moves(route).filter((m) => m.key === p.key).map((m) => m.b);
    return [
      ...new Set(
        events.flatMap((e) => {
          const g = e ? groundLink(e) : null;
          return g ? [groundNoteShort(g)] : [];
        }),
      ),
    ];
  };
  const openLeg = allLegs.length;

  return (
    <section
      aria-labelledby="trip-flights-title"
      hidden={!shown}
      className={cn("mx-auto flex w-full max-w-4xl flex-col gap-2", !shown && "hidden")}
    >
      {shown && (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <PanelTitle>
              <span id="trip-flights-title">{parts.length > 1 ? "טיסות ומעברים" : "טיסות"}</span>
            </PanelTitle>
            <span className="text-xs text-muted-foreground">
              {openLeg === 2 ? "הלוך וחזור" : `${openLeg} טיסות`} · {pax === 1 ? "נוסע אחד" : `${pax} נוסעים`} · המחירים לנוסע
            </span>
          </div>
          {parts.length > 1 && <SubStepsRow items={items} label="חלקי הטיסות" words={PART_WORDS} onOpen={setActiveFlightPart} />}
        </>
      )}
      {parts.map((p, i) => {
        const hop = hops.get(p.key);
        const moveRange = bounds.moves[p.key];
        return (
          <PartPane key={p.key} part={p} shown={shown && i === active} nonStop={p.kind === "main" && nonStop} onView={onView}>
            {p.kind === "main" ? (
              <>
                <TripDateRange route={route} dates={dates} onCommit={setDates} />
                <DirectSwitch on={nonStop} onToggle={toggleNonStop} />
              </>
            ) : (
              moveRange && (
                <DateStepper
                  label={`מעבר ל${moveCity(p.key)}`}
                  value={p.legs[0].date}
                  range={moveRange}
                  icon={<Route className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  onChange={(day) => setDates(applyDatePick(route, dates, p.key, day))}
                >
                  {hop && <TrainSwitch hop={hop} on={p.byTrain} onToggle={() => toggleTrain(p.key)} />}
                </DateStepper>
              )
            )}
            {groundOf(p).map((line) => (
              <GroundLine key={line} text={line} />
            ))}
          </PartPane>
        );
      })}
    </section>
  );
}
