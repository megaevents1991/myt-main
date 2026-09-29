"use client";

import { useEffect, useState } from "react";
import { Popover } from "@mantine/core";
import { BedDouble, Pencil, Split, type LucideIcon } from "lucide-react";
import type { Event } from "@/lib/app.types";
import {
  cityName,
  LodgingCity,
  nightsBetween,
  offeredCities,
  proposedSplit,
  segmentsFromNights,
  splitOffered,
  StaySegment,
} from "@/lib/events/lodging";
import { cn } from "@/lib/utils";

const nightsLabel = (n: number) => (n === 1 ? "לילה אחד" : `${n} לילות`);
const hintKey = (eventId: number | string) => `myt:split-hint:${eventId}`;

/**
 * "איפה ישנים?" above the hotel list of a two-city event (Dor + Alon 28.09):
 * one button per city and "פיצול מלונות" - the step opens on the default city's
 * ordinary list, a split lays out the default and "עריכת הפיצול" changes it.
 * The first visit to such an event points at the split (once per event per
 * browser). Renders nothing for a one-city event, so that step is untouched.
 */
export const LodgingToggle = ({
  event,
  city,
  segments,
  checkin,
  checkout,
  editing,
  hintAllowed,
  onPickCity,
  onPickSplit,
  onEditSplit,
}: {
  event: Event;
  city: LodgingCity;
  /** Active split (2+ segments), else null. */
  segments: StaySegment[] | null;
  /** The step's hotel dates (YYYY-MM-DD) - for the nights under each button. */
  checkin: string;
  checkout: string;
  /** The split editor is open under this line. */
  editing: boolean;
  /** False on edit-from-summary / a locked package - no first-visit hint there. */
  hintAllowed: boolean;
  onPickCity: (city: LodgingCity) => void;
  onPickSplit: () => void;
  onEditSplit: () => void;
}) => {
  const cities = offeredCities(event);
  const canSplit = splitOffered(event);
  const split = !!segments && segments.length > 1;
  const nightCount = nightsBetween(checkin, checkout).length;
  const splitPossible = canSplit && nightCount >= 2;

  const [hintOpen, setHintOpen] = useState(false);
  useEffect(() => {
    if (!splitPossible || split || !hintAllowed) return;
    try {
      if (localStorage.getItem(hintKey(event.id))) return;
    } catch {
      // Storage blocked (private mode): the hint shows, it just can't remember.
    }
    const t = setTimeout(() => setHintOpen(true), 700);
    return () => clearTimeout(t);
    // Once per visit to the step - not every time the dates settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, splitPossible]);
  const closeHint = () => {
    setHintOpen(false);
    try {
      localStorage.setItem(hintKey(event.id), "1");
    } catch {
      // ignore - see above
    }
  };

  if (cities.length < 2 && !canSplit) return null;

  const eventCity = cityName(event, "event");
  const flightCity = cityName(event, "flight");
  // The split's nights per city: the active split, else what the button would lay out.
  const layout = split
    ? segments!
    : splitPossible
      ? segmentsFromNights(proposedSplit(event, checkin, checkout))
      : [];
  const inCity = (c: LodgingCity) =>
    layout.filter((s) => s.city === c).reduce((n, s) => n + s.nights, 0);
  const eventNights = inCity("event");
  const flightNights = inCity("flight");

  const options: {
    key: LodgingCity | "split";
    label: string;
    sub: string;
    Icon: LucideIcon;
    active: boolean;
  }[] = [
    ...cities.map((c) => ({
      key: c,
      label: `לינה ב${cityName(event, c)}`,
      sub: nightCount ? nightsLabel(nightCount) : "",
      Icon: BedDouble,
      active: !split && city === c,
    })),
    ...(splitPossible
      ? [
          {
            key: "split" as const,
            label: "פיצול מלונות",
            sub: `${eventNights} ב${eventCity} · ${flightNights} ב${flightCity}`,
            Icon: Split,
            active: split,
          },
        ]
      : []),
  ];

  const pick = (key: LodgingCity | "split") => {
    if (hintOpen) closeHint();
    if (key === "split") {
      if (split) onEditSplit();
      else onPickSplit();
      return;
    }
    if (split || key !== city) onPickCity(key);
  };

  // Separate outlined tiles with a radio dot - a choice of where to sleep, and
  // visibly NOT the sort strip under it (one filled pill track, Alon 29.09).
  const optionButton = ({ key, label, sub, Icon, active }: (typeof options)[number]) => (
    <button
      key={key}
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => pick(key)}
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] px-2 py-2.5 text-center leading-tight transition-colors lg:min-w-[172px] lg:flex-row lg:justify-start lg:gap-2.5 lg:px-3.5 lg:text-right",
        active
          ? "border-forest bg-forest/10 dark:border-glow dark:bg-glow/10"
          : "border-border bg-card hover:border-forest/60 dark:hover:border-glow/60"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px]",
          active ? "border-forest dark:border-glow" : "border-muted-foreground/60"
        )}
      >
        {active && <span className="h-2 w-2 rounded-full bg-forest dark:bg-glow" />}
      </span>
      <span className="flex min-w-0 flex-col items-center gap-0.5 lg:items-start">
        <span className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-bold text-foreground lg:text-[14px]">
          <Icon
            className={cn(
              "hidden h-4 w-4 flex-shrink-0 lg:block",
              active ? "text-forest dark:text-glow" : "text-muted-foreground"
            )}
            strokeWidth={1.8}
            aria-hidden="true"
          />
          {label}
        </span>
        {sub && (
          <span
            className={cn(
              "text-balance text-[11px] lg:whitespace-nowrap",
              active ? "text-forest dark:text-glow" : "text-muted-foreground"
            )}
          >
            {sub}
          </span>
        )}
      </span>
    </button>
  );

  return (
    <div className="flex flex-col gap-1.5" dir="rtl">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
        <span className="text-[15px] font-bold">איפה ישנים?</span>
        <div
          role="radiogroup"
          aria-label="איפה ישנים?"
          className={cn(
            "grid w-full min-w-0 gap-2 lg:flex lg:w-auto",
            options.length === 3 ? "grid-cols-3" : "grid-cols-2"
          )}
        >
          {options.map((opt) =>
            opt.key === "split" ? (
              <Popover
                key={opt.key}
                opened={hintOpen}
                onClose={closeHint}
                position="bottom"
                withArrow
                arrowSize={10}
                shadow="md"
                radius="md"
                width={300}
                zIndex={150}
              >
                <Popover.Target>{optionButton(opt)}</Popover.Target>
                <Popover.Dropdown p={0}>
                  <div dir="rtl" className="flex flex-col gap-2 p-3.5" role="dialog" aria-label="אפשר לפצל את הלינה">
                    <div className="flex items-center gap-2 text-[15px] font-bold">
                      <Split className="h-4 w-4 text-forest dark:text-glow" strokeWidth={2} aria-hidden="true" />
                      אפשר לפצל את הלינה
                    </div>
                    <p className="text-[13px] leading-snug text-muted-foreground">
                      {`המשחק ב${eventCity} והטיסה ל${flightCity}. בפיצול נשבץ לכם ${nightsLabel(eventNights)} ב${eventCity} סביב המשחק ואת השאר ב${flightCity} - ואפשר לשנות את החלוקה.`}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => pick("split")}
                        className="rounded-lg bg-main px-3.5 py-2 text-[13px] font-bold text-main-foreground transition-opacity hover:opacity-90"
                      >
                        לפצל את הלינה
                      </button>
                      <button
                        type="button"
                        onClick={closeHint}
                        className="rounded-lg px-3 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
                      >
                        הבנתי
                      </button>
                    </div>
                  </div>
                </Popover.Dropdown>
              </Popover>
            ) : (
              optionButton(opt)
            )
          )}
        </div>
        {split && (
          <button
            type="button"
            onClick={onEditSplit}
            aria-expanded={editing}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-forest px-3 py-1.5 text-[13px] font-semibold text-forest transition-colors hover:bg-forest/5 dark:border-glow dark:text-glow dark:hover:bg-glow/10"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            עריכת הפיצול
          </button>
        )}
      </div>
      {event.lodging_note && (
        <p className="text-[12px] text-muted-foreground">{event.lodging_note}</p>
      )}
    </div>
  );
};
