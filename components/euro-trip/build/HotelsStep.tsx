"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BedDouble, MapPin, Plane, TrainFront } from "lucide-react";

import { OrderContext } from "@/app/app.context";
import { HotelFetchProvider, type HotelsData } from "@/app/hooks/HotelFetch.provider";
import type { FetchHotelsParams } from "@/app/order/fetchHotels";
import { HotelSelection } from "@/app/order/HotelSelection";
import { segmentBreakfastOffer, withBreakfast, withoutBreakfast } from "@/app/order/order-review.utils";
import { SegmentHotelModal, SegmentsList } from "@/components/order/SegmentsList";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrderIssueState } from "@/components/ui/OrderIssueState";
import type { Event, OrderHotel } from "@/lib/app.types";
import { cityName, lodgingLocation, type StaySegment } from "@/lib/events/lodging";
import { getRoomParams } from "@/lib/getRoomParams";
import { dayMonth, groundLink, stayCityName } from "@/lib/itinerary/builder";
import { moves, stays, tripLegs } from "@/lib/itinerary/dates";
import { trainHours } from "@/lib/itinerary/flightsView";
import { dayDiff, haversineKm, sameHub } from "@/lib/itinerary/geo";
import {
  sameHotel,
  stayEvent,
  stayFlight,
  stayHotelReady,
  stayRanges,
  withStayBase,
  type StayRange,
} from "@/lib/itinerary/stayAdapter";
import { buildStayHotel, pickDefaultHotel, searchStayHotels, withStayHotelExtras } from "@/lib/itinerary/stayHotels";
import type { Stay } from "@/lib/itinerary/types";
import { cn } from "@/lib/utils";
import { useItinerary } from "./ItineraryProvider";
import { adapterForStay } from "./orderContextAdapter";
import { ADD_BUTTON, PanelTitle, nightsLabel, stayCardId } from "./parts";

/** One stay as the step shows and searches it. */
type StayView = {
  stay: Stay;
  /** "פריז" - the city the stay sleeps in. */
  city: string;
  /** The stay's event, lodging in its city alone, its hotel base prorated to these nights (`withStayBase`). */
  event: Event;
  /** Check-in / check-out under the trip's flight, `YYYY-MM-DD` (`stayRanges`). */
  range: StayRange;
  /** The stay as ONE split-stay segment: with one segment its "+$ / -$ / כלול במחיר" is the trip price's hotel rule. */
  segment: StaySegment;
  /** The rooms the party sleeps in (`getRoomParams`). */
  rooms: FetchHotelsParams["guests"];
  /** What one search answers for: the stay, its nights and its rooms. */
  searchKey: string;
  /**
   * The move into this stay (none for the first): its day, whether a flight of the trip makes it,
   * and the city a flight lands in (the airport's - `cityName(.., "flight")`, the trip's one label
   * rule; a Manchester stay flown to London reads "טיסה ללונדון").
   */
  arrival: { day: string; flown: boolean; airport: string; train: boolean } | null;
};

/** How a stay's search ended without a hotel: the search failed, or the city has none for these nights. */
type StayOutcome = "failed" | "empty";

/** One stay's search and default pick, as the step applies it. */
type StayResult = { kind: "picked"; hotel: OrderHotel } | { kind: StayOutcome } | { kind: "aborted" };

/** The rooms as one key part: "2+2" = two rooms of two. */
const roomsKey = (rooms: FetchHotelsParams["guests"]): string =>
  rooms.map((r) => `${r.adults}${r.children.length ? `c${r.children.length}` : ""}`).join("+");

/** The live split stay's search for one segment: around the stay's point, its nights, the party's rooms. */
const searchParams = (v: StayView): FetchHotelsParams => ({
  location: lodgingLocation(v.event, v.stay.city),
  dateRange: [new Date(`${v.range[0]}T00:00:00`), new Date(`${v.range[1]}T00:00:00`)],
  guests: v.rooms,
  eventId: v.stay.events[0].id,
});

