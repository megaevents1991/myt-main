"use client";

import { useLayoutEffect, useRef } from "react";
import { ChevronLeft, Plane } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  dayMonth,
  dayMonthYear,
  FLIGHT_PATH,
  flightPoses,
  planePose,
  planeSpot,
  tripTitle,
  type PlanePose,
} from "@/lib/itinerary/builder";
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

/** The path's drawing is 48px high (`h-12`); a hop is about 160px wide, on a phone and a desktop alike. */
const PATH_PX = 48;
const HOP_SLOPE = PATH_PX / 160;
const FLIGHT_EASE = "cubic-bezier(0.77, 0, 0.175, 1)";

const px = (n: number): number => Math.round(n * 100) / 100;
/** The track's left edge carries the plane: across by the path's own width (%), down by the arc. */
const trackAt = (p: PlanePose): string => `translate3d(${px((1 - p.along) * 100)}%, ${px(p.down * PATH_PX)}px, 0)`;
/** The icon points up and to the right: -135deg turns its nose the way the trip goes, the tilt follows the arc. */
const planeAt = (p: PlanePose): string => `translate(-50%, -50%) rotate(${px(p.tilt - 135)}deg)`;

/**
 * The trip's flight path over the planner: one hop between every two stops, the stops filling with
 * the events as they are picked. The screen's one bold thing (Alon 01.11: the planner read pale).
 * The plane rides the dashed line itself and flies it with every event picked or removed - up the
 * arc, down behind the stop it passes, up the next (Dor 11.11).
 */
function RouteHops() {
  const { state, settings } = useItinerary();
  const { route } = state;
  const stops = Math.max(settings.maxEvents, route.length, 2);
  const hop = 100 / (stops - 1);
  const { box, base, control } = FLIGHT_PATH;
  const path = Array.from({ length: stops - 1 }, (_, i) => `Q ${hop * i + hop / 2} ${control} ${hop * (i + 1)} ${base}`).join(" ");
  const spot = planeSpot(route.length, stops);
  const pose = planePose(spot, stops, HOP_SLOPE);

  const track = useRef<HTMLDivElement>(null);
  const plane = useRef<SVGSVGElement>(null);
  // The spot the plane was last sent to: its next flight starts there.
  const shown = useRef(spot);

  // Before paint - the plane must never be seen at its new place and then fly to it.
  useLayoutEffect(() => {
    const from = shown.current;
    shown.current = spot;
    const t = track.current;
    const p = plane.current;
    if (from === spot || !t || !p || typeof t.animate !== "function") return;
    // Reduced motion: the plane is simply at its new place (the styles below).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Two transforms on one clock, off the main thread: the list under the header re-renders on a pick.
    const poses = flightPoses(from, spot, stops, HOP_SLOPE);
    const timing = { duration: Math.min(900, 380 + 380 * Math.abs(spot - from)), easing: FLIGHT_EASE };
    const flights = [
      t.animate(poses.map((x) => ({ transform: trackAt(x) })), timing),
      p.animate(poses.map((x) => ({ transform: planeAt(x) })), timing),
    ];
    return () => {
      // Cut short by the next pick: that flight starts where this one is now.
      const line = t.parentElement?.getBoundingClientRect();
      if (flights[0].playState === "running" && line && line.width > 0) {
        shown.current = ((line.right - t.getBoundingClientRect().left) / line.width) * (stops - 1);
      }
      flights.forEach((f) => f.cancel());
    };
  }, [spot, stops]);

  return (
    <div className="relative w-full overflow-x-clip lg:max-w-sm" aria-hidden>
      <div className="absolute inset-x-[22px] top-0 h-12">
        <svg viewBox={`0 0 100 ${box}`} preserveAspectRatio="none" className="size-full overflow-visible" fill="none">
          <path
            d={`M 0 ${base} ${path}`}
            stroke="hsl(var(--primary))"
            strokeWidth="1.5"
            strokeDasharray="3 6"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* A track as wide as the path: a transform in % moves the plane by the path's own width. It
            waits on the right - the page's start side, where overflow cannot scroll; physical sides on
            purpose, like the path's drawing. The stops are drawn after it, so the plane passes behind them. */}
        <div ref={track} className="pointer-events-none absolute inset-0" style={{ transform: trackAt(pose) }}>
          <Plane
            ref={plane}
            className="absolute left-0 top-0 size-4 fill-primary text-primary"
            style={{ transform: planeAt(pose) }}
          />
        </div>
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
  const cities = tripTitle(route);
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

/** The title stays on one line whatever its length (Dor 01.11): the longer it is, the smaller. */
function titleSize(title: string): string {
  if (title.length > 42) return "whitespace-nowrap text-[13px] sm:text-lg md:text-2xl";
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
  const cities = tripTitle(route);

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
