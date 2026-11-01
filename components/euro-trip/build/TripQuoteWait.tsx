"use client";

import { useMemo } from "react";
import { Check, Loader2 } from "lucide-react";

import { moveName, stayCityName } from "@/lib/itinerary/builder";
import { stays } from "@/lib/itinerary/dates";
import { flightPartsOf, partDone } from "@/lib/itinerary/flightParts";
import { stayHotelReady, stayRanges } from "@/lib/itinerary/stayAdapter";
import { cn } from "@/lib/utils";
import { useItinerary } from "./ItineraryProvider";
import { useFullRows } from "./useFullRows";

/**
 * The moment between the planner and the tickets (Alon 01.11: "שלא יעלה את אפשרויות העריכה בלי שיש
 * מחיר, עדיף מסך המתנה רגע"): flights and hotels are searched behind it, each line ticks when its
 * recommended pick is in, and the tickets open with a real price on the bar. The flow decides when
 * it ends (`useQuoteWait`); this draws it, and loads the events' whole rows as the tickets step does.
 */
export function TripQuoteWait() {
  const { state } = useItinerary();
  const { route, dates, pax, flight, train, flightParts, hotels, skippedStays } = state;
  useFullRows();

  const trainSet = useMemo(() => new Set(train), [train]);
  const lines = useMemo(() => {
    const parts = flightPartsOf(route, dates, trainSet);
    const flights = parts
      .filter((p) => !p.byTrain)
      .map((p) => ({
        key: p.key,
        label: p.kind === "main" ? "טיסות הלוך חזור" : `טיסה ${moveName(route, p.key)}`,
        done: partDone(p, flightParts, pax),
      }));
    const ranges = stayRanges(route, dates, flight, trainSet);
    const nights = stays(route, dates).map((stay, i) => ({
      key: `hotel-${stay.key}`,
      label: `מלון ב${stayCityName(stay.events[0])}`,
      done: skippedStays.includes(stay.key) || stayHotelReady(hotels[stay.key], ranges[i], pax),
    }));
    // Every open flight is being searched; the hotels start once the flights give them their nights.
    const flightsIn = flights.every((l) => l.done);
    return [
      ...flights.map((l) => ({ ...l, working: !l.done })),
      ...nights.map((l) => ({ ...l, working: !l.done && flightsIn })),
    ];
  }, [route, dates, trainSet, flightParts, pax, flight, hotels, skippedStays]);

  return (
    <section role="status" aria-live="polite" className="mx-auto flex w-full max-w-md flex-col gap-5 py-8">
      <div className="flex flex-col gap-1.5 text-center">
        <h2 className="m-0 font-display text-2xl font-extrabold leading-tight">מרכיבים את הטריפ שלכם</h2>
        <p className="m-0 text-sm text-muted-foreground">בודקים טיסות ומלונות לכל המסלול, כדי שתראו מחיר אמיתי מהרגע הראשון.</p>
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {lines.map((l) => (
          <li
            key={l.key}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors",
              l.done ? "border-primary/60 bg-primary/[0.08]" : "border-border bg-card",
              !l.done && !l.working && "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full",
                l.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
              aria-hidden
            >
              {l.done ? (
                <Check className="size-3.5" strokeWidth={3} />
              ) : l.working ? (
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
              ) : null}
            </span>
            {l.label}
            <span className="sr-only">{l.done ? " - מוכן" : " - בבדיקה"}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
