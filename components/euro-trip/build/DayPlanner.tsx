"use client";

import dayjs from "dayjs";
import "dayjs/locale/he";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { dayMonth, stayCityName } from "@/lib/itinerary/builder";
import { addDays, moves, stays, tripDateBounds } from "@/lib/itinerary/dates";
import { dayDiff, eventDay } from "@/lib/itinerary/geo";
import { MIN_TRIP_EVENTS } from "@/lib/itinerary/state";
import { useItinerary } from "./ItineraryProvider";
import { PANEL, PanelTitle, nightsLabel } from "./parts";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A day cell is never narrower than this: a long trip scrolls inside the panel, not the page. */
const MIN_DAY_PX = 40;

/** One colour per stay, in order (brand neons; dark ink on all of them). */
const STAY_COLORS = ["bg-brand-mint", "bg-brand-aqua", "bg-brand-violet"];

/** A date with a day back / a day forward, inside its range. */
function DateStepper({
  label,
  value,
  range: [min, max],
  onChange,
}: {
  label: string;
  value: string;
  range: [string, string];
  onChange: (day: string) => void;
}) {
  const btn =
    "flex size-8 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-30";
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-background py-1 pe-3 ps-1 text-[13px] font-bold">
      <button
        type="button"
        className={btn}
        onClick={() => onChange(addDays(value, -1))}
        disabled={value <= min}
        aria-label={`${label} - יום קודם`}
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(addDays(value, 1))}
        disabled={value >= max}
        aria-label={`${label} - יום הבא`}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <span>
        {label} <b className="tabular-nums">{dayMonth(value)}</b>
      </span>
    </div>
  );
}

/**
 * "תכנון הימים" - the trip day by day (event days numbered 1/2/3), a band per stay over the
 * nights it holds, and steppers for the departure, each move and the return, inside
 * `tripDateBounds`. Every change goes through `setDates` (the reducer clamps it again).
 */
export function DayPlanner() {
  const { state, setDates } = useItinerary();
  const { route, dates } = state;
  if (route.length < MIN_TRIP_EVENTS || !DAY_RE.test(dates.depart) || !DAY_RE.test(dates.ret)) return null;

  const bounds = tripDateBounds(route, dates);
  const list = stays(route, dates);
  const ms = moves(route);
  const count = dayDiff(dates.depart, dates.ret) + 1;
  const days = Array.from({ length: count }, (_, i) => addDays(dates.depart, i));
  const eventNo = new Map(route.map((e, i) => [eventDay(e), i + 1]));

  return (
    <section className={PANEL} aria-labelledby="trip-days-heading">
      <PanelTitle>
        <span id="trip-days-heading">תכנון הימים</span>
      </PanelTitle>
      <p className="mt-1 text-[13.5px] text-muted-foreground">
        כל לילה שייך לעיר אחת. הזיזו את יום המעבר, והטיסות והמלונות יתעדכנו לפיו.
      </p>

      <div className="-mx-1 mt-1 overflow-x-auto px-1 pb-1 pt-3">
        <div style={{ minWidth: count * MIN_DAY_PX }}>
          <ol className="grid gap-1" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
            {days.map((day) => {
              const n = eventNo.get(day);
              return (
                <li
                  key={day}
                  className={cn(
                    "relative min-h-[54px] rounded-[10px] bg-muted px-0.5 py-1.5 text-center text-[11px] font-bold text-muted-foreground",
                    n && "bg-primary/15 shadow-[inset_0_0_0_1.5px_hsl(var(--primary)/0.6)]",
                  )}
                  aria-label={`${dayMonth(day)}${n ? ` - אירוע ${n}` : ""}`}
                >
                  {n && (
                    <span className="absolute inset-x-0 -top-2 mx-auto w-fit rounded-full bg-primary px-1.5 font-display text-[10.5px] font-black leading-[1.5] text-primary-foreground">
                      {n}
                    </span>
                  )}
                  <span className={cn("block font-display text-[17px] tabular-nums", n ? "text-forest dark:text-primary" : "text-foreground")}>
                    {Number(day.slice(8, 10))}
                  </span>
                  {dayjs(day).locale("he").format("dd")}
                </li>
              );
            })}
          </ol>
          {/* A stay's band runs from the middle of its check-in day to the middle of its check-out day. */}
          <div className="mt-1.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${count * 2}, minmax(0, 1fr))` }}>
            {list.map((stay, i) => (
              <div
                key={stay.key}
                className={cn(
                  "truncate rounded-lg px-2 py-1.5 text-xs font-extrabold text-badge-foreground",
                  STAY_COLORS[i % STAY_COLORS.length],
                )}
                style={{
                  gridColumn: `${dayDiff(dates.depart, stay.from) * 2 + 2} / ${dayDiff(dates.depart, stay.to) * 2 + 2}`,
                  gridRow: 1,
                }}
                title={`${stayCityName(stay.events[0])} · ${nightsLabel(dayDiff(stay.from, stay.to))}`}
              >
                {stayCityName(stay.events[0])}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
        {list.map((stay, i) => (
          <li key={stay.key} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", STAY_COLORS[i % STAY_COLORS.length])} aria-hidden />
            <span>
              <b className="text-foreground">{stayCityName(stay.events[0])}</b> · {dayMonth(stay.from)}–{dayMonth(stay.to)} ·{" "}
              {nightsLabel(dayDiff(stay.from, stay.to))}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <DateStepper
          label="טיסה הלוך"
          value={dates.depart}
          range={bounds.depart}
          onChange={(depart) => setDates({ ...dates, depart })}
        />
        {ms.map((m) => (
          <DateStepper
            key={m.key}
            label={`מעבר ל${stayCityName(m.b)}`}
            value={dates.moves[m.key]}
            range={bounds.moves[m.key]}
            onChange={(day) => setDates({ ...dates, moves: { ...dates.moves, [m.key]: day } })}
          />
        ))}
        <DateStepper label="טיסה חזור" value={dates.ret} range={bounds.ret} onChange={(ret) => setDates({ ...dates, ret })} />
      </div>
    </section>
  );
}
