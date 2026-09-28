"use client";

import type { Event } from "@/lib/app.types";
import {
  cityName,
  LodgingCity,
  offeredCities,
  splitOffered,
  StaySegment,
} from "@/lib/events/lodging";

/**
 * The one line above the hotel list on events with two lodging cities:
 * "הלינה ב: <city>" (or the split, in night order) and ONE button that
 * reopens "איפה ישנים?" (Alon 25.09 - no per-city buttons here any more; the
 * popup's night squares are the one place the stay is laid out). Renders
 * nothing for the common one-city event, so that step looks exactly as before.
 */
export const LodgingToggle = ({
  event,
  city,
  segments,
  disabled,
  onChangePlan,
}: {
  event: Event;
  city: LodgingCity;
  /** Active split (2+ segments) - the line lists the cities in night order. */
  segments: StaySegment[] | null;
  disabled?: boolean;
  onChangePlan: () => void;
}) => {
  const canSplit = splitOffered(event);
  if (offeredCities(event).length < 2 && !canSplit) return null;

  const split = !!segments && segments.length > 1;

  return (
    <div className="flex flex-col gap-1.5" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[15px]">
          הלינה ב:{" "}
          <b>
            {split
              ? segments!.map((s) => cityName(event, s.city)).join(" ← ")
              : cityName(event, city)}
          </b>
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onChangePlan}
          className="rounded-lg border border-dashed border-forest px-3 py-1.5 text-[13px] font-semibold text-forest transition-colors hover:bg-forest/5 disabled:opacity-50 dark:border-glow dark:text-glow dark:hover:bg-glow/10"
        >
          {canSplit ? "שנה חלוקה" : "שנה עיר"}
        </button>
      </div>
      {event.lodging_note && (
        <p className="text-[12px] text-muted-foreground">{event.lodging_note}</p>
      )}
    </div>
  );
};