/** A swap search that failed: the modal's own "no hotels" state (what the live split stay passes). */
const FAILED_SEARCH: HotelsData = { data: {} as HotelsData["data"], hotelsInfo: {} };

/**
 * A trip that sleeps in ONE city: the regular hotel step (Dor 31.10: "מלון בצורה הרגילה שלו") - the
 * list, its filters, its rooms - through the order's context. The hotel the flow already picked
 * opens selected on its own rate (the step's package-swap path, `adapterForStay`), so the price the
 * customer has been shown does not jump. The nights come from the flight and cannot move here (the
 * trip's rule for a hotel, `stayHotelReady`): the date field shows them, shut (`datesFixed`). The
 * trip's own header stands above it, so the step's band of one event draws only its search row.
 * Spends one RateHawk search of its own when it opens - once: it stays mounted.
 */
function RegularHotelStep({ view }: { view: StayView }) {
  const api = useItinerary();
  const { state, setHotel } = api;
  const key = view.stay.key;
  const flight = state.flight;
  const latest = useRef({ setHotel, hotel: state.hotels[key] });
  useLayoutEffect(() => {
    latest.current = { setHotel, hotel: state.hotels[key] };
  });
  // The step's setter keeps its identity (its callbacks list it); an empty write (a filter with no
  // match) leaves the hotel in place - the trip is never left without its price by a filter.
  const [cb] = useState(() => ({
    setHotel: (h: OrderHotel | undefined) => {
      if (!h) return;
      const next: OrderHotel = { ...h, city: view.stay.city, cityName: view.city };
      if (!sameHotel(latest.current.hotel, next)) latest.current.setHotel(key, next);
    },
  }));
  const [opened] = useState(() => state.hotels[key]);
  const stay = useMemo(
    () => (flight ? stayFlight(0, flight, state.route, state.dates, new Set(state.train)) : undefined),
    [flight, state.route, state.dates, state.train],
  );
  const value = useMemo(
    () => adapterForStay({ event: view.event, city: view.stay.city, flight: stay, hotel: state.hotels[key], held: opened, pax: state.pax }, cb),
    [view.event, view.stay.city, stay, state.hotels, key, opened, state.pax, cb],
  );
  return (
    <div className="[&_.w-screen.bg-muted_.max-w-7xl>*:first-child]:hidden">
      <HotelFetchProvider>
        <OrderContext.Provider value={value}>
          <HotelSelection datesFixed />
        </OrderContext.Provider>
      </HotelFetchProvider>
    </div>
  );
}

/**
 * One stay's hotel: its search (the step's cache first - a search is spent once per stay, nights
 * and rooms) and the live split stay's default pick on it. Only an answer WITH hotels is cached
 * (the live rule): an empty city is asked again on the next try. A pick that fails - a hotel
 * whose info lacks what the filter reads throws there, as it does live - is a failed search, and
 * its answer leaves the cache so "נסו שוב" asks the supplier again.
 */
async function findStayHotel(
  v: StayView,
  pax: number,
  signal: AbortSignal,
  cache: Map<string, HotelsData>,
): Promise<StayResult> {
  // Stopped while it waited its turn in the queue: no search.
  if (signal.aborted) return { kind: "aborted" };
  let search = cache.get(v.searchKey);
  if (!search) {
    try {
      search = await searchStayHotels(searchParams(v), signal);
    } catch {
      return signal.aborted ? { kind: "aborted" } : { kind: "failed" };
    }
    if (signal.aborted) return { kind: "aborted" };
    if (search.data.data.hotels.length) cache.set(v.searchKey, search);
  }
  if (!search.data.data.hotels.length) return { kind: "empty" };
  try {
    const hotel = pickDefaultHotel(search);
    const built = hotel ? buildStayHotel({ city: v.stay.city, cityLabel: v.city, search, hotel }) : null;
    // Ready for this stay (its nights, the party) - else the stay would wait on it forever.
    if (built && stayHotelReady(built, v.range, pax)) return { kind: "picked", hotel: built };
  } catch {
    // Falls through: a failed pick.
  }
  cache.delete(v.searchKey);
  return { kind: "failed" };
}

