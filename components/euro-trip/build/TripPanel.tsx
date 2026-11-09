"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { BedDouble, PlaneLanding, PlaneTakeoff, Plus, Route, TrainFront, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { eventCityName } from "@/lib/events/lodging";
import { dayMonth, stayCityName } from "@/lib/itinerary/builder";
import { applyDatePick, datePickSteps, type DatePickStep } from "@/lib/itinerary/datePick";
import { eventGrounds, moves, stayHeads } from "@/lib/itinerary/dates";
import { canFlyDirect, eventCityAirport } from "@/lib/itinerary/direct";
import { trainHours } from "@/lib/itinerary/flightsView";
import { eventDay, sameHub } from "@/lib/itinerary/geo";
import { MIN_TRIP_EVENTS } from "@/lib/itinerary/state";
import { DateStepper } from "./DateStepper";
import { EventPickerModal } from "./EventPickerModal";
import { useItinerary } from "./ItineraryProvider";
import { PANEL, PanelTitle } from "./parts";
import { TripEventArt } from "./TripEventArt";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const SLOT_LABELS = ["אירוע ראשון", "אירוע שני", "אירוע שלישי (לא חובה)"];
const NEXT_LABELS = ["בחרו את האירוע הראשון", "בחרו את האירוע השני"];

/** A slot's label; past the named three (a wider `max_events`) it is numbered, and optional. */
const slotLabel = (i: number): string => SLOT_LABELS[i] ?? `אירוע ${i + 1} (לא חובה)`;

const rowIcon = (icon: ReactNode) => (
  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
    {icon}
  </span>
);

/**
 * A small switch, in the flights step's look: flying straight to the event's own city or taking the
 * train from the flight city (lib/itinerary/direct.ts).
 */
function DirectSwitch({ city, on, onToggle }: { city: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-full text-start text-xs font-bold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest dark:focus-visible:outline-glow"
    >
      <span aria-hidden className={cn("relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors", on ? "bg-forest dark:bg-glow" : "bg-foreground/20")}>
        <span
          className={cn(
            "absolute top-[2px] size-[14px] rounded-full bg-white shadow-sm transition-[inset-inline-start] duration-200 dark:bg-background",
            on ? "start-[14px]" : "start-[2px]",
          )}
        />
      </span>
      {on ? `טסים ישר ל${city}` : `לטוס ישר ל${city}`}
    </button>
  );
}

/**
 * "הטריפ שלכם" - the planner's side panel (Alon's sketch). The trip in order, its rows joined by the
 * route's line: the flight out, each event (art, name, DD/MM · city, ×) and between two of them the
 * move to the next city, the way to an event in another city under one hotel (Manchester from
 * London: "הגעה עצמאית למנצ'סטר", Alon 01.11) or "נשארים ב...", the empty slots - the next one to
 * pick is the mint one, a tap opens the "הוסף אירוע" popup - and the flight home. From 1024px the CTA
 * closes the panel; a phone has the sticky bar. The departure, move and return rows carry the day
 * arrows (`DateStepper`); their labels, dates and ranges are the trip's ONE date rule
 * (`datePickSteps` - the flights step's calendar reads the same), and a change goes through
 * `applyDatePick` (`setDates` clamps again). The rows come from the route itself (`moves`): an event
 * picked before another re-orders it all.
 */
