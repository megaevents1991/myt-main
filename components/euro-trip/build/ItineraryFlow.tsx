"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AlarmClockCheck, X } from "lucide-react";

import { OrderContinueBar, type ContinueSlot } from "@/app/order/OrderContinueBar";
import { EventDataHeader } from "@/components/ui/EventDataHeader";
import { Stepper } from "@/components/ui/Stepper";
import { ticketReady } from "@/lib/itinerary/adapter";
import { stayCityName } from "@/lib/itinerary/builder";
import { stays } from "@/lib/itinerary/dates";
import { flowSteps, stepForIndex, stepperIndex } from "@/lib/itinerary/flowSteps";
import { PRIOR_HOLD_NOTICE } from "@/lib/itinerary/heldMarker";
import { canContinue, livePerTraveller, nextOpenEvent, progressivePrice } from "@/lib/itinerary/progress";
import { ITINERARY_STEPS, MIN_TRIP_EVENTS, type ItineraryState, type ItineraryStep } from "@/lib/itinerary/state";
import { stayHotelReady, stayRanges } from "@/lib/itinerary/stayAdapter";
import { useItinerary, useItineraryUrl } from "./ItineraryProvider";
import { SelfBuild } from "./SelfBuild";
import { StepSkeleton } from "./StepSkeleton";
import { EditRouteLink, TripHeader } from "./TripHeader";

