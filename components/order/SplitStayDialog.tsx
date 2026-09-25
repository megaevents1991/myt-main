"use client";

import { useEffect, useState } from "react";
import { Modal } from "@mantine/core";
import dayjs from "dayjs";
import type { Event } from "@/lib/app.types";
import {
  cityName,
  defaultSplit,
  flipNight,
  MAX_SEGMENTS,
  NightAssign,
  segmentsFromNights,
} from "@/lib/events/lodging";
import { cn } from "@/lib/utils";

/**
 * The strip of night buttons: a tap flips that night's city, within
 * MAX_SEGMENTS. Shared by the split popup and the "איפה ישנים?" plan popup.
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
                  המשחק
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

/**
 * "איפה ישנים בכל לילה?" - a strip of night buttons over the CURRENT hotel
 * dates; a tap flips that night's city. Dates are never changed here (that is
 * the hotel step's date picker) - the popup only assigns nights to cities.
 */
export const SplitStayDialog = ({
  opened,
  onClose,
  event,
  checkin,
  checkout,
  initial,
  onConfirm,
}: {
  opened: boolean;
  onClose: () => void;
  event: Event;
  /** YYYY-MM-DD - the hotel step's current dates. */
  checkin: string;
  checkout: string;
  /** Current assignment when re-opened; null = start from our default split. */
  initial: NightAssign[] | null;
  onConfirm: (nights: NightAssign[]) => void;
}) => {
  const [nights, setNights] = useState<NightAssign[]>([]);

  // Re-seed on every open so "ביטול" leaves no half-made assignment behind.
  useEffect(() => {
    if (!opened) return;
    setNights(
      initial && initial.length
        ? initial
        : defaultSplit(event, checkin, checkout)
    );
  }, [opened, initial, event, checkin, checkout]);

  const segments = segmentsFromNights(nights);
  const wantNights = Number(event.split_default_nights) === 1 ? 1 : 2;
  const eventCity = cityName(event, "event");
  const flightCity = cityName(event, "flight");

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="איפה ישנים בכל לילה?"
      centered
      size="lg"
      styles={{ title: { fontWeight: 700, fontSize: 18 } }}
    >
      <div className="flex flex-col gap-4" dir="rtl">
        <p className="text-[13px] text-muted-foreground">
          {`בחרנו בשבילכם ${wantNights} לילות ב${eventCity} סביב המשחק, השאר ב${flightCity}. לחיצה על לילה מחליפה לו עיר. לשינוי תאריכי המלון משתמשים בבורר התאריכים למעלה.`}
        </p>

        <NightStrip event={event} nights={nights} onChange={setNights} />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap gap-1.5">
            {segments.map((s) => (
              <span
                key={s.checkin}
                className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[12px] font-semibold"
              >
                {`${cityName(event, s.city)} · ${s.nights} לילות`}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold text-muted-foreground hover:border-forest hover:text-forest dark:hover:border-glow dark:hover:text-glow"
            >
              ביטול
            </button>
            <button
              type="button"
              disabled={!nights.length}
              onClick={() => onConfirm(nights)}
              className="rounded-lg bg-main px-4 py-1.5 text-[13px] font-bold text-main-foreground disabled:opacity-50"
            >
              אישור
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
