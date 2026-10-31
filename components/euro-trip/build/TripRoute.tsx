"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Route } from "lucide-react";

import { dayMonth } from "@/lib/itinerary/builder";
import { tripDays, tripStops, type TripStop } from "@/lib/itinerary/tripRoute";
import { cn } from "@/lib/utils";
import { useItinerary } from "./ItineraryProvider";

/** A stop's second line: the day (and the city, for an event); a stay has none. */
const stopDetail = (s: TripStop): string | null =>
  s.kind === "stay" ? null : s.kind === "ground" ? s.detail : s.kind === "event" ? `${dayMonth(s.day)} · ${s.city}` : dayMonth(s.day);

/**
 * The summary's "מסלול (N ימים)" - the whole trip, stop by stop, above the rows that edit it
 * (Alon 28.10, the Mega Family tour page's route look; Dor: one row per stop). Open by default,
 * folds away on its header. Reads the trip's own state only: nothing here can be edited - every
 * change goes through the rows under it.
 */
export function TripRoute() {
  const { state } = useItinerary();
  const { route, dates, train } = state;
  const stops = useMemo(() => tripStops(route, dates, new Set(train)), [route, dates, train]);
  const days = tripDays(dates);
  const [open, setOpen] = useState(true);
  if (!stops.length) return null;

  return (
    <section dir="rtl" aria-labelledby="trip-route-title" className="border-b border-border px-4 py-4 md:px-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="trip-route-list"
        className="flex w-full items-center gap-3 rounded-md text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest dark:focus-visible:outline-glow"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary" aria-hidden>
          <Route className="size-5" />
        </span>
        <span id="trip-route-title" className="flex-1 text-lg font-bold">
          מסלול{days !== null && <span className="font-normal text-muted-foreground"> ({days} ימים)</span>}
        </span>
        <ChevronDown className={cn("size-5 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ol id="trip-route-list" className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
          {stops.map((s, i) => {
            const detail = stopDetail(s);
            return (
              <li key={`${s.kind}-${i}`} className="flex items-start gap-3">
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold tabular-nums text-primary"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <b className="text-[15px]">{s.title}</b>
                  {detail && <span className="mt-0.5 text-[13px] tabular-nums text-muted-foreground">{detail}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
