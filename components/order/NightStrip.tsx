"use client";

import { useState } from "react";
import dayjs from "dayjs";
import type { Event } from "@/lib/app.types";
import { cityName, flipNight, MAX_SEGMENTS, NightAssign } from "@/lib/events/lodging";
import { eventNounHe } from "@/lib/search";
import { cn } from "@/lib/utils";

/**
 * The strip of night buttons: a tap flips that night's city, within
 * MAX_SEGMENTS. The "איפה ישנים?" plan popup lays out the whole stay with it.
 */
export const NightStrip = ({
  event,
  nights,
  onChange,
}: {
  event: Event;
  nights: NightAssign[];
  onChange: (nights: NightAssign[]) => void;
}) => {
  const [limitHit, setLimitHit] = useState(false);
  const eventDay = (event.date ?? "").slice(0, 10);

  const flip = (i: number) => {
    const next = flipNight(nights, i);
    if (!next) {
      setLimitHit(true);
      return;
    }
    setLimitHit(false);
    onChange(next);
  };

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {nights.map((n, i) => {
          const isEvent = n.city === "event";
          return (
            <button
              key={n.date}
              type="button"
              onClick={() => flip(i)}
              aria-pressed={isEvent}
              className={cn(
                "relative flex min-w-[84px] flex-col items-center gap-0.5 rounded-xl border-[1.5px] px-2 py-2.5 text-center transition-colors",
                isEvent
                  ? "border-forest bg-forest/10 dark:border-glow dark:bg-glow/10"
                  : "border-border bg-card hover:border-forest dark:hover:border-glow"
              )}
            >
              <span className="text-[13px] font-bold tabular-nums" dir="ltr">
                {dayjs(n.date).format("DD.MM")}
              </span>
              <span className="text-[12px] text-foreground">
                {cityName(event, n.city)}
              </span>
              {n.date === eventDay && (
                <span className="mt-0.5 rounded-full bg-forest px-1.5 py-[1px] text-[10px] font-bold text-white dark:bg-glow dark:text-background">
                  {eventNounHe(event)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {limitHit && (
        <p className="text-[12px] text-destructive">
          {`אפשר עד ${MAX_SEGMENTS} מקטעים. החליפו קודם לילה סמוך.`}
        </p>
      )}
    </>
  );
};
