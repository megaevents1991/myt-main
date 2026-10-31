"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AlarmClockCheck, X } from "lucide-react";

import { OrderContinueBar, type ContinueSlot } from "@/app/order/OrderContinueBar";
import { Stepper } from "@/components/ui/Stepper";
import { ticketReady } from "@/lib/itinerary/adapter";
import { stayCityName } from "@/lib/itinerary/builder";
import { stays } from "@/lib/itinerary/dates";
import { flightPartsOf, partDone } from "@/lib/itinerary/flightParts";
import { flowSteps, stepForIndex, stepperIndex } from "@/lib/itinerary/flowSteps";
import { PRIOR_HOLD_NOTICE } from "@/lib/itinerary/heldMarker";
import { canContinue, livePerTraveller, nextOpenEvent, progressivePrice } from "@/lib/itinerary/progress";
import { ITINERARY_STEPS, MIN_TRIP_EVENTS, type ItineraryState, type ItineraryStep } from "@/lib/itinerary/state";
import { stayHotelReady, stayRanges } from "@/lib/itinerary/stayAdapter";
import { cn } from "@/lib/utils";
import { useItinerary, useItineraryUrl } from "./ItineraryProvider";
import { stayCardId } from "./parts";
import { SelfBuild } from "./SelfBuild";
import { StepSkeleton } from "./StepSkeleton";
import { TicketSubSteps } from "./TicketSubSteps";
import { TripHeader } from "./TripHeader";

// The builder lands on the planner (a ready trip: on its first event's tickets), and most planner
// visits end there: the later steps bring the order flow's live ticket step (seat maps), the
// flight cards with the trip's date picker (Mantine), the split stay's hotel cards and their
// search, and the summary - ~350 kB the first load does not need. Each loads on demand (and is warmed one step ahead:
// `prefetchStep`). `ssr: false`: the server draws the build step only. Defined HERE, at module
// level - a dynamic made inside a component would be a new component type on every render and
// remount the step each time.
const TicketsStep = dynamic(() => import("./TicketsStep").then((m) => m.TicketsStep), {
  ssr: false,
  loading: () => <StepSkeleton label="טוענים את הכרטיסים..." side tabs={false} />,
});
const FlightsStep = dynamic(() => import("./FlightsStep").then((m) => m.FlightsStep), {
  ssr: false,
  loading: () => <StepSkeleton label="טוענים את הטיסות..." tabs={false} />,
});
const HotelsStep = dynamic(() => import("./HotelsStep").then((m) => m.HotelsStep), {
  ssr: false,
  loading: () => <StepSkeleton label="טוענים את המלונות..." />,
});
const SummaryStep = dynamic(() => import("./SummaryStep").then((m) => m.SummaryStep), {
  ssr: false,
  loading: () => <StepSkeleton label="טוענים את הסיכום..." side tabs={false} />,
});

/**
 * The flights step, alive from the moment the planner is left (see ItineraryFlow). Its wrapper also
 * hides the step's skeleton (the dynamic `loading` cannot see `shown`).
 */
function FlightsPane({ shown, onSearching }: { shown: boolean; onSearching: (searching: boolean) => void }) {
  return (
    <div hidden={!shown}>
      <FlightsStep shown={shown} onSearching={onSearching} />
    </div>
  );
}

/**
 * The hotels step, kept alive (see ItineraryFlow). Its wrapper also hides the step's skeleton:
 * the dynamic `loading` cannot see `shown`, and a customer who steps back before the chunk
 * arrives must not keep a skeleton under the earlier step. `onNoHotel`: the stays whose search
 * ended without a hotel (the continue bar's "searching" vs "pick a hotel").
 */
function HotelsPane({ shown, onNoHotel }: { shown: boolean; onNoHotel: (stayKeys: string[]) => void }) {
  return (
    <div hidden={!shown}>
      <HotelsStep shown={shown} onNoHotel={onNoHotel} />
    </div>
  );
}

/** Warm the code of a step the customer is about to reach (the same module the dynamic loads). */
function prefetchStep(step: ItineraryStep): Promise<unknown> {
  switch (step) {
    case "tickets":
      return import("./TicketsStep");
    case "flights":
      return import("./FlightsStep");
    case "hotels":
      return import("./HotelsStep");
    case "summary":
      return import("./SummaryStep");
    default:
      return Promise.resolve();
  }
}

/** The step on screen - one switch, so each step's real component slots in here. */
function StepBody({ state }: { state: ItineraryState }) {
  switch (state.step) {
    case "build":
      return <SelfBuild />;
    case "tickets":
      return <TicketsStep />;
    case "flights":
    case "hotels":
      // Drawn beside the switch (ItineraryFlow): they stay mounted, the trip's price hangs on them.
      return null;
    case "summary":
      return <SummaryStep />;
  }
}

