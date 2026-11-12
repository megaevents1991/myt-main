"use client";

import { useMemo } from "react";
import { BedDouble, Split, TrainFront, type LucideIcon } from "lucide-react";

import { eventCityName } from "@/lib/events/lodging";
import { dayMonth, eventHeadline } from "@/lib/itinerary/builder";
import { eventDay } from "@/lib/itinerary/geo";
import { stayChoices, type StayChoice, type StayOption } from "@/lib/itinerary/stayChoice";
import { eventNounHe } from "@/lib/search";
import { cn } from "@/lib/utils";
import { useItinerary } from "./ItineraryProvider";

/** What each way of sleeping means for the day of the event, under its label. */
function optionSub(c: StayChoice, o: StayOption): { sub: string; Icon: LucideIcon } {
  const noun = eventNounHe(c.event);
  if (o.pick === "shared") return { sub: "בלי להחליף מלון", Icon: BedDouble };
  if (o.pick === "event") return { sub: `ישנים ליד ${noun}`, Icon: c.fallback === "shared" ? Split : BedDouble };
  return { sub: `רכבת ל${eventCityName(c.event)} ביום ${noun}`, Icon: TrainFront };
}

/**
 * "איפה ישנים?" on the trip's hotels step (Alon 12.11, notes 3 / 10 / 11 / 12; Dor: in the hotels
 * step, like the single-event order's choice): for every Manchester / Liverpool match of the trip,
 * a hotel where it is played, in its flight city (London - a day trip by train), or the hotel of the
 * match before it (Liverpool after Manchester). The single-event step's tiles (LodgingToggle).
 * Choosing the default drops the pick (`fallback`); a choice reshapes the stays - the flights stay.
 */
export function TripStayChoices({ className }: { className?: string }) {
  const { state, setStay } = useItinerary();
  const choices = useMemo(() => stayChoices(state.route), [state.route]);
  if (!choices.length) return null;

  return (
    <section aria-labelledby="trip-stay-choices" className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 md:p-4", className)}>
      <h2 id="trip-stay-choices" className="m-0 text-base font-bold">
        איפה ישנים?
      </h2>
      {choices.map((c) => (
        <div key={c.event.id} className="flex flex-col gap-2">
          <p className="m-0 text-[13px] text-muted-foreground">
            <b className="text-foreground">{eventHeadline(c.event)}</b> · {eventCityName(c.event)} ·{" "}
            <span className="tabular-nums">{dayMonth(eventDay(c.event))}</span>
          </p>
          <div
            role="radiogroup"
            aria-label={`איפה ישנים ל${eventHeadline(c.event)}`}
            className={cn("grid gap-2", c.options.length > 2 ? "grid-cols-3" : "grid-cols-2", "lg:flex lg:flex-wrap")}
          >
            {c.options.map((o) => {
              const active = c.current === o.pick;
              const { sub, Icon } = optionSub(c, o);
              return (
                <button
                  key={o.pick}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    if (active) return;
                    setStay(c.event.id, o.pick === "shared" || o.pick === c.fallback ? null : o.pick);
                  }}
                  className={cn(
                    "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] px-2 py-2.5 text-center leading-tight transition-colors lg:min-w-[190px] lg:flex-row lg:justify-start lg:gap-2.5 lg:px-3.5 lg:text-right",
                    active
                      ? "border-forest bg-forest/10 dark:border-glow dark:bg-glow/10"
                      : "border-border bg-card hover:border-forest/60 dark:hover:border-glow/60",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px]",
                      active ? "border-forest dark:border-glow" : "border-muted-foreground/60",
                    )}
                  >
                    {active && <span className="size-2 rounded-full bg-forest dark:bg-glow" />}
                  </span>
                  <span className="flex min-w-0 flex-col items-center gap-0.5 lg:items-start">
                    <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-foreground lg:text-[14px]">
                      <Icon
                        className={cn("hidden size-4 shrink-0 lg:block", active ? "text-forest dark:text-glow" : "text-muted-foreground")}
                        strokeWidth={1.8}
                        aria-hidden
                      />
                      {o.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground lg:text-xs">{sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
