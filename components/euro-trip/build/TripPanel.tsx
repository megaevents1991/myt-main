"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { BedDouble, PlaneLanding, PlaneTakeoff, Plus, Route, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { eventCityName } from "@/lib/events/lodging";
import { dayMonth, stayCityName } from "@/lib/itinerary/builder";
import { applyDatePick, datePickSteps, type DatePickStep } from "@/lib/itinerary/datePick";
import { moves } from "@/lib/itinerary/dates";
import { eventDay } from "@/lib/itinerary/geo";
import { progressivePrice } from "@/lib/itinerary/progress";
import { MIN_TRIP_EVENTS } from "@/lib/itinerary/state";
import { DateStepper } from "./DateStepper";
import { EventPickerModal } from "./EventPickerModal";
import { useItinerary } from "./ItineraryProvider";
import { PANEL, PanelTitle } from "./parts";
import { TripEventArt } from "./TripEventArt";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const SLOT_LABELS = ["אירוע ראשון", "אירוע שני", "אירוע שלישי (לא חובה)"];

/** A slot's label; past the named three (a wider `max_events`) it is numbered, and optional. */
const slotLabel = (i: number): string => SLOT_LABELS[i] ?? `אירוע ${i + 1} (לא חובה)`;

const rowIcon = (icon: ReactNode) => (
  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
    {icon}
  </span>
);

/**
 * "הטריפ שלכם" - the planner's side panel (Alon's sketch). The trip in order, filling as events
 * are picked: the flight out, each event (art, name, DD/MM · city, ×) and between two of them the
 * move to the next city (or "נשארים ב..." when both are in one), the empty slots (dashed - a tap
 * opens the "הוסף אירוע" popup), the flight home, then the CTA. The departure, move and return
 * rows carry the day arrows (`DateStepper`); their labels, dates and ranges are the trip's ONE
 * date rule (`datePickSteps` - the flights step's calendar reads the same), and a change goes
 * through `applyDatePick` (`setDates` clamps again). The rows come from the route itself
 * (`moves`): an event picked before another re-orders it all.
 */
export function TripPanel({ className }: { className?: string }) {
  const { state, settings, removeEvent, setDates, goStep } = useItinerary();
  // The popup, and whether closing it hands the focus back to the slot that opened it: after a
  // pick that slot is gone (or is another slot now) - the focus goes to the panel's heading.
  const [picker, setPicker] = useState({ opened: false, returnFocus: true });
  const heading = useRef<HTMLSpanElement>(null);
  const focusHeading = useRef(false);
  // What the last arrow press set, read out by screen readers ("מעבר למדריד 05/11").
  const [said, setSaid] = useState("");
  const { route, dates, train } = state;

  const dated = route.length > 0 && DAY_RE.test(dates.depart) && DAY_RE.test(dates.ret);
  const steps = dated ? datePickSteps(route, dates, new Set(train)) : [];
  const stepByKey = new Map(steps.map((s) => [s.key, s]));
  const departStep = stepByKey.get("depart");
  const retStep = stepByKey.get("ret");
  const moveKeys = new Set(moves(route).map((m) => m.key));
  const enough = route.length >= MIN_TRIP_EVENTS;
  const estimate = enough ? progressivePrice(state, settings).perTraveller : 0;
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
    <section className={cn(PANEL, "flex flex-col gap-2", className)} aria-labelledby="trip-panel-heading">
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

      <ol className="m-0 mt-1 flex list-none flex-col gap-2 p-0">
        {departStep && dateRow(departStep, <PlaneTakeoff className="size-4" />)}

        {route.map((e, i) => {
          const prev = route[i - 1];
          const moveKey = prev ? `${prev.id}>${e.id}` : "";
          const moveStep = stepByKey.get(moveKey);
          return (
            <Fragment key={e.id}>
              {prev &&
                (moveKeys.has(moveKey) ? (
                  moveStep && dateRow(moveStep, <Route className="size-4" />)
                ) : (
                  <li className="flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-border px-3 py-1 text-[13px] font-bold text-muted-foreground">
                    {rowIcon(<BedDouble className="size-4" />)}
                    נשארים ב{stayCityName(e)}
                  </li>
                ))}
              <li className="flex min-h-[60px] items-center gap-2.5 rounded-2xl border-[1.5px] border-primary/60 bg-primary/[0.08] p-2">
                <TripEventArt event={e} sizes="44px" className="size-11 shrink-0 rounded-full border-2 border-white" />
                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                  <b className="truncate text-[14px]" title={e.name}>
                    {e.name}
                  </b>
                  <span className="text-[12.5px] text-muted-foreground">
                    <span className="tabular-nums">{dayMonth(eventDay(e))}</span> · {eventCityName(e)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeEvent(e.id)}
                  aria-label={`הסרת ${e.name} מהמסלול`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            </Fragment>
          );
        })}

        {open.map((i) => (
          <li key={`slot-${i}`}>
            <button
              type="button"
              onClick={() => setPicker({ opened: true, returnFocus: true })}
              aria-haspopup="dialog"
              className="flex min-h-[60px] w-full items-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-border bg-card p-2 text-start text-[13.5px] text-muted-foreground transition-colors hover:border-primary/60 hover:bg-primary/[0.04] hover:text-foreground"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground" aria-hidden>
                <Plus className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <b className="font-display font-black text-foreground">{i + 1}</b> · {slotLabel(i)}
              </span>
            </button>
          </li>
        ))}

        {retStep && dateRow(retStep, <PlaneLanding className="size-4" />)}
      </ol>

      <button
        type="button"
        onClick={() => goStep("tickets")}
        disabled={!enough}
        className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
      >
        {enough ? "המשיכו לבחירת כרטיסים" : "בחרו עוד אירוע כדי להמשיך"}
      </button>
      {enough && estimate > 0 && (
        <p className="m-0 text-center text-[13px] text-muted-foreground">
          הערכה: <b className="tabular-nums text-foreground">${estimate.toLocaleString("en-US")}</b> לנוסע
        </p>
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