/**
 * "Build Your Euro Trip" - the flow, shaped as the order flow: the live Stepper on top (the page's
 * top bar - the global header hides here) with its four steps - tickets, flights, hotels, the
 * summary; under it the trip's header (on the tickets step the events as its sub-steps and the
 * way back to the planner - the live step draws the event's own band), the step on screen, and
 * the order flow's own continue bar (OrderContinueBar) with the trip's slots and its price per
 * traveller.
 */
export function ItineraryFlow() {
  useItineraryUrl();
  const { state, settings, notice, dismissNotice, goStep, setActiveEvent, setActiveFlightPart, skipStay, priorHold, held, holdSending } =
    useItinerary();
  const { route, dates, step } = state;

  const stayList = useMemo(() => (route.length ? stays(route, dates) : []), [route, dates]);
  // Each stay's nights under the trip's flight - with `stayHotelReady`, THE rule for a stay's hotel.
  const ranges = useMemo(
    () => stayRanges(route, dates, state.flight, new Set(state.train)),
    [route, dates, state.flight, state.train],
  );
  const hotelReady = (i: number) =>
    state.skippedStays.includes(stayList[i]?.key ?? "") || stayHotelReady(state.hotels[stayList[i]?.key ?? ""], ranges[i], state.pax);

  // Dor 31.10: "מחיר מדויק כבר בשלב של בחירת כרטיס 1, שיביא תוצאות אחרי שלקוח לחץ על אישור במסך
  // הבנייה". From the moment the customer leaves the planner the flights step runs hidden - each
  // part searched, its recommended flight picked and priced - and, once the trip has its flight,
  // so does the hotels step, one city after another. That is what the bar's price is made of. Never
  // on the planner: RateHawk takes 10 searches a minute for the whole account, and most visitors
  // never leave it. They stay mounted, so a visit to another step and back spends no search and
  // finds everything as the customer left it; no flight = no hotel dates, the hotels step goes.
  const quoting = step !== "build" && route.length >= MIN_TRIP_EVENTS;
  const hotelsMounted = step === "hotels" || (quoting && !!state.flight);
  const [flightsSearching, setFlightsSearching] = useState(true);
  // The stays whose hotel search ended without a hotel (the hotels step says so on their card).
  const [noHotel, setNoHotel] = useState<string[]>([]);
  const onNoHotel = useCallback(
    (keys: string[]) => setNoHotel((prev) => (prev.join("|") === keys.join("|") ? prev : keys)),
    [],
  );
  // The live price once every piece is picked (the summary's own figure); until then the running
  // price - each piece picked at its own price, the rest at the estimate's (`progressivePrice`).
  const live = livePerTraveller(state, settings);
  const total = live ?? progressivePrice(state, settings).perTraveller;
  const progress = canContinue(state);

  // A new step or mode opens at the top of the page - and so does the next event's tickets. The
  // hotels step opened on a later stay (the summary's "שינוי" on its hotel) opens on its card.
  const view = `${step}|${state.mode}|${
    step === "hotels" ? state.activeStay : step === "tickets" ? state.activeEvent : step === "flights" ? state.activeFlightPart : ""
  }`;
  const lastView = useRef(view);
  const openStayKey = step === "hotels" && state.activeStay > 0 ? stayList[state.activeStay]?.key : undefined;
  useEffect(() => {
    if (lastView.current === view) return;
    lastView.current = view;
    const card = openStayKey ? document.getElementById(stayCardId(openStayKey)) : null;
    if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view, openStayKey]);

  const enough = route.length >= MIN_TRIP_EVENTS;
  const at = ITINERARY_STEPS.indexOf(step);

  // The next step's code arrives while the customer is still on this one (idle time, never on a
  // data-saver connection), so the switch is instant. Not before the route holds enough events
  // to go on: most visitors leave from the planner and never need it.
  const upNext = ITINERARY_STEPS[at + 1];
  useEffect(() => {
    if (!enough || !upNext) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    let live = true;
    const warm = () => {
      if (live) prefetchStep(upNext).catch(() => undefined); // the real load retries and reports
    };
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(warm, { timeout: 3000 });
      return () => {
        live = false;
        window.cancelIdleCallback(handle);
      };
    }
    const timer = window.setTimeout(warm, 800);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [enough, upNext]);
  // Every event has its ticket for the party (a quantity changed on one event's step leaves the
  // others to be picked again for the new party).
  const ticketsReady = progress.tickets;
  // The tickets step walks the events in order (its sub-steps): it moves on from an event whose
  // ticket is ready - to the next event without one, or, when every event has one, to the flights.
  const openEvent = route[Math.min(state.activeEvent, route.length - 1)];
  const ticketMissing = step === "tickets" && (!openEvent || !ticketReady(state.tickets[openEvent.id], state.pax));
  const nextEvent = step === "tickets" ? nextOpenEvent(state) : -1;
  // The flights step walks its parts in order (its sub-steps), as the tickets step walks the events:
  // it moves on from a part that is settled - to the next one, or, on the last, to the hotels. A
  // flight counts once it is chosen AND priced - the part's pane sets it only then.
  const trainSet = useMemo(() => new Set(state.train), [state.train]);
  const flightParts = useMemo(() => flightPartsOf(route, dates, trainSet), [route, dates, trainSet]);
  const openPart = flightParts[Math.min(state.activeFlightPart, Math.max(0, flightParts.length - 1))];
  const partOpen = !!openPart && !partDone(openPart, state.flightParts, state.pax);
  const lastPart = state.activeFlightPart >= flightParts.length - 1;
  const flightMissing = step === "flights" && (partOpen || (lastPart && !progress.flights));
  // The hotels step moves on once every stay has its hotel (they arrive picked, one search after
  // another) - to the summary. No flight = no hotel dates (the step says so).
  const hotelMissing = step === "hotels" && (!progress.flights || !progress.hotels);
  const missingStay = stayList.findIndex((_, i) => !hotelReady(i));
  // A stay without its hotel is still being searched, unless its search ended without one.
  const hotelsSearching = stayList.some((s, i) => !hotelReady(i) && !noHotel.includes(s.key));
  const blocked = ticketMissing || flightMissing || hotelMissing;

  const primaryLabel = !enough
    ? "בחרו לפחות 2 אירועים"
    : blocked
      ? flightMissing || (hotelMissing && !progress.flights)
        ? partOpen && flightsSearching
          ? "מחפשים טיסות..."
          : "בחרו טיסה"
        : hotelMissing
          ? hotelsSearching
            ? "מחפשים מלונות..."
            : `בחרו מלון ב${missingStay >= 0 ? stayCityName(stayList[missingStay].events[0]) : "כל עיר"}`
          : openEvent
            ? `בחרו כרטיסים ל${openEvent.name}`
            : "בחרו כרטיסים לכל האירועים"
      : step === "build"
        ? "בחר והמשך לכרטיסים"
        : step === "tickets"
          ? nextEvent >= 0
            ? `המשך לכרטיסים ל${route[nextEvent].name}`
            : "בחר והמשך לטיסות"
          : step === "flights"
            ? lastPart
              ? "בחר והמשך למלונות"
              : `המשך למעבר ${state.activeFlightPart + 1}`
            : "בחר והמשך לסיכום";

  const onPrimary = () => {
    if (!enough || blocked) return;
    if (step === "build") goStep("tickets");
    else if (step === "tickets") {
      if (nextEvent >= 0) setActiveEvent(nextEvent);
      else if (ticketsReady) goStep("flights");
    } else if (step === "flights") {
      if (lastPart) goStep("hotels");
      else setActiveFlightPart(state.activeFlightPart + 1);
    }
    else if (step === "hotels") goStep("summary");
  };

  /** A slot taps back to its step once the flow is past it, and forward to the next step only. */
  const slotNav = (target: ItineraryStep): (() => void) | undefined => {
    if (!enough) return undefined;
    const i = ITINERARY_STEPS.indexOf(target);
    if (i < at) return () => goStep(target);
    if (i === at + 1) return onPrimary;
    return undefined;
  };

  // A flight or a hotel the flow picked on its way (the price) is not yet the customer's: its slot
  // fills when the customer reaches its step. On the planner the bar is the CTA alone (Dor 31.10:
  // no slots and no price - there is no real one yet).
  const reached = (target: ItineraryStep) => at >= ITINERARY_STEPS.indexOf(target);
  const slots: ContinueSlot[] =
    step === "build"
      ? []
      : [
          {
            icon: "ticket",
            label: "כרטיסים",
            filled: ticketsReady,
            value: route.length === 1 ? "אירוע אחד" : `${route.length} אירועים`,
            onClick: slotNav("tickets"),
          },
          {
            icon: "flight",
            label: "טיסות",
            filled: progress.flights && reached("flights"),
            value: state.flight ? `${state.flight.airline} · ${state.flight.legs.length} טיסות` : "",
            onClick: slotNav("flights"),
          },
          {
            icon: "hotel",
            label: "מלונות",
            filled: progress.hotels && reached("hotels"),
            value: stayList.length === 1 ? "מלון אחד" : `${stayList.length} מלונות`,
            onClick: slotNav("hotels"),
          },
        ];

  const solo = route.length === 1 ? route[0] : null;

  // The bar shows a price only once it is real: every flight and hotel is priced (the tickets not
  // opened yet count at their cheapest on sale). While they are still being searched, it says so;
  // when a search ended with nothing, the running estimate, said to be one.
  const quoted = progress.flights && progress.hotels;
  const quotePending = !quoted && (flightsSearching || (progress.flights && hotelsSearching));
  const priceText = step === "build" ? "" : quotePending ? "מחשבים מחיר מדויק…" : undefined;
  // One city: the regular step's own "לא צריך מלון", beside the continue button (the cards say it per city).
  const onlyStay = stayList.length === 1 ? stayList[0] : null;
  const skip =
    step === "hotels" && onlyStay && !state.skippedStays.includes(onlyStay.key)
      ? { label: "לא צריך מלון", onSkip: () => skipStay(onlyStay.key, true) }
      : undefined;

  // The stepper goes BACK only (the live rule): a click on a step past the open one does nothing.
  // "כרטיסים" reopens the tickets step on the event the customer last had open (activeEvent is
  // kept); the events themselves are its sub-steps (TicketSubSteps). Nothing a step holds is
  // cleared by the visit (goStep moves the view only). A held trip is with sales: nothing to walk
  // back to. Nor while the hold is on its way (`holdSending`): it writes real reservations, and
  // its answer is read on the summary.
  const current = stepperIndex(state);
  const onStepperClick = (index0: number) => {
    const target = stepForIndex(index0);
    if (!target || held || holdSending || index0 + 1 >= current) return;
    goStep(target);
  };

  return (
    <>
      <Stepper currentStep={current} steps={flowSteps()} hideSteps={step === "build"} onStepperClick={onStepperClick} />
      {step === "tickets" ? (
        // The live ticket step draws the open event's band itself (EventDataHeader, from the
        // adapter's event), exactly as on /order - so no trip header here: the trip's events as the
        // tickets step's sub-steps, and a quiet way back to the planner at the row's end (a ready
        // trip opens here, this is its first screen).
        <TicketSubSteps />
      ) : (
        <TripHeader />
      )}
      <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 lg:px-6" dir="rtl">
        {/* This tab held this very trip in the last 24 hours (a refresh after the hold reopened the
            route): said quietly - the customer may still go on. */}
        {priorHold && (
          <div
            role="status"
            className="mb-4 flex items-start gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-foreground"
          >
            <AlarmClockCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex-1">
              {PRIOR_HOLD_NOTICE}
              {priorHold.reference && (
                <>
                  {" · "}מספר הבקשה:{" "}
                  <b dir="ltr" className="font-bold">
                    {priorHold.reference}
                  </b>
                </>
              )}
            </span>
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="mb-4 flex items-start gap-3 rounded-xl border border-badge-urgent/40 bg-badge-urgent/10 px-4 py-3 text-sm font-semibold text-foreground"
          >
            <span className="flex-1">{notice}</span>
            <button
              type="button"
              onClick={dismissNotice}
              aria-label="סגירת ההודעה"
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        )}
        <StepBody state={state} />
        {quoting && <FlightsPane shown={step === "flights"} onSearching={setFlightsSearching} />}
        {hotelsMounted && <HotelsPane shown={step === "hotels"} onNoHotel={onNoHotel} />}
      </div>
      {/* The order flow's sticky continue bar (app/order/OrderForm.tsx), steps before the summary.
          Not on an empty builder: there is no trip to price yet (the bar would say $0). On the
          planner it is the phone's: from lg the side panel (TripPanel) carries the trip's CTA. */}
      {step !== "summary" && route.length > 0 && (
        <div
          className={cn(
            "sticky bottom-0 z-40 w-full border-t border-border bg-background/85 backdrop-blur",
            step === "build" && "lg:hidden",
          )}
        >
          <OrderContinueBar
            slots={slots}
            total={total}
            primaryLabel={primaryLabel}
            primaryDisabled={!enough || blocked}
            onPrimary={onPrimary}
            isFinalStep={false}
            priceText={priceText}
            skip={skip}
          />
          {/* A search that ended with nothing: the figure is the trip's estimate - said so. */}
          {step !== "build" && !quoted && !quotePending && (
            <p className="-mt-1 pb-1.5 text-center text-xs font-semibold text-muted-foreground">
              הערכה - המחיר המדויק לנוסע יופיע אחרי בחירת הטיסה והמלונות
            </p>
          )}
          {solo && (
            <p className="-mt-1 pb-2 text-center">
              <Link
                href={`/order/${solo.id}`}
                className="text-[13px] font-bold text-forest underline decoration-forest/40 underline-offset-2 dark:text-glow dark:decoration-glow/40"
              >
                או רק {solo.name} - להזמנה הרגילה
              </Link>
            </p>
          )}
        </div>
      )}
    </>
  );
}
