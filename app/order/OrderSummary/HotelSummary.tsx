import { OrderHotel } from "@/lib/app.types";
import { formatPrice } from "@/lib/price.utils";
import { Coffee } from "lucide-react";
import dayjs from "dayjs";
import { mealPlanLabel } from "../order-review.utils";
import type { BreakfastUpgrade } from "../order-review.utils";

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
}: {
  selectedHotel: OrderHotel;
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
