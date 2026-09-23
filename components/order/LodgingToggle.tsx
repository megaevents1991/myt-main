"use client";

import type { Event } from "@/lib/app.types";
import {
  cityName,
  defaultCity,
  LodgingCity,
  offeredCities,
  splitOffered,
  StaySegment,
} from "@/lib/events/lodging";
import { cn } from "@/lib/utils";

/**
 * The one line above the hotel list on events with two lodging cities:
 * "הלינה ב: <city>" + a button per OTHER offered city, and "מפוצל" when the
 * event allows a split stay. Renders nothing for the common one-city event, so
 * that step looks exactly as before.
 */
export const LodgingToggle = ({
  event,
  city,
  segments,
  disabled,
  onPickCity,
  onOpenSplit,
}: {
  event: Event;
  city: LodgingCity;
  /** Active split (2+ segments) - the line lists the cities in night order. */
  segments: StaySegment[] | null;
  disabled?: boolean;
  onPickCity: (city: LodgingCity) => void;
  onOpenSplit: () => void;
}) => {
  const cities = offeredCities(event);
  const canSplit = splitOffered(event);
  if (cities.length < 2 && !canSplit) return null;

  const split = !!segments && segments.length > 1;
  const btn =
    "rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:opacity-50";
  const cityBtn = cn(
    btn,
    "border-border bg-card text-foreground hover:border-forest hover:bg-forest/5 dark:hover:border-glow dark:hover:bg-glow/10"
  );

  return (
    <div className="flex flex-col gap-1.5" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[15px]">
          הלינה ב:{" "}
          <b>
            {split
              ? `מפוצל · ${segments!.map((s) => cityName(event, s.city)).join(" ← ")}`
              : cityName(event, city)}
          </b>
          {!split && city === defaultCity(event) && (
            <span className="mr-1.5 text-[11px] text-muted-foreground">
              ברירת מחדל
            </span>
          )}
        </span>
        {/* In split mode both cities are offered (leaving the split = every
            night in that city); otherwise only the OTHER city. */}
        {cities
          .filter((c) => split || c !== city)
          .map((c) => (
            <button
              key={c}
              type="button"
              disabled={disabled}
              onClick={() => onPickCity(c)}
              className={cityBtn}
            >
              {cityName(event, c)}
            </button>
          ))}
        {canSplit && (
          <button
            type="button"
            disabled={disabled}
            onClick={onOpenSplit}
            className={cn(
              btn,
              "border-dashed border-forest text-forest hover:bg-forest/5 dark:border-glow dark:text-glow dark:hover:bg-glow/10"
            )}
          >
            {split ? "שינוי הפיצול" : "מפוצל"}
          </button>
        )}
      </div>
      {event.lodging_note && (
        <p className="text-[12px] text-muted-foreground">{event.lodging_note}</p>
      )}
    </div>
  );
};