export function TripPanel({ className }: { className?: string }) {
  const { state, settings, removeEvent, setDates, setDirect, goStep } = useItinerary();
  // The popup, and whether closing it hands the focus back to the slot that opened it: after a
  // pick that slot is gone (or is another slot now) - the focus goes to the panel's heading.
  const [picker, setPicker] = useState({ opened: false, returnFocus: true });
  const heading = useRef<HTMLSpanElement>(null);
  const focusHeading = useRef(false);
  // What the last arrow press set, read out by screen readers ("מעבר למדריד 05/11").
  const [said, setSaid] = useState("");
  const { route, dates, train, directEvents } = state;

  const dated = route.length > 0 && DAY_RE.test(dates.depart) && DAY_RE.test(dates.ret);
  const steps = dated ? datePickSteps(route, dates, new Set(train)) : [];
  const stepByKey = new Map(steps.map((s) => [s.key, s]));
  const departStep = stepByKey.get("depart");
  const retStep = stepByKey.get("ret");
  const moveKeys = new Set(moves(route).map((m) => m.key));
  // The way to an event the customer makes alone: a train from the hotel, or from the airport.
  const grounds = eventGrounds(route, new Set(train));
  const heads = stayHeads(route);
  const enough = route.length >= MIN_TRIP_EVENTS;
  const open = Array.from({ length: Math.max(0, settings.maxEvents - route.length) }, (_, k) => route.length + k);

  useEffect(() => {
    if (picker.opened || !focusHeading.current) return;
    focusHeading.current = false;
    heading.current?.focus();
  }, [picker.opened]);

  const dateRow = (s: DatePickStep, icon: ReactNode) => (
    <li>
      <DateStepper
        label={s.label}
        value={s.value}
        range={[s.min, s.max]}
        icon={rowIcon(icon)}
        onChange={(day) => {
          setDates(applyDatePick(route, dates, s.key, day));
          setSaid(`${s.label} ${dayMonth(day)}`);
        }}
      />
    </li>
  );

  return (
    <section className={cn(PANEL, "flex flex-col gap-2 rounded-3xl shadow-xl", className)} aria-labelledby="trip-panel-heading">
      <PanelTitle>
        <span
          id="trip-panel-heading"
          ref={heading}
          tabIndex={-1}
          className="rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest dark:focus-visible:outline-glow"
        >
          הטריפ שלכם
        </span>
      </PanelTitle>

      {/* The route's line: it shows in the gaps between the rows, each row is opaque over it. */}
      <ol className="relative m-0 mt-1 flex list-none flex-col gap-2.5 p-0 before:absolute before:inset-y-6 before:start-[30px] before:border-s-2 before:border-dashed before:border-primary">
        {departStep && dateRow(departStep, <PlaneTakeoff className="size-4" />)}

        {route.map((e, i) => {
          const prev = route[i - 1];
          const moveKey = prev ? `${prev.id}>${e.id}` : "";
          const moveStep = stepByKey.get(moveKey);
          const ground = grounds.get(e.id);
          const byGround = !!prev && !moveKeys.has(moveKey);
          const direct = !!directEvents[e.id];
          const canDirect = direct || canFlyDirect(route, e);
          return (
            <Fragment key={e.id}>
              {prev &&
                (moveKeys.has(moveKey) ? (
                  moveStep && dateRow(moveStep, sameHub(prev, e) ? <TrainFront className="size-4" /> : <Route className="size-4" />)
                ) : (
                  <li className="relative flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-border bg-card py-1 pe-3 ps-4 text-[13px] font-bold">
                    {rowIcon(ground ? <TrainFront className="size-4" /> : <BedDouble className="size-4" />)}
                    {ground ? (
                      <span className="flex min-w-0 flex-col leading-tight">
                        הגעה עצמאית ל{ground.to}
                        <span className="text-xs font-medium text-muted-foreground">
                          רכבת מ{ground.from}, כ-{trainHours(ground.km)} שעות · לא כלול
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">נשארים ב{stayCityName(heads.get(e.id) ?? e)}</span>
                    )}
                  </li>
                ))}
              <li className="relative rounded-2xl bg-card">
                <div className="flex min-h-[60px] items-center gap-2.5 rounded-2xl border-[1.5px] border-primary/60 bg-primary/[0.08] p-2">
                  <TripEventArt event={e} sizes="44px" className="size-11 shrink-0 rounded-full border-2 border-white" />
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    <b className="truncate text-[14px]" title={e.name}>
                      {e.name}
                    </b>
                    <span className="text-[12.5px] text-muted-foreground">
                      <span className="tabular-nums">{dayMonth(eventDay(e))}</span> · {eventCityName(e)}
                    </span>
                    {ground && !byGround && (
                      <span className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
                        <TrainFront className="size-3.5 shrink-0" aria-hidden />
                        רכבת מ{ground.from}, כ-{trainHours(ground.km)} שעות
                      </span>
                    )}
                    {canDirect && (
                      <DirectSwitch city={eventCityName(e)} on={direct} onToggle={() => setDirect(e.id, !direct)} />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEvent(e.id)}
                    aria-label={`הסרת ${e.name} מהמסלול`}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            </Fragment>
          );
        })}

        {open.map((i) => {
          // The one to pick now stands out; an optional slot past the trip's minimum stays quiet.
          const next = i === route.length && !enough;
          return (
            <li key={`slot-${i}`} className="relative">
              <button
                type="button"
                onClick={() => setPicker({ opened: true, returnFocus: true })}
                aria-haspopup="dialog"
                className={cn(
                  "flex min-h-[60px] w-full items-center gap-2.5 rounded-2xl border-[1.5px] p-2 text-start text-[14px] transition-colors",
                  next
                    ? "border-primary bg-primary font-bold text-primary-foreground shadow-md hover:bg-primary/90"
                    : "border-dashed border-foreground/25 bg-card text-foreground/75 hover:border-primary hover:bg-primary/[0.06] hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-full",
                    next ? "bg-forest text-primary" : "bg-muted text-foreground",
                  )}
                  aria-hidden
                >
                  <Plus className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  {next ? (
                    (NEXT_LABELS[i] ?? slotLabel(i))
                  ) : (
                    <>
                      <b className="font-display font-black text-foreground">{i + 1}</b> · {slotLabel(i)}
                    </>
                  )}
                </span>
              </button>
            </li>
          );
        })}

        {retStep && dateRow(retStep, <PlaneLanding className="size-4" />)}
      </ol>

      {enough ? (
        <button
          type="button"
          onClick={() => goStep("tickets")}
          className="mt-2 hidden h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground transition-colors hover:bg-primary/90 lg:flex"
        >
          המשיכו לבחירת כרטיסים
        </button>
      ) : (
        route.length > 0 && (
          <p className="m-0 mt-1 text-center text-sm font-semibold text-muted-foreground">עוד אירוע אחד וממשיכים לכרטיסים</p>
        )
      )}

      <p className="sr-only" aria-live="polite">
        {said}
      </p>

      <EventPickerModal
        opened={picker.opened}
        returnFocus={picker.returnFocus}
        onClose={() => setPicker({ opened: false, returnFocus: true })}
        onPicked={() => {
          focusHeading.current = true;
          // Closed in the same render that turns the focus return off: Mantine reads both at once.
          setPicker({ opened: false, returnFocus: false });
        }}
      />
    </section>
  );
}
