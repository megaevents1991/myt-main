"use client";

import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { dayMonthYear, tripCities } from "@/lib/itinerary/builder";
import { dayDiff } from "@/lib/itinerary/geo";
import { TripEventArt } from "./TripEventArt";
import { useItinerary } from "./ItineraryProvider";
import { nightsLabel } from "./parts";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * "עריכת המסלול" - a quiet link back to the planner with the same events: the trip leaves the
 * ready-trip flow for good (mode `custom`), its picks stay. Nothing once the trip is held (it is
 * with sales - nothing left to edit on this page); off while the hold is on its way
 * (`holdSending` - its answer is read on the summary).
 */
export function EditRouteLink({ className }: { className?: string }) {
  const { setMode, goStep, held, holdSending } = useItinerary();
  if (held) return null;
  return (
    <button
      type="button"
      disabled={holdSending}
      aria-disabled={holdSending}
      onClick={() => {
        if (holdSending) return;
        setMode("custom");
        goStep("build");
      }}
      className={cn(
        "inline-flex w-fit items-center gap-0.5 text-sm font-semibold text-forest underline decoration-forest/40 underline-offset-2 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 dark:text-glow dark:decoration-glow/40",
        className,
      )}
    >
      עריכת המסלול
      <ChevronLeft className="size-4" aria-hidden />
    </button>
  );
}

/**
 * The trip's header, in the order steps' header band (EventDataHeader): the events' round
 * art overlapping, the cities as the title, then dates · events · nights.
 */
export function TripHeader() {
  const { state, settings, held } = useItinerary();
  const { route, dates, step } = state;
  const datesValid = route.length > 0 && DAY_RE.test(dates.depart) && DAY_RE.test(dates.ret);
  const count = route.length === 1 ? "אירוע אחד" : `${route.length} אירועים`;

  return (
    <div dir="rtl" className="w-full bg-muted px-4 py-3 lg:py-4">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-0 lg:px-6">
        {route.length > 0 && (
          <div className="flex shrink-0" aria-hidden>
            {route.map((e, i) => (
              <TripEventArt
                key={e.id}
                event={e}
                sizes="80px"
                className={cn(
                  "size-14 shrink-0 rounded-full border-2 border-white shadow-md md:size-20",
                  i > 0 && "-ms-5 md:-ms-7",
                )}
              />
            ))}
          </div>
        )}
        <div className="flex min-w-0 flex-col">
          <h1 className="m-0 flex flex-col text-base font-normal">
            <span className="mb-1 text-2xl font-bold leading-tight md:text-3xl">
              {route.length ? tripCities(route).join(" ← ") : "בנו את היורו טריפ שלכם"}
            </span>
            {/* Two lines on a phone (dates / events · nights), one from 640px with the "|" between. */}
            <span className="text-sm tabular-nums md:text-xl">
              {datesValid ? (
                <>
                  <span className="block whitespace-nowrap sm:inline">
                    {dayMonthYear(dates.depart)} – {dayMonthYear(dates.ret)}
                    <span className="hidden sm:inline"> |</span>
                  </span>{" "}
                  <span className="block whitespace-nowrap sm:inline">
                    {count} · {nightsLabel(dayDiff(dates.depart, dates.ret))}
                  </span>
                </>
              ) : (
                "בחרו את האירוע הראשון"
              )}
            </span>
          </h1>
          {/* Held: the trip is with sales - nothing left to edit on this page. */}
          {held ? null : step !== "build" ? (
            <EditRouteLink className="mt-1" />
          ) : (
            <span className="mt-1 text-sm font-semibold text-muted-foreground">
              עד {settings.maxEvents} אירועים · כדורגל והופעות במיקס
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
