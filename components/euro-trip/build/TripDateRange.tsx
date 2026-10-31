"use client";

import "@mantine/dates/styles.css";
import "dayjs/locale/he";
import { useState } from "react";
import { DatePickerInput } from "@mantine/dates";
import { useMediaQuery } from "@mantine/hooks";
import { Calendar } from "lucide-react";
import { isMobile } from "react-device-detect";

import type { Event } from "@/lib/app.types";
import { applyDatePick, isoDay, localDay, sameTripDates } from "@/lib/itinerary/datePick";
import { tripDateBounds } from "@/lib/itinerary/dates";
import { eventDay } from "@/lib/itinerary/geo";
import type { TripDates } from "@/lib/itinerary/types";

/**
 * "ובאיזה תאריכים?" of the way there and back - the live flight step's date field (DatePickerInput
 * as components/ui/dateInput.tsx draws it: one range, the events' days ringed), with the trip's limits on it:
 * the departure and the return stay inside `tripDateBounds`, whatever is picked (`applyDatePick`
 * clamps it). The trip changes when the calendar closes, once, and only if a whole new range was
 * picked; half a range goes back to what was.
 */
export function TripDateRange({
  route,
  dates,
  onCommit,
}: {
  route: Event[];
  dates: TripDates;
  onCommit: (d: TripDates) => void;
}) {
  const matches = useMediaQuery("(min-width: 1024px)");
  const shown = (): [Date, Date] => [localDay(dates.depart), localDay(dates.ret)];
  const [draft, setDraft] = useState<[Date | null, Date | null]>(shown);
  // The trip's dates moved from elsewhere (a clamp, a restored draft): the field follows.
  const key = `${dates.depart}|${dates.ret}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setDraft(shown());
  }
  const bounds = tripDateBounds(route, dates);
  const days = new Set(route.map(eventDay));

  const close = () => {
    const [from, to] = draft;
    if (!from || !to) {
      setDraft(shown());
      return;
    }
    const next = applyDatePick(route, applyDatePick(route, dates, "depart", isoDay(from)), "ret", isoDay(to));
    setDraft([localDay(next.depart), localDay(next.ret)]);
    if (!sameTripDates(next, dates)) onCommit(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-muted px-3 py-2.5 lg:px-4">
      <span className="text-sm font-bold lg:text-xl">ובאיזה תאריכים?</span>
      <DatePickerInput
        className="min-w-44 flex-1 sm:max-w-64"
        size="md"
        type="range"
        locale="he"
        minDate={localDay(bounds.depart[0])}
        maxDate={localDay(bounds.ret[1])}
        value={draft}
        onChange={setDraft}
        valueFormat="DD/MM/YY"
        highlightToday
        rightSection={matches ? <Calendar aria-hidden /> : undefined}
        popoverProps={{ onClose: close, keepMounted: true }}
        dropdownType={isMobile ? "modal" : "popover"}
        aria-label="בחר תאריכי יציאה וחזרה"
        renderDay={(date) =>
          days.has(isoDay(date)) ? (
            <div style={{ padding: 5, borderRadius: "50%", outline: "2px solid red" }}>{date.getDate()}</div>
          ) : (
            <div>{date.getDate()}</div>
          )
        }
        styles={{ month: { direction: "rtl" }, input: { whiteSpace: "nowrap", borderRadius: "var(--radius)" } }}
      />
    </div>
  );
}