/** A stay the customer needs no hotel for: said in the card's place, with the way back. */
function SkippedStay({ view, onBack }: { view: StayView; onBack: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-[1.5px] border-dashed border-border bg-card p-4">
      <span className="flex items-center gap-2 text-sm font-bold">
        <BedDouble className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        ללא מלון ב{view.city}
        <span className="font-normal text-muted-foreground">
          {`${dayMonth(view.range[0])}–${dayMonth(view.range[1])} · ${nightsLabel(view.segment.nights)}`}
        </span>
      </span>
      <button type="button" onClick={onBack} className={ADD_BUTTON}>
        הוספת מלון
      </button>
    </div>
  );
}

/** Km between the stay before this one and this one: the train under one flight city. */
const groundBetween = (v: StayView, views: StayView[]): number | null => {
  const at = views.indexOf(v);
  const prev = views[at - 1];
  return prev ? haversineKm(prev.stay.point, v.stay.point) : null;
};

/**
 * Runs `task` once every task queued before it has settled: RateHawk takes 10 searches a minute
 * for the whole account (shared with the live site), so the step never runs two at once.
 */
function enqueue<T>(queue: { current: Promise<unknown> }, task: () => Promise<T>): Promise<T> {
  const next = queue.current.then(task);
  queue.current = next.catch(() => undefined);
  return next;
}

/** An answer is still for the stay's nights and rooms now (its `searchKey`): else it is dropped. */
const stillFor = (views: StayView[], stayKey: string, searchKey: string): boolean =>
  views.find((v) => v.stay.key === stayKey)?.searchKey === searchKey;

/** The open "החלפת מלון": which stay, and its search (null while it is fetched). */
type SwapState = { stayKey: string; searchKey: string; search: HotelsData | null };

/**
 * "Build Your Euro Trip" - the hotels step: the live split stay's cards, one per stay, in trip
 * order (consecutive events in one city share a stay), each its own live `SegmentsList` with ONE
 * segment - so its "+$ / -$ לכל אורח" and "כלול במחיר" are the trip price's hotel rule
 * (`hotelPerTraveller`) - and between two stays a line naming the move into the next.
 *
 * Every hotel arrives picked: on opening, each stay without a ready hotel (`stayHotelReady`) is
 * searched and gets the live split stay's default pick (`lib/itinerary/stayHotels.ts`). RateHawk
 * takes 10 searches a minute for the whole account, shared with the live site, so the stays are
 * searched ONE AFTER ANOTHER, only while the step is on screen, once per stay, nights and rooms
 * (the answers are cached for the step's life); a stay that has its hotel is neither searched nor
 * replaced. "החלפת מלון" opens the live `SegmentHotelModal` on the stay's own cached answer; with
 * none in hand its search waits its turn in the same queue (never two searches at once). An
 * answer - automatic or a swap's - is committed only while it is still for the stay's nights and
 * rooms (`searchKey`).
 *
 * `shown` = the hotels step is the step on screen. The flow mounts this step (hidden) as soon as the
 * trip has its flight (ItineraryFlow): the hotels it picks are the price the customer sees from the
 * first ticket on, and a visit to the summary or an earlier step and back spends no search.
 *
 * A trip that sleeps in one city gets the regular hotel step instead (`RegularHotelStep`) once it is
 * on screen; the pick behind the price is still made here. "לא צריך מלון" takes a stay out of the
 * search and of the price's hotels (`skippedStayPerTraveller`); its hotel is kept for the way back.
 *
 * `onNoHotel` hands the flow the stays whose search ended without a hotel (failed, or none in the
 * city), so its continue bar tells "searching" from "pick a hotel".
 */
