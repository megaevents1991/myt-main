"use client";

import "@mantine/dates/styles.css";
import "dayjs/locale/he";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Popover } from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { useMediaQuery } from "@mantine/hooks";
import { CalendarDays } from "lucide-react";

import type { Event } from "@/lib/app.types";
import { dayMonth } from "@/lib/itinerary/builder";
import { applyDatePick, datePickSteps, isoDay, localDay, sameTripDates } from "@/lib/itinerary/datePick";
import type { TripDates } from "@/lib/itinerary/types";
import { cn } from "@/lib/utils";
import { ADD_BUTTON } from "./parts";

/**
 * The calendar wears the site's CTA colours instead of Mantine's green: the staged days are the
 * dark "main" pill (light in dark mode), the days between the first and the last a soft tint.
 */
const CALENDAR_TONE = cn(
  "[--mantine-primary-color-filled:hsl(var(--surface-inverse))]",
  "[--mantine-primary-color-filled-hover:hsl(var(--surface-inverse)/0.85)]",
  "[--mantine-primary-color-contrast:hsl(var(--surface-inverse-foreground))]",
  "[--mantine-primary-color-light:hsl(var(--surface-inverse)/0.14)]",
  "[--mantine-primary-color-light-hover:hsl(var(--surface-inverse)/0.08)]",
  "dark:[--mantine-primary-color-filled:hsl(var(--foreground))]",
  "dark:[--mantine-primary-color-filled-hover:hsl(var(--foreground)/0.85)]",
  "dark:[--mantine-primary-color-contrast:hsl(var(--background))]",
  "dark:[--mantine-primary-color-light:hsl(var(--foreground)/0.2)]",
  "dark:[--mantine-primary-color-light-hover:hsl(var(--foreground)/0.12)]",
  "[--picking-ring:hsl(var(--foreground))]",
  "dark:[--picking-ring:hsl(var(--primary))]",
);

/**
 * The date being picked wears a ring (`--picking-ring`, set in CALENDAR_TONE: the page's ink on
 * the light page, mint in dark mode). A box-shadow, not an outline: the day's own focus-visible
 * outline stays Mantine's.
 */
const PICKING: CSSProperties = {
  boxShadow: "0 0 0 1px hsl(var(--background)), 0 0 0 3px var(--picking-ring)",
};
const OFF_STAGED: CSSProperties = {
  backgroundColor: "var(--mantine-primary-color-filled)",
  color: "var(--mantine-primary-color-contrast)",
  opacity: 0.45,
};
const OFF_BAND: CSSProperties = { backgroundColor: "var(--mantine-primary-color-light)", borderRadius: 0 };

/**
 * "Build Your Euro Trip" - the trip's dates, picked in the flights step: a field in the live
 * flight search bar's look ("ובאיזה תאריכים?" and the dates as DD/MM) that opens ONE calendar
 * walking them in trip order (`datePickSteps`): the flight out, each move between stays, the
 * flight home. A click sets that date on a LOCAL draft and moves on to the next; a chip jumps
 * to any one of them. "עדכון הטיסות" hands the draft to `onCommit` once (and does nothing when
 * it equals `dates`); closing any other way throws the draft away, so the trip - and the
 * flight search behind it - stays as it was.
 */
