"use client";

import { useState } from "react";
import { Modal } from "@mantine/core";
import { Coffee } from "lucide-react";
import type { OrderHotel } from "@/lib/app.types";
import {
  mealPlanLabel,
  segmentBreakfastOffer,
} from "@/app/order/order-review.utils";

const usd = (n: number) => `+$${Math.ceil(n).toLocaleString("en-US")}`;

/**
 * One split-stay hotel's breakfast line (Alon 25.09): included or not, "הוסף
 * ארוחת בוקר" when the room has a breakfast rate, "נוספה · הסרה" once added.
 * Adding on one hotel while another can still get it asks once - all hotels,
 * or only this one. Used in the hotel step (per guest) and the summary (the
 * whole stay).
 */
export const SegmentBreakfast = ({
  hotel,
  cityLabel,
  otherCities,
  interactive,
  perGuest,
  onAdd,
  onRemove,
}: {
  hotel: OrderHotel;
  /** This hotel's city, for the popup's "רק ב…". */
  cityLabel: string;
  /** OTHER segments' cities that can still get breakfast. */
  otherCities: string[];
  interactive: boolean;
  /** Divide the shown price by this (the hotel step prices per guest). */
  perGuest?: number;
  onAdd: (everywhere: boolean) => void;
  onRemove: () => void;
}) => {
  const [asking, setAsking] = useState(false);
  const offer = segmentBreakfastOffer(hotel);
  const added = hotel.breakfast_upgrade;
  const divisor = perGuest && perGuest > 0 ? perGuest : 1;
  const priceText = (delta: number) =>
    delta > 0 ? `${usd(delta / divisor)}${perGuest ? " לאורח" : ""}` : "חינם";

  const add = () => {
    if (otherCities.length) setAsking(true);
    else onAdd(false);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-muted-foreground"
      dir="rtl"
    >
      <span className="flex items-center gap-1.5">
        <Coffee className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          {hotel.rate?.meal_data?.has_breakfast
            ? mealPlanLabel(hotel.rate)
            : "ללא ארוחת בוקר"}
        </span>
      </span>
      {added ? (
        <span className="flex items-center gap-2 rounded-md border border-forest/40 bg-forest/5 px-2 py-0.5 font-semibold text-forest dark:border-glow/40 dark:bg-glow/10 dark:text-glow">
          <span>
            ארוחת בוקר נוספה{" "}
            <span className="tabular-nums" dir="ltr">
              {priceText(added.delta_usd)}
            </span>
          </span>
          {interactive && added.prev_rate && (
            <button
              type="button"
              onClick={onRemove}
              className="text-[11px] font-normal text-muted-foreground underline"
            >
              הסרה
            </button>
          )}
        </span>
      ) : (
        interactive &&
        offer && (
          <button
            type="button"
            onClick={add}
            className="rounded-md border border-dashed border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-forest hover:bg-forest/5 hover:text-forest dark:hover:border-glow dark:hover:bg-glow/10 dark:hover:text-glow"
          >
            הוסף ארוחת בוקר{" "}
            <span className="tabular-nums" dir="ltr">
              {priceText(offer.deltaUsd)}
            </span>
          </button>
        )
      )}
      <Modal
        opened={asking}
        onClose={() => setAsking(false)}
        title="ארוחת בוקר"
        centered
        size="sm"
        styles={{ title: { fontWeight: 700, fontSize: 17 } }}
      >
        <div className="flex flex-col gap-4" dir="rtl">
          <p className="text-[14px]">
            {`להוסיף ארוחת בוקר גם ב${otherCities.join(" וב")}?`}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setAsking(false);
                onAdd(false);
              }}
              className="rounded-xl border border-border bg-card px-4 py-2 text-[14px] font-bold text-foreground transition-colors hover:border-forest dark:hover:border-glow"
            >
              {`לא, רק ב${cityLabel}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setAsking(false);
                onAdd(true);
              }}
              className="rounded-xl bg-main px-4 py-2 text-[14px] font-bold text-main-foreground"
            >
              כן, בכל המלונות
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

/** Cities of the OTHER segments that can still get breakfast. */
export const otherBreakfastCities = (
  segments: OrderHotel[],
  index: number,
  name: (h: OrderHotel) => string
): string[] =>
  segments
    .filter((h, i) => i !== index && !!segmentBreakfastOffer(h))
    .map(name);
