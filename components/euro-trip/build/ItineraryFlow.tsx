"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Building2, Plane, Ticket, X } from "lucide-react";

import { OrderContinueBar, type ContinueSlot } from "@/app/order/OrderContinueBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { allTicketsReady } from "@/lib/itinerary/adapter";
import { dayMonth, stayCityName } from "@/lib/itinerary/builder";
import { stays } from "@/lib/itinerary/dates";
import { dayDiff } from "@/lib/itinerary/geo";
import { estimateItinerary } from "@/lib/itinerary/price";
import { ITINERARY_STEPS, MIN_TRIP_EVENTS, type ItineraryState, type ItineraryStep } from "@/lib/itinerary/state";
import type { Stay } from "@/lib/itinerary/types";
import { FlightsStep } from "./FlightsStep";
import { HotelsStep } from "./HotelsStep";
import { useItinerary, useItineraryUrl } from "./ItineraryProvider";
import { RouteStep } from "./RouteStep";
import { SelfBuild } from "./SelfBuild";
import { TicketsStep } from "./TicketsStep";
import { TripHeader } from "./TripHeader";
import { nightsLabel } from "./parts";

/** A step that is not built yet (flights / hotels / summary land in later tasks). */
function ComingSoon({ step, stay }: { step: Exclude<ItineraryStep, "build" | "tickets">; stay?: Stay }) {
  const copy = {
    flights: { icon: <Plane className="size-7" aria-hidden />, title: "טיסות לכל המסלול - בקרוב" },
    hotels: {
      icon: <Building2 className="size-7" aria-hidden />,
      title: stay
        ? `מלון ב${stayCityName(stay.events[0])} · ${dayMonth(stay.from)}–${dayMonth(stay.to)} · ${nightsLabel(dayDiff(stay.from, stay.to))} - בקרוב`
        : "מלונות - בקרוב",
    },
    summary: { icon: <Ticket className="size-7" aria-hidden />, title: "סיכום ותשלום - בקרוב" },
  }[step];
  return <EmptyState icon={copy.icon} title={copy.title} description="השלב הזה עוד בבנייה. אפשר לחזור למסלול ולשנות אותו." />;
}

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
      return <HotelsStep />;
    case "summary":
      return <ComingSoon step="summary" />;
  }
}

/**
 * The next stay without a hotel: the first after the open one, else the first before it (a
 * customer who opened a later city first). -1 = every other stay has one: on to the summary.
 */
const nextOpenStay = (state: ItineraryState, list: Stay[]): number => {
  const open = (s: Stay, i: number) => i !== state.activeStay && !state.hotels[s.key];
  const after = list.findIndex((s, i) => i > state.activeStay && open(s, i));
  return after >= 0 ? after : list.findIndex(open);
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
  // The estimate until the live steps price the trip (Task A14 switches to the live total).
  const total = useMemo(
    () => (route.length ? estimateItinerary(route, dates, settings, null).perTraveller : 0),
    [route, dates, settings],
  );

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
  const nextStay = step === "hotels" ? nextOpenStay(state, stayList) : -1;
  // Every event has its ticket for the party (a quantity changed in one tab leaves the others
  // to be picked again for the new party).
  const ticketsReady = allTicketsReady(route, state.tickets, state.pax);
  // The step on screen still waits for picks. A flight counts once it is chosen AND priced -
  // the flights step sets it only then.
  const flightMissing = step === "flights" && !state.flight;
  // The hotels step moves on only from a stay that has its hotel: to the next stay without one,
  // or - when every stay has one - to the summary. No flight = no hotel dates (the step says so).
  const openStay = stayList[Math.min(state.activeStay, stayList.length - 1)];
  const hotelMissing = step === "hotels" && (!state.flight || !openStay || !state.hotels[openStay.key]);
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

  const allHotels = stayList.length > 0 && stayList.every((s) => state.hotels[s.key]);
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