export function TripDatesPicker({
  route,
  dates,
  train,
  onCommit,
}: {
  route: Event[];
  dates: TripDates;
  train: ReadonlySet<string>;
  onCommit: (d: TripDates) => void;
}) {
  const [opened, setOpened] = useState(false);
  // The dates being picked, from the moment the calendar opens; nothing outside sees them.
  const [draft, setDraft] = useState<TripDates>(dates);
  const [at, setAt] = useState(0);
  const [month, setMonth] = useState<Date>(() => localDay(dates.depart));
  const [touched, setTouched] = useState(false);
  const committed = useRef(false);
  const body = useRef<HTMLDivElement>(null);
  // A phone fits 7 columns of the small day size in its narrowest width.
  const roomy = useMediaQuery("(min-width: 400px)");

  const steps = datePickSteps(route, opened ? draft : dates, train);
  const last = steps.length - 1;
  const current = Math.min(at, last);

  // The route or the trip's dates changed under an open calendar (an event removed, a commit
  // elsewhere): the draft was staged on the old trip - it is dropped and the calendar closes.
  const tripKey = `${route.map((e) => e.id).join(",")}|${dates.depart}|${dates.ret}|${Object.entries(dates.moves)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(",")}`;
  useEffect(() => {
    setOpened(false);
  }, [tripKey]);

  // Every step change puts the keyboard on the day now being picked (the old button may be gone
  // with the month that just changed).
  useEffect(() => {
    if (!opened) return;
    body.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    // Only a change of step moves focus - not opening (the focus trap does) or paging months.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  if (steps.length === 0) return null;
  const step = steps[current];

  const open = () => {
    committed.current = false;
    setDraft(dates);
    setTouched(false);
    setAt(0);
    setMonth(localDay(steps[0].value));
    setOpened(true);
  };

  const goTo = (i: number, from: TripDates) => {
    const next = datePickSteps(route, from, train)[i];
    if (!next) return;
    setAt(i);
    setMonth(localDay(next.value));
  };

  const pick = (day: Date | null) => {
    if (!day) return;
    const next = applyDatePick(route, draft, step.key, isoDay(day));
    setDraft(next);
    setTouched(true);
    if (current < last) goTo(current + 1, next);
  };

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    setOpened(false);
    if (!sameTripDates(draft, dates)) onCommit(draft);
  };

  const first = steps[0].value;
  const end = steps[last].value;
  const stepAt = new Map(steps.map((s, i) => [s.value, i]));
  const getDayProps = (date: Date) => {
    const day = isoDay(date);
    const index = stepAt.get(day);
    // Mantine draws neither "selected" nor "in range" on a day this step cannot take, so the
    // trip's other dates would vanish from the calendar - the same look is set by hand there.
    const closed = day < step.min || day > step.max;
    if (index === undefined) {
      const between = day > first && day < end;
      return between ? { inRange: true, style: closed ? OFF_BAND : undefined } : {};
    }
    return {
      selected: true,
      // The date being picked wears a ring, so the eye finds it among the staged ones.
      style: closed ? OFF_STAGED : index === current ? PICKING : undefined,
      "data-autofocus": index === current ? true : undefined,
    };
  };

  const shown = steps.map((s) => dayMonth(s.value)).join(" · ");

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-muted px-3 py-2.5 lg:px-4">
      <span className="text-sm font-bold lg:text-xl">ובאיזה תאריכים?</span>
      <Popover
        opened={opened}
        // Escape and a click outside ask to close: the draft is dropped (the next opening starts over).
        onChange={setOpened}
        position="bottom"
        shadow="md"
        radius="md"
        trapFocus
        returnFocus
      >
        <Popover.Target>
          <button
            type="button"
            onClick={() => (opened ? setOpened(false) : open())}
            aria-label={`ובאיזה תאריכים? ${shown}`}
            className="flex h-[42px] min-w-0 items-center gap-2 rounded-md border border-border bg-background px-3 text-start text-sm font-medium tabular-nums text-foreground transition-colors hover:border-main focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest dark:focus-visible:outline-glow"
          >
            <CalendarDays className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{shown}</span>
          </button>
        </Popover.Target>
        <Popover.Dropdown>
          <div ref={body} dir="rtl" className={cn("flex w-[min(19rem,calc(100vw-4rem))] flex-col gap-3", CALENDAR_TONE)}>
            <p aria-live="polite" className="m-0 font-display text-base font-extrabold leading-tight">
              בחרו: {step.label}
            </p>
            <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {steps.map((s, i) => {
                const active = i === current;
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      onClick={() => goTo(i, draft)}
                      aria-label={`${i + 1}. ${s.label}, ${dayMonth(s.value)}`}
                      aria-current={active ? "step" : undefined}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border py-1 ps-1 pe-2.5 text-xs font-bold tabular-nums transition-colors",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest dark:focus-visible:outline-glow",
                        active
                          ? "border-main bg-main text-main-foreground dark:border-foreground dark:bg-foreground dark:text-background"
                          : "border-border bg-card text-foreground hover:border-main",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-[18px] shrink-0 place-items-center rounded-full text-[10px] font-extrabold",
                          active ? "bg-white/20 dark:bg-background/20" : "bg-muted",
                        )}
                      >
                        {i + 1}
                      </span>
                      {dayMonth(s.value)}
                    </button>
                  </li>
                );
              })}
            </ol>
            <DatePicker
              className="mx-auto"
              size={roomy ? "md" : "sm"}
              value={null}
              onChange={pick}
              minDate={localDay(step.min)}
              maxDate={localDay(step.max)}
              date={month}
              onDateChange={setMonth}
              maxLevel="month"
              hideOutsideDates
              locale="he"
              firstDayOfWeek={0}
              weekendDays={[6]}
              getDayProps={getDayProps}
              ariaLabels={{ previousMonth: "החודש הקודם", nextMonth: "החודש הבא" }}
            />
            <button type="button" onClick={commit} disabled={!touched} className={cn(ADD_BUTTON, "w-full py-2.5 text-sm")}>
              עדכון הטיסות
            </button>
          </div>
        </Popover.Dropdown>
      </Popover>
    </div>
  );
}