export function HotelsStep({
  shown = true,
  onNoHotel,
}: {
  shown?: boolean;
  onNoHotel?: (stayKeys: string[]) => void;
}) {
  const api = useItinerary();
  const { state, setHotel, skipStay, goStep } = api;
  const { route, dates, flight, hotels, pax, train, skippedStays } = state;

  const views = useMemo<StayView[]>(() => {
    if (!flight || !route.length) return [];
    const trainSet = new Set(train);
    const list = stays(route, dates);
    const ranges = stayRanges(route, dates, flight, trainSet);
    const ms = moves(route);
    const flown = new Set(tripLegs(route, dates, trainSet).map((l) => l.key));
    const rooms = getRoomParams(pax);
    return list.map((stay, i) => {
      const range = ranges[i];
      const move = i > 0 ? ms[i - 1] : undefined;
      return {
        stay,
        city: stayCityName(stay.events[0]),
        event: withStayBase(stayEvent(stay.events[0], stay.city), range),
        range,
        segment: { city: stay.city, checkin: range[0], checkout: range[1], nights: dayDiff(range[0], range[1]) },
        rooms,
        searchKey: `${stay.key}|${range[0]}|${range[1]}|${roomsKey(rooms)}`,
        arrival: move
          ? {
              day: stay.from,
              flown: flown.has(move.key),
              airport: cityName(stay.events[0], "flight"),
              train: sameHub(move.a, move.b),
            }
          : null,
      };
    });
  }, [flight, route, dates, train, pax]);

  // The searches' answers for the step's life, by `searchKey` (the swap reads them too).
  const cache = useRef(new Map<string, HotelsData>());
  // How a stay's search ended without a hotel, by `searchKey` (other nights or rooms = asked anew).
  const [outcomes, setOutcomes] = useState<Record<string, StayOutcome>>({});
  // The effects read the trip's latest values and writes through a ref.
  const latest = useRef({ views, pax, setHotel });
  useLayoutEffect(() => {
    latest.current = { views, pax, setHotel };
  });
  // Every search of the step - the automatic run and a swap's - goes through ONE queue
  // (`enqueue`): never two RateHawk searches at once.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const ready = (v: StayView) => stayHotelReady(hotels[v.stay.key], v.range, pax);
  const skipped = (v: StayView) => skippedStays.includes(v.stay.key);
  // The stays still waiting for their search, in trip order: the first is searched next.
  const due = views.filter((v) => !ready(v) && !skipped(v) && !outcomes[v.searchKey]);
  const dueSig = due.map((v) => v.searchKey).join("\n");
  const noHotelSig = views
    .filter((v) => !ready(v) && outcomes[v.searchKey])
    .map((v) => v.stay.key)
    .join("|");

  // The one search running: its stay's key and how to stop it.
  const run = useRef<{ key: string; ctrl: AbortController } | null>(null);
  useEffect(() => {
    const keys = dueSig ? dueSig.split("\n") : [];
    // A stay whose nights or rooms changed is not searched to the end.
    if (run.current && !keys.includes(run.current.key)) {
      run.current.ctrl.abort();
      run.current = null;
    }
    if (run.current || !keys.length) return;
    const now = latest.current;
    const view = now.views.find((v) => v.searchKey === keys[0]);
    if (!view) return;
    const mine = { key: view.searchKey, ctrl: new AbortController() };
    run.current = mine;
    void enqueue(queue, () => findStayHotel(view, now.pax, mine.ctrl.signal, cache.current)).then((result) => {
      if (run.current !== mine || result.kind === "aborted") return;
      run.current = null;
      // The stay's nights or rooms moved while it was searched: the answer is for the old ones.
      // Nothing is written; the stay's new key is due and the effect searches it.
      if (!stillFor(latest.current.views, view.stay.key, view.searchKey)) return;
      // Either write takes the stay off `due`, and the next stay's search starts.
      if (result.kind === "picked") latest.current.setHotel(view.stay.key, result.hotel);
      else setOutcomes((prev) => ({ ...prev, [view.searchKey]: result.kind }));
    });
  }, [dueSig]);

  // The open swap's search, when the stay had no cached answer (the step was mounted again).
  const swapRun = useRef<{ key: string; ctrl: AbortController } | null>(null);
  // Leaving for good (no flight any more, another party): nothing keeps searching. Cleared too,
  // so a mount that runs its effects again (React's dev double run) starts its search afresh.
  useEffect(() => {
    const runs = run;
    const swaps = swapRun;
    return () => {
      runs.current?.ctrl.abort();
      runs.current = null;
      swaps.current?.ctrl.abort();
      swaps.current = null;
    };
  }, []);

  useEffect(() => {
    onNoHotel?.(noHotelSig ? noHotelSig.split("|") : []);
  }, [noHotelSig, onNoHotel]);
  useEffect(() => () => onNoHotel?.([]), [onNoHotel]);

  const retry = (searchKey: string) =>
    setOutcomes((prev) => {
      const next = { ...prev };
      delete next[searchKey];
      return next;
    });

  const [regularOpened, setRegularOpened] = useState(false);
  const [swap, setSwap] = useState<SwapState | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const openSwap = (v: StayView) => {
    const cached = cache.current.get(v.searchKey) ?? null;
    setSwap({ stayKey: v.stay.key, searchKey: v.searchKey, search: cached });
    setSwapOpen(true);
    // No answer in hand: ONE search for it (none when it is already running), queued behind the
    // automatic run - which may answer for this very stay first (the cache is read again).
    if (cached || swapRun.current?.key === v.searchKey) return;
    swapRun.current?.ctrl.abort();
    const mine = { key: v.searchKey, ctrl: new AbortController() };
    swapRun.current = mine;
    enqueue(queue, async () => {
      if (mine.ctrl.signal.aborted) return null;
      const kept = cache.current.get(v.searchKey);
      if (kept) return kept;
      const res = await searchStayHotels(searchParams(v), mine.ctrl.signal);
      if (res.data.data.hotels.length) cache.current.set(v.searchKey, res);
      return res;
    })
      .catch(() => (mine.ctrl.signal.aborted ? null : FAILED_SEARCH))
      .then((res) => {
        if (swapRun.current !== mine) return;
        swapRun.current = null;
        if (res) setSwap((prev) => (prev?.searchKey === v.searchKey ? { ...prev, search: res } : prev));
      });
  };
  const swapView = swap ? views.find((v) => v.stay.key === swap.stayKey) : undefined;
  const onSwapPick = (picked: Omit<OrderHotel, "guests" | "checkin" | "checkout">) => {
    const request = swap?.search?.data?.debug?.request;
    if (!swap?.search || !swapView || !request) return;
    // The list was searched for nights or rooms the stay no longer has: never committed.
    if (!stillFor(latest.current.views, swap.stayKey, swap.searchKey)) return;
    setHotel(
      swapView.stay.key,
      withStayHotelExtras(
        {
          ...picked,
          guests: request.guests,
          checkin: request.checkin,
          checkout: request.checkout,
          city: swapView.stay.city,
          cityName: swapView.city,
        },
        swap.search,
      ),
    );
  };

  const addBreakfast = (v: StayView) => {
    const h = hotels[v.stay.key];
    const offer = segmentBreakfastOffer(h);
    if (h && offer) setHotel(v.stay.key, withBreakfast(h, offer));
  };
  const removeBreakfast = (v: StayView) => {
    const h = hotels[v.stay.key];
    if (h) setHotel(v.stay.key, withoutBreakfast(h));
  };

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

  const doneCount = views.filter((v) => ready(v) || skipped(v)).length;
  const firstGround = route[0] ? groundLink(route[0]) : null;
  const onlyView = views[0];
  // One city, on screen: the regular step. Kept mounted once opened (it spends a search to open).
  if (shown && views.length === 1 && !skipped(onlyView) && !regularOpened) setRegularOpened(true);
  if (views.length !== 1 && regularOpened) setRegularOpened(false);

  if (views.length === 1 && regularOpened) {
    return (
      <section aria-label="מלון" className={cn(!shown && "hidden")} hidden={!shown}>
        {skipped(onlyView) ? <SkippedStay view={onlyView} onBack={() => skipStay(onlyView.stay.key, false)} /> : <RegularHotelStep view={onlyView} />}
      </section>
    );
  }

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
      {firstGround && views[0].stay.city === "event" && (
        <p className="m-0 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <TrainFront className="size-3.5 shrink-0" aria-hidden />
          {`נוחתים ב${firstGround.from} וממשיכים ברכבת ל${firstGround.to}, כ-${trainHours(firstGround.km)} שעות, בכוחות עצמכם`}
        </p>
      )}
      {views.map((v) => {
        const hotel = hotels[v.stay.key];
        const isReady = ready(v);
        const outcome = isReady ? undefined : outcomes[v.searchKey];
        const moveGround = v.arrival?.train ? groundBetween(v, views) : null;
        return (
          <Fragment key={v.stay.key}>
            {v.arrival && (
              <p className="m-0 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                {v.arrival.flown ? (
                  <Plane className="size-3.5 shrink-0" aria-hidden />
                ) : v.arrival.train ? (
                  <TrainFront className="size-3.5 shrink-0" aria-hidden />
                ) : (
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                )}
                {`${dayMonth(v.arrival.day)} · ${
                  v.arrival.flown
                    ? `טיסה ל${v.arrival.airport}`
                    : v.arrival.train
                      ? `רכבת ל${v.city}${moveGround ? `, כ-${trainHours(moveGround)} שעות` : ""}, בכוחות עצמכם`
                      : `הגעה עצמאית ל${v.city}`
                }`}
              </p>
            )}
            <div id={stayCardId(v.stay.key)} className="scroll-mt-28">
              {skipped(v) ? (
                <SkippedStay view={v} onBack={() => skipStay(v.stay.key, false)} />
              ) : outcome ? (
                <OrderIssueState
                  className="min-h-40"
                  variant={outcome === "failed" ? "error" : "empty"}
                  title={`לא מצאנו מלון ב${v.city} לתאריכים האלה`}
                  subtitle={`${dayMonth(v.range[0])}–${dayMonth(v.range[1])} · ${nightsLabel(v.segment.nights)}`}
                  // A failed search may answer next time; a city with no hotel for these nights would not.
                  onRetry={outcome === "failed" ? () => retry(v.searchKey) : undefined}
                  whatsAppText={`היי, אני בונה באתר טיול עם כמה אירועים ולא נמצא מלון ב${v.city}. אשמח לעזרה :)`}
                />
              ) : (
                <SegmentsList
                  event={v.event}
                  segments={[v.segment]}
                  hotels={isReady && hotel ? [hotel] : null}
                  loading={!isReady}
                  minPrice={v.event.base_hotel_price}
                  persons={pax}
                  onSwap={() => openSwap(v)}
                  onAddBreakfast={() => addBreakfast(v)}
                  onRemoveBreakfast={() => removeBreakfast(v)}
                />
              )}
              {!skipped(v) && (
                <button
                  type="button"
                  onClick={() => skipStay(v.stay.key, true)}
                  className="mt-2 text-sm font-bold text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  לא צריך מלון ב{v.city}
                </button>
              )}
            </div>
          </Fragment>
        );
      })}
      {swap && swapView && (
        <SegmentHotelModal
          opened={swapOpen}
          onClose={() => setSwapOpen(false)}
          title={`החלפת מלון · ${swapView.city}`}
          search={swap.search}
          loading={!swap.search}
          minPrice={swapView.event.base_hotel_price}
          persons={pax}
          selectedHotelId={hotels[swapView.stay.key]?.id}
          onPick={onSwapPick}
        />
      )}
    </section>
  );
}
