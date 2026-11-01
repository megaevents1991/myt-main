"use client";

import { ChevronLeft, Plane } from "lucide-react";

import { cn } from "@/lib/utils";
import { dayMonth, dayMonthYear, tripCities } from "@/lib/itinerary/builder";
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
 * The trip's flight path over the planner: one hop between every two stops, the stops filling with
 * the events as they are picked. The screen's one bold thing (Alon 01.11: the planner read pale).
 */
function RouteHops() {
  const { state, settings } = useItinerary();
  const { route } = state;
  const stops = Math.max(settings.maxEvents, route.length, 2);
  const hop = 100 / (stops - 1);
  const path = Array.from({ length: stops - 1 }, (_, i) => `Q ${hop * i + hop / 2} 2 ${hop * (i + 1)} 34`).join(" ");
  // The plane flies the hop to the next stop still open.
  const at = Math.min(route.length, stops - 1);
  const planeHop = Math.max(0, at - 1);

  return (
    <div className="relative w-full lg:max-w-sm" aria-hidden>
      <div className="absolute inset-x-[22px] top-0 h-12">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="size-full overflow-visible" fill="none">
          <path
            d={`M 0 34 ${path}`}
            stroke="hsl(var(--primary))"
            strokeWidth="1.5"
            strokeDasharray="3 6"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <Plane
          className="absolute top-[-4px] size-4 fill-primary text-primary"
          style={{ right: `${hop * planeHop + hop / 2}%`, transform: "translateX(50%) rotate(-135deg)" }}
        />
      </div>
      <ol className="relative m-0 flex list-none items-end justify-between p-0 pt-5">
        {Array.from({ length: stops }, (_, i) => {
          const e = route[i];
          return (
            <li key={e?.id ?? `stop-${i}`}>
              {e ? (
                <TripEventArt event={e} sizes="44px" className="size-11 rounded-full border-2 border-primary" />
              ) : (
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-full border-2 font-display text-base font-black",
                    i === route.length
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-primary/40 bg-forest text-primary/70",
                  )}
                >
                  {i + 1}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The planner's opening band: what this is, and the trip taking shape on its flight path. */
function PlannerHero() {
  const { state, settings } = useItinerary();
  const { route, dates } = state;
  const datesValid = route.length > 0 && DAY_RE.test(dates.depart) && DAY_RE.test(dates.ret);
  const cities = tripCities(route).join(" ← ");
  const count = route.length === 1 ? "אירוע אחד" : `${route.length} אירועים`;

  return (
    <div dir="rtl" className="w-full bg-forest px-4 pb-14 pt-5 text-white lg:pb-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1
            className={cn(
              "m-0 font-display font-extrabold leading-tight",
              route.length ? titleSize(cities) : "text-[28px] md:text-4xl",
            )}
          >
            {route.length ? cities : "בנו את היורו טריפ שלכם"}
          </h1>
          <p className="m-0 text-sm tabular-nums text-white/70 md:text-base">
            {datesValid
              ? `${dayMonth(dates.depart)} - ${dayMonth(dates.ret)}, ${count}, ${nightsLabel(dayDiff(dates.depart, dates.ret))}`
              : `עד ${settings.maxEvents} אירועים בטיול אחד, כדורגל והופעות במיקס`}
          </p>
        </div>
        <RouteHops />
      </div>
    </div>
  );
}

/** The cities' line stays on one line whatever their number (Dor 01.11): the longer it is, the smaller. */
function titleSize(title: string): string {
  if (title.length > 34) return "whitespace-nowrap text-[15px] sm:text-xl md:text-3xl";
  if (title.length > 26) return "whitespace-nowrap text-[17px] sm:text-2xl md:text-3xl";
  return "whitespace-nowrap text-xl sm:text-2xl md:text-3xl";
}

/**
 * The trip's header, in the order steps' header band (EventDataHeader): the cities as the title on
 * one line, then dates · events · nights - low, so the step under it starts high on a phone. The
 * events' art stands beside it from 768px only (Alon 01.11: "אפשר להעיף כאן את התמונות"). On the
 * planner: its own band (`PlannerHero`).
 */
export function TripHeader() {
  const { state, held } = useItinerary();
  const { route, dates, step } = state;
  if (step === "build") return <PlannerHero />;
  const datesValid = route.length > 0 && DAY_RE.test(dates.depart) && DAY_RE.test(dates.ret);
  const count = route.length === 1 ? "אירוע אחד" : `${route.length} אירועים`;
  const cities = tripCities(route).join(" ← ");

  return (
    <div dir="rtl" className="w-full bg-muted px-4 py-2 lg:py-4">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-0 lg:px-6">
        {route.length > 0 && (
          <div className="hidden shrink-0 md:flex" aria-hidden>
            {route.map((e, i) => (
              <TripEventArt
                key={e.id}
                event={e}
                sizes="80px"
                className={cn("size-20 shrink-0 rounded-full border-2 border-white shadow-md", i > 0 && "-ms-7")}
              />
            ))}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="m-0 flex flex-col text-base font-normal">
            <span className={cn("font-bold leading-tight md:mb-1", titleSize(cities))}>{cities}</span>
            <span className="text-xs tabular-nums md:text-xl">
              {datesValid ? (
                <span className="whitespace-nowrap">
                  {dayMonthYear(dates.depart)} – {dayMonthYear(dates.ret)}
                  <span className="mx-1 md:mx-2">|</span>
                  {count} · {nightsLabel(dayDiff(dates.depart, dates.ret))}
                </span>
              ) : null}
            </span>
          </h1>
          {/* Held: the trip is with sales - nothing left to edit on this page. */}
          {!held && <EditRouteLink className="mt-0.5 text-xs md:mt-1 md:text-sm" />}
        </div>
      </div>
    </div>
  );
}
