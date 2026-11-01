"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { CircleAlert, Loader2 } from "lucide-react";

import { OrderContext } from "@/app/app.context";
import { TicketSelection } from "@/app/order/TicketSelection";
import { OrderIssueState } from "@/components/ui/OrderIssueState";
import type { Event } from "@/lib/app.types";
import type { HeldTicket } from "@/lib/itinerary/draft";
import { asFullRow, categorySwapNotice, isFullRow, ticketFromStep, ticketReady } from "@/lib/itinerary/adapter";
import { useItinerary } from "./ItineraryProvider";
import { adapterForEvent, type TicketStepCallbacks } from "./orderContextAdapter";
import { TICKET_BAND_ID } from "./parts";
import { useFullRows } from "./useFullRows";

/**
 * The live ticket step draws its own event band (EventDataHeader in a full-width `bg-muted` strip). A
 * trip draws that line once, with the event circles in it (TicketSubSteps, Alon 01.11: the name came
 * twice, in two rows), so the live band hides. Scoped to this step's own wrapper: /order is untouched.
 */
const NO_LIVE_BAND = "[&_.w-screen.bg-muted]:hidden";

/** Right after the live step's own scroll (TicketSelection: 1 s after it mounts). */
const MOBILE_SCROLL_AFTER_MS = 1050;

/**
 * One event's ticket step: the order flow's own TicketSelection, unchanged, reading this
 * event's slice of the trip through an OrderContext adapter. Mounted per event AND party size
 * (keyed `id:pax`), so an event's step opens like the order page's step 1 does - on the ticket it held,
 * else the cheapest - and so does the step whose +/- changed the party: it keeps the category
 * the customer was on while that category sells the new size.
 */
function EventTicketPane({ event, lastPane }: { event: Event; lastPane: RefObject<number | null> }) {
  const api = useItinerary();
  const { pax, tickets } = api.state;
  const ticket = tickets[event.id];
  const id = event.id;

  // The callbacks keep their identity for the pane's life (see adapterForEvent), so they read
  // the provider through a ref; the provider's actions themselves are re-made per render.
  const latest = useRef(api);
  useLayoutEffect(() => {
    latest.current = api;
  });
  // The pick this step opened on, read once (ticketAdapterFields' `held`): the trip's ticket, else
  // the category a refresh brought back (the draft - no price: the step prices it again).
  const [held] = useState<HeldTicket | undefined>(() => ticket ?? api.heldTickets[id]);

  // Did the step put another category in place of the held one on its own? A hand pick (a
  // click or Enter / Space inside the pane, then a ticket) is the customer's: it ends the notice.
  const touched = useRef(false);
  const [autoPick, setAutoPick] = useState<string | undefined>(undefined);
  const [handPicked, setHandPicked] = useState(false);
  const notice = handPicked ? null : categorySwapNotice(held, autoPick, pax);

  const [cb] = useState<TicketStepCallbacks>(() => ({
    setTicket: (t) => {
      const next = ticketFromStep(t);
      latest.current.setTicket(id, next);
      if (touched.current) {
        touched.current = false;
        setHandPicked(true);
      } else setAutoPick(next?.id);
    },
    setPax: (n) => latest.current.setPax(n),
    setEvent: (e) => latest.current.setEventData(isFullRow(e) ? e : asFullRow(e)),
    clearTravel: () => latest.current.clearTravel(),
  }));
  const value = useMemo(
    () => adapterForEvent({ event, ticket, pax, held: held?.id }, cb),
    [event, ticket, pax, held, cb],
  );

  // Dor 31.10: on a phone the page opens scrolled to the event's band, the logo and the steps above
  // it out of the way and the seat map on screen. The live step scrolls to its own 90px a second
  // after it mounts (TicketSelection), which this one follows straight away - and which is undone
  // when the pane mounted only because +/- changed the party (the same event again: the customer
  // stays where they were).
  const [keepScroll] = useState(() => lastPane.current === event.id);
  useEffect(() => {
    lastPane.current = event.id;
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    const from = window.scrollY;
    const timer = window.setTimeout(() => {
      const band = document.getElementById(TICKET_BAND_ID);
      const top = band ? band.getBoundingClientRect().top + window.scrollY : 90;
      window.scrollTo({ top: keepScroll ? from : top, behavior: "smooth" });
    }, MOBILE_SCROLL_AFTER_MS);
    return () => window.clearTimeout(timer);
    // Once, when the pane opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onClickCapture={() => {
        touched.current = true;
      }}
      onKeyDownCapture={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") touched.current = true;
      }}
    >
      {notice && (
        <div
          role="status"
          className="mt-3 flex items-start gap-3 rounded-xl border border-badge-vip/60 bg-badge-vip/20 px-4 py-3 text-sm font-semibold text-foreground"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="flex-1">{notice}</span>
        </div>
      )}
      <OrderContext.Provider value={value}>
        <TicketSelection initialEvent={event} />
      </OrderContext.Provider>
    </div>
  );
}

/** Until the event's whole row is in: the ticket step's own "loading" line over its shape. */
function PaneSkeleton() {
  return (
    <div role="status" aria-live="polite" className="mt-4 flex flex-col gap-3">
      <div className="flex items-center justify-center gap-3 p-4 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        טוענים את הכרטיסים...
      </div>
      <div className="flex flex-col gap-4 lg:flex-row-reverse" aria-hidden>
        <div className="h-64 animate-pulse rounded-2xl bg-muted lg:h-96 lg:w-[45%]" />
        <div className="flex flex-col gap-2 lg:w-[55%]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * "Build Your Euro Trip" - the tickets step: the open event's (`state.activeEvent` - the sub-steps
 * under the stepper, TicketSubSteps, and the continue bar move it) live order flow ticket step
 * (seat map, categories, live supplier prices). One quantity for the whole trip: the counter on any card is the trip's
 * travellers (`setPax`, which also clears a flight and hotels searched for the old party).
 */
export function TicketsStep() {
  const { state } = useItinerary();
  const { route, pax, tickets } = state;
  const { failed, retry } = useFullRows();

  const active = Math.min(state.activeEvent, route.length - 1);
  const event = route[active];
  // The event the last pane was for: the pane mounts anew per party size, see EventTicketPane.
  const lastPane = useRef<number | null>(null);
  if (!event) return null;

  const isDone = (e: Event) => ticketReady(tickets[e.id], pax);
  const doneCount = route.filter(isDone).length;

  return (
    <section aria-labelledby="trip-tickets-title" className={`flex flex-col gap-3 ${NO_LIVE_BAND}`}>
      {/* Alon 28.10: no visible heading here - the band above says where the customer stands. Screen
          readers keep the section's name and the count. */}
      <h2 id="trip-tickets-title" className="sr-only">
        כרטיסים לכל אירוע · {doneCount} מתוך {route.length} מוכנים
      </h2>
      {isFullRow(event) ? (
        <EventTicketPane key={`${event.id}:${pax}`} event={event} lastPane={lastPane} />
      ) : failed ? (
        <OrderIssueState
          variant="error"
          className="mt-4"
          title="לא הצלחנו לטעון את הכרטיסים"
          subtitle="משהו השתבש אצלנו. נסו שוב בעוד רגע."
          onRetry={retry}
        />
      ) : (
        <PaneSkeleton />
      )}
    </section>
  );
}
