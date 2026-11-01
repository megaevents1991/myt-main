"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { dayMonth } from "@/lib/itinerary/builder";
import { addDays } from "@/lib/itinerary/dates";
import { cn } from "@/lib/utils";

/**
 * A trip date with a day back / a day forward, inside its range (`tripDateBounds`): the planner
 * panel's departure, move and return rows and the flights step's move. The date stands between its
 * two arrows, in one mint control, and the row says it can be moved (Alon 01.11: "לא מספיק בולט
 * שאפשר לערוך פה"). The caller sends every change through the provider's `setDates` - the reducer
 * clamps it again. A date whose range is one day has no control: it is just said.
 * `children`: a small line under the row (the flights step's "אגיע עצמאית").
 */
export function DateStepper({
  label,
  value,
  range: [min, max],
  onChange,
  icon,
  children,
  className,
}: {
  label: string;
  value: string;
  range: [string, string];
  onChange: (day: string) => void;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const btn =
    "flex size-8 items-center justify-center rounded-full bg-main text-main-foreground transition-colors hover:bg-main/85 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-foreground/25 dark:bg-foreground dark:text-background dark:disabled:bg-transparent dark:disabled:text-foreground/25";
  // One possible day: the row says the date and nothing more - no arrows to press (Alon 28.10:
  // "אם אין איך להזיז את המעבר - שיהיה לא לחיץ").
  const fixed = min >= max;
  return (
    <div className={cn("relative flex flex-col gap-1.5 rounded-xl border border-border bg-background py-1.5 pe-1.5 ps-4", className)}>
      <div className="flex min-h-9 items-center gap-2 text-[13px] font-bold">
        {icon}
        <span className="min-w-0 flex-1 leading-tight">
          {label}
          {fixed ? (
            <span className="sr-only"> - תאריך קבוע</span>
          ) : (
            <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">אפשר להזיז את התאריך</span>
          )}
        </span>
        {fixed ? (
          <b className="whitespace-nowrap pe-2.5 text-sm tabular-nums">{dayMonth(value)}</b>
        ) : (
          <span className="flex shrink-0 items-center rounded-full border border-primary bg-primary/15 p-0.5">
            <button
              type="button"
              className={btn}
              onClick={() => onChange(addDays(value, -1))}
              disabled={value <= min}
              aria-label={`${label} - יום קודם`}
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
            <b className="w-12 text-center text-sm tabular-nums">{dayMonth(value)}</b>
            <button
              type="button"
              className={btn}
              onClick={() => onChange(addDays(value, 1))}
              disabled={value >= max}
              aria-label={`${label} - יום הבא`}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
