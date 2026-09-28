"use client";

import { useState } from "react";
import type { Event } from "@/lib/app.types";
import { NightStrip } from "@/components/order/NightStrip";
import {
  cityName,
  NightAssign,
  segmentsFromNights,
} from "@/lib/events/lodging";

const sameNights = (a: NightAssign[], b: NightAssign[]) =>
  a.length === b.length && a.every((n, i) => n.date === b[i].date && n.city === b[i].city);
const nightsLabel = (n: number) => (n === 1 ? "לילה אחד" : `${n} לילות`);

/**
 * "עריכת הפיצול" - opens in place under the lodging line (no popup: the hotel
 * blocks stay in view). The night squares lay out the stay; nothing searches
 * until "עדכון הלינה". Dates and guests stay in the step's own search bar.
 * Mount it with a key per opening so it starts from the stay as it is now.
 */
export const SplitEditor = ({
  event,
  initialNights,
  recommended,
  onApply,
  onCancel,
}: {
  event: Event;
  initialNights: NightAssign[];
  /** "פיצול מלונות"'s own layout for these dates - "חזרה להמלצה". */
  recommended: NightAssign[];
  onApply: (nights: NightAssign[]) => void;
  onCancel: () => void;
}) => {
  const [nights, setNights] = useState<NightAssign[]>(initialNights);
  const segments = segmentsFromNights(nights);
  const changed = !sameNights(nights, initialNights);
  const isRecommended = sameNights(nights, recommended);
  const eventCity = cityName(event, "event");
  const flightCity = cityName(event, "flight");

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:p-4"
      dir="rtl"
    >
      <div className="flex flex-col gap-0.5">
        <div className="text-[15px] font-bold">איפה ישנים בכל לילה?</div>
        <p className="text-[12px] text-muted-foreground">
          {`לחיצה על לילה מעבירה אותו בין ${eventCity} ל${flightCity}.`}
        </p>
      </div>
      <NightStrip event={event} nights={nights} onChange={setNights} />
      <div className="flex flex-wrap items-center gap-1.5">
        {segments.map((s) => (
          <span
            key={s.checkin}
            className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[12px] font-semibold"
          >
            {`${cityName(event, s.city)} · ${nightsLabel(s.nights)}`}
          </span>
        ))}
        {segments.length === 1 && (
          <span className="text-[12px] text-muted-foreground">
            {`כל הלילות ב${cityName(event, segments[0].city)} - בלי פיצול.`}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <button
          type="button"
          disabled={!changed}
          onClick={() => onApply(nights)}
          className="rounded-xl bg-main px-5 py-2.5 text-[14px] font-bold text-main-foreground transition-opacity disabled:opacity-50"
        >
          עדכון הלינה
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-border bg-card px-5 py-2.5 text-[14px] font-bold text-foreground transition-colors hover:border-forest dark:hover:border-glow"
        >
          ביטול
        </button>
        {!isRecommended && (
          <button
            type="button"
            onClick={() => setNights(recommended)}
            className="px-1 text-[13px] font-semibold text-forest underline underline-offset-2 dark:text-glow"
          >
            חזרה להמלצה שלנו
          </button>
        )}
      </div>
    </div>
  );
};