// The builder lands on the planner (a ready trip: on its first event's tickets), and most planner
// visits end there: the later steps bring the order flow's live ticket step (seat maps), the
// flight cards, the live hotel step (Mantine date pickers, the hotel search) and the summary -
// ~350 kB the first load does not need. Each loads on demand (and is warmed one step ahead:
// `prefetchStep`). `ssr: false`: the server draws the build step only. Defined HERE, at module
// level - a dynamic made inside a component would be a new component type on every render and
// remount the step each time.
const TicketsStep = dynamic(() => import("./TicketsStep").then((m) => m.TicketsStep), {
  ssr: false,
  loading: () => <StepSkeleton label="טוענים את הכרטיסים..." side />,
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
 * The hotels step, kept alive (see ItineraryFlow). Its wrapper also hides the step's skeleton:
 * the dynamic `loading` cannot see `shown`, and a customer who steps back before the chunk
 * arrives must not keep a skeleton under the earlier step.
 */
function HotelsPane({ shown }: { shown: boolean }) {
  return (
    <div hidden={!shown}>
      <HotelsStep shown={shown} />
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
      return <FlightsStep />;
    case "hotels":
      // Drawn beside the switch (ItineraryFlow): it stays mounted while the trip has its flight.
      return null;
    case "summary":
      return <SummaryStep />;
  }
}

/**
 * The next stay whose hotel is not ready (`stayHotelReady`): the first after the open one, else
 * the first before it (a customer who opened a later city first). -1 = every other stay is
 * ready: on to the summary.
 */
const nextOpenStay = (active: number, count: number, ready: (i: number) => boolean): number => {
  const open = (i: number) => i !== active && !ready(i);
  const all = Array.from({ length: count }, (_, i) => i);
  const after = all.find((i) => i > active && open(i));
  return after ?? all.find(open) ?? -1;
};

/**
 * "Build Your Euro Trip" - the flow, shaped as the order flow: the live Stepper on top (the page's
 * top bar - the global header hides here), one ticket step per event, then flights, hotels and
 * the summary; under it the header (the open event's band on a ticket step, the trip's on the
 * others), the step on screen, and the order flow's own continue bar (OrderContinueBar) with the
 * trip's slots and its price per traveller.
 */
export function ItineraryFlow() {
  useItineraryUrl();
  const { state, settings, notice, dismissNotice, goStep, setActiveEvent, setActiveStay, priorHold, held } =
    useItinerary();
  const { route, dates, step } = state;

  const stayList = useMemo(() => (route.length ? stays(route, dates) : []), [route, dates]);
  // Each stay's nights under the trip's flight - with `stayHotelReady`, THE rule for a stay's hotel.
  const ranges = useMemo(
    () => stayRanges(route, dates, state.flight, new Set(state.train)),
    [route, dates, state.flight, state.train],
  );
  const hotelReady = (i: number) => stayHotelReady(state.hotels[stayList[i]?.key ?? ""], ranges[i], state.pax);

  // The hotels step stays mounted (hidden) once opened, for as long as the trip has a flight: a
  // visit to the summary or an earlier step and back spends no hotel search and finds every
  // opened city as the customer left it (pick, rate, filters). No flight = no hotel dates: it
  // goes (the reducer drops the flight on any change of route, dates, party or train). Another
  // flight keeps it: a city whose nights moved gets a new pane, the others keep theirs.
  const [hotelsOpened, setHotelsOpened] = useState(false);
  if (step === "hotels" && state.flight && !hotelsOpened) setHotelsOpened(true);
  else if (!state.flight && hotelsOpened) setHotelsOpened(false);
  const hotelsMounted = step === "hotels" || (hotelsOpened && !!state.flight);
  // The live price once every piece is picked (the summary's own figure); until then the running
  // price - each piece picked at its own price, the rest at the estimate's (`progressivePrice`).
  const live = livePerTraveller(state, settings);
  const total = live ?? progressivePrice(state, settings).perTraveller;
  const progress = canContinue(state);

  // A new step or mode opens at the top of the page - and so does the next event's tickets and
  // the next city's hotels.
  const view = `${step}|${state.mode}|${step === "hotels" ? state.activeStay : step === "tickets" ? state.activeEvent : ""}`;
  const lastView = useRef(view);
  useEffect(() => {
    if (lastView.current === view) return;
    lastView.current = view;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  const enough = route.length >= MIN_TRIP_EVENTS;
  const at = ITINERARY_STEPS.indexOf(step);

  // The next step's code arrives while the customer is still on this one (idle time, never on a
  // data-saver connection), so the switch is instant. Not before the route holds enough events
  // to go on: most visitors leave from the route step and never need it.
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
  const openIndex = Math.min(state.activeStay, stayList.length - 1);
  const nextStay = step === "hotels" ? nextOpenStay(openIndex, stayList.length, hotelReady) : -1;
  // Every event has its ticket for the party (a quantity changed in one tab leaves the others
  // to be picked again for the new party).
  const ticketsReady = progress.tickets;
  // The tickets step walks the events like the hotels step walks the cities: it moves on from an
  // event whose ticket is ready - to the next event without one, or, when every event has one, to
  // the flights.
  const openEvent = route[Math.min(state.activeEvent, route.length - 1)];
  const ticketMissing = step === "tickets" && (!openEvent || !ticketReady(state.tickets[openEvent.id], state.pax));
  const nextEvent = step === "tickets" ? nextOpenEvent(state) : -1;
  // The step on screen still waits for picks. A flight counts once it is chosen AND priced -
  // the flights step sets it only then.
  const flightMissing = step === "flights" && !progress.flights;
  // The hotels step moves on only from a stay whose hotel is ready: to the next stay without one,
  // or - when every stay has one - to the summary. No flight = no hotel dates (the step says so).
  const openStay = stayList[openIndex];
  const hotelMissing = step === "hotels" && (!progress.flights || !openStay || !hotelReady(openIndex));
  const blocked = ticketMissing || flightMissing || hotelMissing;

  const primaryLabel = !enough
    ? "בחרו לפחות 2 אירועים"
    : blocked
      ? flightMissing || (hotelMissing && !progress.flights)
        ? "בחרו טיסה לכל המסלול"
        : hotelMissing
          ? `בחרו מלון ב${openStay ? stayCityName(openStay.events[0]) : "כל עיר"}`
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
            ? "בחר והמשך למלונות"
            : nextStay >= 0
              ? `בחר והמשך למלון ב${stayCityName(stayList[nextStay].events[0])}`
              : "בחר והמשך לסיכום";

  const onPrimary = () => {
    if (!enough || blocked) return;
    if (step === "build") goStep("tickets");
    else if (step === "tickets") {
      if (nextEvent >= 0) setActiveEvent(nextEvent);
      else if (ticketsReady) goStep("flights");
    } else if (step === "flights") goStep("hotels");
    else if (step === "hotels") {
      if (nextStay >= 0) setActiveStay(nextStay);
      else goStep("summary");
    }
  };

  /** A slot taps back to its step once the flow is past it, and forward to the next step only. */
  const slotNav = (target: ItineraryStep): (() => void) | undefined => {
    if (!enough) return undefined;
    const i = ITINERARY_STEPS.indexOf(target);
    if (i < at) return () => goStep(target);
    if (i === at + 1) return onPrimary;
    return undefined;
  };

  const allHotels = progress.hotels;
  const slots: ContinueSlot[] = [
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
      filled: progress.flights,
      value: state.flight ? `${state.flight.airline} · ${state.flight.legs.length} טיסות` : "",
      onClick: slotNav("flights"),
    },
    {
      icon: "hotel",
      label: "מלונות",
      filled: allHotels,
      value: stayList.length === 1 ? "מלון אחד" : `${stayList.length} מלונות`,
      onClick: slotNav("hotels"),
    },
  ];

  const solo = route.length === 1 ? route[0] : null;

  // The stepper goes BACK only (the live rule): a click on a step past the open one does nothing.
  // "אירוע k" reopens that event's tickets; nothing a step holds is cleared by the visit (goStep
  // and setActiveEvent move the view only). A held trip is with sales: nothing to walk back to.
  const current = stepperIndex(state);
  const onStepperClick = (index0: number) => {
    const target = stepForIndex(index0, route);
    if (!target || held || index0 + 1 >= current) return;
    if (target.step === "tickets") setActiveEvent(target.activeEvent);
    goStep(target.step);
  };

  return (
    <>
      <Stepper
        currentStep={current}
        steps={flowSteps(route)}
        hideSteps={step === "build"}
        onStepperClick={onStepperClick}
      />
      {step === "tickets" && openEvent ? (
        // The order flow's event band (TicketSelection's own markup), for the open event - with a
        // quiet way back to the planner: a ready trip opens here, so this is its first screen.
        <div className="flex flex-col items-center">
          <div dir="rtl" className="w-full bg-muted px-4 py-2 lg:p-4">
            <div className="mx-auto flex w-full max-w-7xl flex-col justify-between gap-2 px-2 lg:flex-row lg:gap-2 lg:px-6">
              <EventDataHeader event={openEvent} />
              <EditRouteLink className="self-end lg:self-center" />
            </div>
          </div>
        </div>
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
        {hotelsMounted && <HotelsPane shown={step === "hotels"} />}
      </div>
      {/* The order flow's sticky continue bar (app/order/OrderForm.tsx), steps before the summary.
          Not on an empty builder: there is no trip to price yet (the bar would say $0). */}
      {step !== "summary" && route.length > 0 && (
        <div className="sticky bottom-0 z-40 w-full border-t border-border bg-background/85 backdrop-blur">
          <OrderContinueBar
            slots={slots}
            total={total}
            primaryLabel={primaryLabel}
            primaryDisabled={!enough || blocked}
            onPrimary={onPrimary}
            isFinalStep={false}
          />
          {/* The bar's figure is the live price only once every piece is picked; until then it is
              the trip's estimate - said so (the bar itself is the order flow's, unchanged). */}
          {live === null && (
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
