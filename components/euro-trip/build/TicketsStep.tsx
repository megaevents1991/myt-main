"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, CircleAlert, Loader2 } from "lucide-react";

import { loadTripEvents } from "@/app/euro-trip/build/actions";
import { OrderContext } from "@/app/app.context";
import { TicketSelection } from "@/app/order/TicketSelection";
import { OrderIssueState } from "@/components/ui/OrderIssueState";
import type { Event } from "@/lib/app.types";
import { eventCityName } from "@/lib/events/lodging";
import {
  MAX_TRIP_LOAD,
  asFullRow,
  categorySwapNotice,
  goneIds,
  isFullRow,
  ticketFromStep,
  ticketReady,
} from "@/lib/itinerary/adapter";
import { dayMonth } from "@/lib/itinerary/builder";
import { eventDay } from "@/lib/itinerary/geo";
import { cn } from "@/lib/utils";
import { useItinerary } from "./ItineraryProvider";
import { adapterForEvent, type TicketStepCallbacks } from "./orderContextAdapter";
import { TripEventArt } from "./TripEventArt";
import { PanelTitle } from "./parts";

/** The same words the route link uses for an event that left the catalog. */
const GONE = "האירוע כבר לא זמין";
const PANEL_ID = "trip-tickets-panel";
const tabId = (eventId: number) => `trip-tickets-tab-${eventId}`;

/**
 * The route's events still hold the builder's slim catalog rows (lib/itinerary/slim.ts);
 * the ticket step needs them whole. One Server Action call for every slim row, when the step
 * opens (a row loaded before - the customer came back from a later step - is not loaded
 * again; never more than MAX_TRIP_LOAD per call, the action's own cap). A row that comes back
 * is swapped in (`setEventData`: same trip, so the picks stay); an asked id that does not
 * come back left the catalog - the route's notice says so and it leaves the route, unless the
 * customer already took it out while the answer was on its way.
 */
function useFullRows(): { failed: boolean; retry: () => void } {
  const { state, setEventData, removeEvent, showNotice } = useItinerary();
  const key = state.route
    .filter((e) => !isFullRow(e))
    .slice(0, MAX_TRIP_LOAD)
    .map((e) => e.id)
    .join(",");
  // The route when the answer lands, not when it was asked.
  const route = useRef(state.route);
  useLayoutEffect(() => {
    route.current = state.route;
  });
  const [attempt, setAttempt] = useState(0);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  // One call per (rows, attempt) - never a second one while it is answered.
  const asked = useRef<string | null>(null);

  useEffect(() => {
    if (!key) return;
    const ask = `${key}#${attempt}`;
    if (asked.current === ask) return;
    asked.current = ask;
    setFailedFor(null);
    const ids = key.split(",").map(Number);
    loadTripEvents(ids)
      .then((rows) => {
        for (const row of rows) setEventData(asFullRow(row));
        const gone = goneIds(
          ids,
          rows,
          route.current.map((e) => e.id),
        );
        if (!gone.length) return;
        showNotice(GONE);
        for (const id of gone) removeEvent(id);
      })
      .catch((err) => {
        console.error("[EuroTrip] Failed to load the trip's events:", err);
        setFailedFor(ask);
      });
    // The actions only dispatch to the provider - any render's copy does the same.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return {
    failed: failedFor === `${key}#${attempt}`,
    retry: () => setAttempt((a) => a + 1),
  };
}

/**
 * One event's ticket step: the order flow's own TicketSelection, unchanged, reading this
 * event's slice of the trip through an OrderContext adapter. Mounted per event AND party size
 * (keyed `id:pax`), so a tab opens like the order page's step 1 does - on the ticket it held,
 * else the cheapest - and so does the tab whose +/- changed the party: it keeps the category
 * the customer was on while that category sells the new size.
 */
function EventTicketPane({ event }: { event: Event }) {
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
  // The pick this tab opened on, read once (ticketAdapterFields' `held`).
  const [held] = useState(() => ticket);

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

/** The route's events as tabs: art, name, "DD/MM · city", and a check once its ticket is picked. */
function EventTabs({
  route,
  active,
  isDone,
  onSelect,
}: {
  route: Event[];
  active: number;
  isDone: (e: Event) => boolean;
  onSelect: (i: number) => void;
}) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  // The tab pattern's keys, manual activation: the arrows (RTL: the next tab is the one to
  // the left), Home and End move the focus only - opening a tab mounts a whole ticket step
  // with its supplier calls, so that waits for Enter / Space (the button's own click).
  const onKeyDown = (ev: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = route.length;
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
    <div role="tablist" aria-label="האירועים בטיול" className="flex gap-2">
      {route.map((e, i) => {
        const selected = i === active;
        const done = isDone(e);
        return (
          <button
            key={e.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabId(e.id)}
            aria-selected={selected}
            aria-controls={PANEL_ID}
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
            <TripEventArt
              event={e}
              sizes="48px"
              className="size-10 shrink-0 rounded-full border-2 border-white shadow-sm md:size-12"
            />
            <span className="flex w-full min-w-0 flex-col">
              <span className="truncate text-sm font-bold leading-tight">{e.name}</span>
              <span className="truncate text-xs tabular-nums text-muted-foreground">
                {dayMonth(eventDay(e))} · {eventCityName(e)}
              </span>
            </span>
            {done && (
              <span className="absolute end-1.5 top-1.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-forest text-white sm:static sm:size-6 dark:bg-glow dark:text-black">
                <Check className="size-3.5 sm:size-4" aria-hidden />
                <span className="sr-only">כרטיסים נבחרו</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * "Build Your Euro Trip" - the tickets step: one tab per event, each the live order flow's
 * ticket step (seat map, categories, live supplier prices) for that event. One quantity for
 * the whole trip: the counter on any card is the trip's travellers (`setPax`, which also
 * clears a flight and hotels searched for the old party).
 */
export function TicketsStep() {
  const { state, setActiveEvent } = useItinerary();
  const { route, pax, tickets } = state;
  const { failed, retry } = useFullRows();

  const active = Math.min(state.activeEvent, route.length - 1);
  const event = route[active];
  if (!event) return null;

  const isDone = (e: Event) => ticketReady(tickets[e.id], pax);
  const doneCount = route.filter(isDone).length;

  return (
    <section aria-labelledby="trip-tickets-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <PanelTitle>
          <span id="trip-tickets-title">כרטיסים לכל אירוע</span>
        </PanelTitle>
        <p className="m-0 text-sm text-muted-foreground">
          {pax === 1 ? "כרטיס אחד" : `${pax} כרטיסים`} לכל אירוע - כמספר הנוסעים. שינוי הכמות חל על כל האירועים
          · {doneCount} מתוך {route.length} מוכנים
        </p>
      </div>
      <EventTabs route={route} active={active} isDone={isDone} onSelect={setActiveEvent} />
      <div role="tabpanel" id={PANEL_ID} aria-labelledby={tabId(event.id)}>
        {isFullRow(event) ? (
          <EventTicketPane key={`${event.id}:${pax}`} event={event} />
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
      </div>
    </section>
  );
}
