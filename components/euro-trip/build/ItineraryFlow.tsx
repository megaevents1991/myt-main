"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { OrderContinueBar, type ContinueSlot } from "@/app/order/OrderContinueBar";
import { stayCityName } from "@/lib/itinerary/builder";
import { stays } from "@/lib/itinerary/dates";
import { estimateItinerary } from "@/lib/itinerary/price";
import { canContinue, livePerTraveller } from "@/lib/itinerary/progress";
import { ITINERARY_STEPS, MIN_TRIP_EVENTS, type ItineraryState, type ItineraryStep } from "@/lib/itinerary/state";
import { stayHotelReady, stayRanges } from "@/lib/itinerary/stayAdapter";
import { FlightsStep } from "./FlightsStep";
import { HotelsStep } from "./HotelsStep";
import { useItinerary, useItineraryUrl } from "./ItineraryProvider";
import { RouteStep } from "./RouteStep";
import { SelfBuild } from "./SelfBuild";
import { SummaryStep } from "./SummaryStep";
import { TicketsStep } from "./TicketsStep";
import { TripHeader } from "./TripHeader";

/** The step on screen - one switch, so each step's real component slots in here. */
function StepBody({ state }: { state: ItineraryState }) {
  switch (state.step) {
    case "build":
      return state.mode === "route" ? <RouteStep /> : <SelfBuild />;
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
 * "Build Your Euro Trip" - the flow: the trip header, the step on screen, and the order flow's
 * own continue bar (OrderContinueBar) with the trip's slots and its price per traveller.
 */
export function ItineraryFlow() {
  useItineraryUrl();
  const { state, settings, notice, dismissNotice, goStep, setActiveStay } = useItinerary();
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
  // The live price once every piece is picked (the summary's own figure), the estimate until then.
  const estimate = useMemo(
    () => (route.length ? estimateItinerary(route, dates, settings, null).perTraveller : 0),
    [route, dates, settings],
  );
  const total = livePerTraveller(state, settings) ?? estimate;
  const progress = canContinue(state);

  // A new step or mode opens at the top of the page - and so does the next city's hotels.
  const view = `${step}|${state.mode}|${step === "hotels" ? state.activeStay : ""}`;
  const lastView = useRef(view);
  useEffect(() => {
    if (lastView.current === view) return;
    lastView.current = view;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  const enough = route.length >= MIN_TRIP_EVENTS;
  const at = ITINERARY_STEPS.indexOf(step);
  const openIndex = Math.min(state.activeStay, stayList.length - 1);
  const nextStay = step === "hotels" ? nextOpenStay(openIndex, stayList.length, hotelReady) : -1;
  // Every event has its ticket for the party (a quantity changed in one tab leaves the others
  // to be picked again for the new party).
  const ticketsReady = progress.tickets;
  // The step on screen still waits for picks. A flight counts once it is chosen AND priced -
  // the flights step sets it only then.
  const flightMissing = step === "flights" && !state.flight;
  // The hotels step moves on only from a stay whose hotel is ready: to the next stay without one,
  // or - when every stay has one - to the summary. No flight = no hotel dates (the step says so).
  const openStay = stayList[openIndex];
  const hotelMissing = step === "hotels" && (!state.flight || !openStay || !hotelReady(openIndex));
  const blocked = (step === "tickets" && !ticketsReady) || flightMissing || hotelMissing;

  const primaryLabel = !enough
    ? "בחרו לפחות 2 אירועים"
    : blocked
      ? flightMissing || (hotelMissing && !state.flight)
        ? "בחרו טיסה לכל המסלול"
        : hotelMissing
          ? `בחרו מלון ב${openStay ? stayCityName(openStay.events[0]) : "כל עיר"}`
          : "בחרו כרטיסים לכל האירועים"
      : step === "build"
        ? "בחר והמשך לכרטיסים"
        : step === "tickets"
          ? "בחר והמשך לטיסות"
          : step === "flights"
            ? "בחר והמשך למלונות"
            : nextStay >= 0
              ? `בחר והמשך למלון ב${stayCityName(stayList[nextStay].events[0])}`
              : "בחר והמשך לסיכום";

  const onPrimary = () => {
    if (!enough || blocked) return;
    if (step === "build") goStep("tickets");
    else if (step === "tickets") goStep("flights");
    else if (step === "flights") goStep("hotels");
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
      filled: !!state.flight,
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

  return (
    <>
      <TripHeader />
      <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 lg:px-6" dir="rtl">
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
        {hotelsMounted && <HotelsStep shown={step === "hotels"} />}
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
