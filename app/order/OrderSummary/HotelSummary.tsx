import { Event, OrderHotel } from "@/lib/app.types";
import { formatPrice } from "@/lib/price.utils";
import { Coffee } from "lucide-react";
import dayjs from "dayjs";
import { mealPlanLabel } from "../order-review.utils";
import type { BreakfastUpgrade } from "../order-review.utils";
import { cityName, shortPlace } from "@/lib/events/lodging";
import {
  otherBreakfastCities,
  SegmentBreakfast,
} from "@/components/order/SegmentBreakfast";

export const HotelSummary = ({
  selectedHotel,
  agentCommission,
  isAgent,
  hotelPriceAddition,
  totalGuests,
  breakfastUpgrade,
  showUpsells,
  onAddBreakfast,
  onRemoveBreakfast,
  hotelSegments,
  event,
  onAddSegmentBreakfast,
  onRemoveSegmentBreakfast,
}: {
  selectedHotel: OrderHotel;
  /** Split stay (2+ hotels): one row per hotel - its own price change and
   *  breakfast - then the summed total line. */
  hotelSegments?: OrderHotel[] | null;
  /** Base hotel price + city names for the split rows. */
  event?: Event;
  onAddSegmentBreakfast?: (index: number, everywhere: boolean) => void;
  onRemoveSegmentBreakfast?: (index: number) => void;
  agentCommission: number;
  /** Any signed agent code - commission may be 0. Falls back to commission>0. */
  isAgent?: boolean;
  hotelPriceAddition: number;
  totalGuests: number;
  /** The same room's cheapest breakfast-included rate, when one exists in
   *  the live search state (see order-review.utils.findBreakfastUpgrade). */
  breakfastUpgrade?: BreakfastUpgrade | null;
  /** Interactive upsells only in the live order flow - off on the
   *  hold-recovery/pay-link page (display-only, price already locked) and
   *  on an agent-locked prepared package. */
  showUpsells?: boolean;
  onAddBreakfast?: () => void;
  /** Restores the pre-upsell rate (the "הסרה" link on the added chip). */
  onRemoveBreakfast?: () => void;
}) => {
  const agentViewer = isAgent ?? agentCommission > 0;
  const segments = hotelSegments && hotelSegments.length > 1 ? hotelSegments : null;
  const priceLine = !agentViewer && (
    <div>
      {hotelPriceAddition
        ? formatPrice(hotelPriceAddition, {
            factor: totalGuests,
            applyColor: false,
            bold: false,
          })
        : "כלול במחיר"}
    </div>
  );
  if (segments) {
    // Each hotel's own share of the change (Alon 25.09: "שיהיה ברור איזה
    // מלון הוזיל, ייקר"): its price vs the base's pro-rata share for its
    // nights, for the whole party - the same yardstick as the hotel step's
    // blocks. Rounded so the rows add up to the total line under them.
    const nightsOf = (h: OrderHotel) =>
      Math.max(1, dayjs(h.checkout).diff(dayjs(h.checkin), "day"));
    const allNights = segments.reduce((n, h) => n + nightsOf(h), 0) || 1;
    const base = Number(event?.base_hotel_price) || 0;
    const rows = segments.map((h) =>
      Math.round(+h.price - (base * totalGuests * nightsOf(h)) / allNights)
    );
    if (hotelPriceAddition) {
      const shownTotal =
        Math.sign(hotelPriceAddition) *
        Math.abs(Math.ceil(hotelPriceAddition) * totalGuests);
      rows[0] = shownTotal - rows.slice(1).reduce((s, n) => s + n, 0);
    }
    const cityOf = (h: OrderHotel) =>
      event && h.city ? cityName(event, h.city) : shortPlace(h.cityName ?? h.name);
    const interactive = !!showUpsells && !!onAddSegmentBreakfast;
    return (
      <div className="">
        <h3 className="font-bold text-lg hidden md:block">
          לינה{" "}
          <span>
            {"("}
            {selectedHotel.guests.reduce(
              (ppl, room) => ppl + room.children.length + room.adults,
              0
            )}
            {" אורחים)"}
          </span>
        </h3>
        <div className="flex flex-col gap-2" dir="rtl">
          {segments.map((h, i) => (
            <div
              key={`${h.id}-${h.checkin}-${i}`}
              className="flex flex-col gap-1.5 rounded-lg border border-border p-2.5 text-[14px]"
            >
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">
                    {cityOf(h)}
                    <span className="mr-1.5 font-normal tabular-nums" dir="ltr">
                      {`${dayjs(h.checkin).format("DD/MM")}–${dayjs(h.checkout).format("DD/MM")}`}
                    </span>
                  </p>
                  <p dir="ltr" className="text-right">
                    {h.name}
                    {h.rate?.room_data_trans?.main_name
                      ? ` · ${h.rate.room_data_trans.main_name}`
                      : ""}
                  </p>
                </div>
                {!agentViewer && (
                  <div className="shrink-0 tabular-nums" dir="ltr">
                    {rows[i] === 0
                      ? "כלול"
                      : `${rows[i] > 0 ? "+" : "-"}$${Math.abs(rows[i]).toLocaleString("en-US")}`}
                  </div>
                )}
              </div>
              <SegmentBreakfast
                hotel={h}
                cityLabel={cityOf(h)}
                otherCities={otherBreakfastCities(segments, i, cityOf)}
                interactive={interactive}
                onAdd={(everywhere) => onAddSegmentBreakfast?.(i, everywhere)}
                onRemove={() => onRemoveSegmentBreakfast?.(i)}
              />
            </div>
          ))}
          {!agentViewer && (
            <div className="flex justify-between gap-3 font-bold">
              <span>סה״כ לינה</span>
              {priceLine}
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="">
      <h3 className="font-bold text-lg hidden md:block">
        לינה{" "}
        <span>
          {"("}
          {selectedHotel.guests.reduce(
            (ppl, room) => ppl + room.children.length + room.adults,
            0
          )}
          {" אורחים)"}
        </span>
      </h3>
      <div className="flex w-full justify-between" dir="rtl">
        <div>
          <p className="font-bold hidden md:block" dir="ltr">
            {selectedHotel.name}
          </p>
          <p dir="ltr">
          {selectedHotel.isOffline
            ? selectedHotel.hotelInformation.roomName
            : selectedHotel.rate?.room_data_trans?.main_name}
        </p>
        </div>
        {!agentViewer && (
          <div>
            {hotelPriceAddition
              ? formatPrice(hotelPriceAddition, {
                  factor: totalGuests,
                  applyColor: false,
                  bold: false,
                })
              : "כלול במחיר"}
          </div>
        )}
      </div>
      <div className="flex text-[14px]" dir="rtl">
        <div>מ-</div>
        <div>
          {dayjs(selectedHotel.checkin).format(
            // pass check-in and check-out dates to selectedhotel (need to chaned hotel order type)
            "DD/MM/YYYY"
          )}
        </div>
        <div className="w-1"></div>
        <div>עד-</div>
        <div>{dayjs(selectedHotel.checkout).format("DD/MM/YYYY")}</div>
      </div>
      {/* What's included - quiet, always shown regardless of viewer. The
          breakfast upsell sits INLINE on this row (creative 21.8: "אי אפשר
          שיהיה הוסף עם הסכום?") instead of a separate chip below. */}
      <div
        className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 text-[12px] text-muted-foreground"
        dir="rtl"
      >
        <span className="flex items-center gap-1.5">
          <Coffee className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{mealPlanLabel(selectedHotel.rate)}</span>
        </span>
        {!selectedHotel.breakfast_upgrade &&
          showUpsells &&
          breakfastUpgrade &&
          onAddBreakfast && (
            <button
              type="button"
              onClick={onAddBreakfast}
              className="rounded-md border border-dashed border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-forest hover:bg-forest/5 hover:text-forest dark:hover:border-glow dark:hover:bg-glow/10 dark:hover:text-glow"
              aria-label={`הוסף ארוחת בוקר, תוספת ${Math.ceil(breakfastUpgrade.deltaUsd)} דולר לכל השהות`}
            >
              הוסף ארוחת בוקר{" "}
              {Math.ceil(breakfastUpgrade.deltaUsd) > 0 ? (
                <span className="tabular-nums" dir="ltr">
                  +$
                  {Math.ceil(breakfastUpgrade.deltaUsd).toLocaleString("en-US")}
                </span>
              ) : (
                <span>חינם</span>
              )}
            </button>
          )}
      </div>
      {/* Added breakfast - confirmed line with the delta + removal, mirroring
          the bag toggles (Dor 20.8: "שיש מחיר תופסת ליד וגם אופציה להסרה
          כמו בטיסה"). Still shown (locked) on the pay-link page. */}
      {selectedHotel.breakfast_upgrade && (
        <div
          className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-forest/40 bg-forest/5 px-2.5 py-1.5 text-[12px] dark:border-glow/40 dark:bg-glow/10"
          dir="rtl"
        >
          <span className="font-semibold text-forest dark:text-glow">
            ארוחת בוקר נוספה{" "}
            {Math.ceil(selectedHotel.breakfast_upgrade.delta_usd) > 0 ? (
              <span className="tabular-nums" dir="ltr">
                +$
                {Math.ceil(
                  selectedHotel.breakfast_upgrade.delta_usd,
                ).toLocaleString("en-US")}
              </span>
            ) : (
              <span>חינם</span>
            )}
          </span>
          {showUpsells && selectedHotel.breakfast_upgrade.prev_rate && onRemoveBreakfast && (
            <button
              type="button"
              onClick={onRemoveBreakfast}
              className="shrink-0 text-[11px] text-muted-foreground underline"
            >
              הסרה
            </button>
          )}
        </div>
      )}
    </div>
  );
};
