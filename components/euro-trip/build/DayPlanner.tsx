"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { dayMonth } from "@/lib/itinerary/builder";
import { addDays } from "@/lib/itinerary/dates";

/**
 * A trip date with a day back / a day forward, inside its range (`tripDateBounds`): the planner
 * panel's departure, move and return rows ("טיסה הלוך לברצלונה 24/10" and its two arrows). The
 * caller sends every change through the provider's `setDates` - the reducer clamps it again.
 */
export function DateStepper({
  label,
  value,
  range: [min, max],
  onChange,
  icon,
}: {
  label: string;
  value: string;
  range: [string, string];
  onChange: (day: string) => void;
  icon?: ReactNode;
}) {
  const btn =
    "flex size-8 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-30";
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background py-1 pe-1 ps-3 text-[13px] font-bold">
      {icon}
      <span className="min-w-0 flex-1 leading-tight">
        {label} <b className="whitespace-nowrap tabular-nums">{dayMonth(value)}</b>
      </span>
      <span className="flex shrink-0 items-center gap-1">
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
      </span>
    </div>
  );
}
