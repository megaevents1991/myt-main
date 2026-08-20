import Image from "next/image";
import { FlightMeta } from "@/components/ui/FlightCard";
import { Flight } from "@/lib/app.types";
import { formatPrice } from "@/lib/price.utils";
import dayjs from "dayjs";
import type { BagPricingOptions } from "../hooks/useBagPricing";

/** Included/not-included line for one baggage kind, on one or both legs. */
const BaggageLine = ({
  iconSrc,
  iconSize,
  includedLabel,
  notIncludedLabel,
  included,
}: {
  iconSrc: string;
  iconSize: number;
  includedLabel: string;
  notIncludedLabel: string;
  included: boolean;
}) => (
  <div
    className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
    dir="rtl"
  >
    <Image
      src={iconSrc}
      alt=""
      width={iconSize}
      height={iconSize}
      unoptimized
      className={included ? "opacity-90" : "opacity-40 grayscale"}
    />
    <span>{included ? includedLabel : notIncludedLabel}</span>
  </div>
);

/**
 * One upsell toggle: an outlined "add" chip (live order flow only), or -
 * once added - a confirmed line, mirroring the applied-coupon pattern
 * already used in OrderReview.tsx. `removable` gates the "הסרה" link: on
 * the hold-recovery/pay-link page (showUpsells=false) an already-added bag
 * still shows as included-in-the-price, but nothing there is editable -
 * the price is locked.
 */
const BagUpsellToggle = ({
  addedLabel,
  addedTotalUsd,
  addLabel,
  unitTotalUsd,
  removable,
  onToggle,
}: {
  addedLabel: string | null;
  addedTotalUsd: number;
  addLabel: string;
  unitTotalUsd: number;
  removable: boolean;
  onToggle: () => void;
}) =>
  addedLabel ? (
    <div
      className="flex items-center justify-between gap-2 rounded-lg border border-forest/40 bg-forest/5 px-2.5 py-1.5 text-[12px] dark:border-glow/40 dark:bg-glow/10"
      dir="rtl"
    >
      <span className="font-semibold text-forest dark:text-glow">
        {addedLabel}{" "}
        <span className="tabular-nums" dir="ltr">
          +${Math.ceil(addedTotalUsd).toLocaleString("en-US")}
        </span>
      </span>
      {removable && (
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 text-[11px] text-muted-foreground underline"
        >
          הסרה
        </button>
      )}
    </div>
  ) : (
    <button
      type="button"
      onClick={onToggle}
      dir="rtl"
      className="flex w-full items-center justify-between rounded-lg border border-dashed border-border px-2.5 py-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:border-forest hover:bg-forest/5 hover:text-forest dark:hover:border-glow dark:hover:bg-glow/10 dark:hover:text-glow"
      aria-label={`${addLabel}, תוספת ${Math.ceil(unitTotalUsd)} דולר לכל הנוסעים`}
    >
      <span>{addLabel}</span>
      <span className="tabular-nums" dir="ltr">
        +${Math.ceil(unitTotalUsd).toLocaleString("en-US")}
      </span>
    </button>
  );

export const FlightSummary = ({
  selectedFlight,
  airlineFullName,
  flightPriceAddition,
  agentCommission,
  isAgent,
  bagOptions,
  showUpsells,
  onToggleCheckedBag,
  onToggleCabinBag,
}: {
  selectedFlight: Flight;
  airlineFullName?: string;
  flightPriceAddition: number;
  agentCommission: number;
  /** Any signed agent code - commission may be 0. Falls back to commission>0. */
  isAgent?: boolean;
  /** Live Amadeus ancillary pricing for the selected offer, or null while
   *  loading / unavailable (offline flight, virtual offer, nothing returned)
   *  - see app/order/hooks/useBagPricing.ts. */
  bagOptions?: BagPricingOptions;
  /** Interactive upsells only in the live order flow - off on the
   *  hold-recovery/pay-link page and on an agent-locked prepared package. */
  showUpsells?: boolean;
  onToggleCheckedBag?: () => void;
  onToggleCabinBag?: () => void;
}) => {
  const agentViewer = isAgent ?? agentCommission > 0;
  const { outbound, inbound, added_bags: addedBags } = selectedFlight;
  const checkedIncluded = outbound.checkBagsIncluded && inbound.checkBagsIncluded;
  const cabinIncluded = outbound.cabinBagsIncluded && inbound.cabinBagsIncluded;
  const numOfTravelers = selectedFlight.numOfTravelers || 1;
  // Checked and cabin are added independently (an agent may want only the
  // trolley) - never infer one from the other's presence on added_bags.
  const checkedAdded = (addedBags?.checked_qty_per_pax ?? 0) > 0;
  const cabinAdded = !!addedBags?.cabin;

  return (
    <div className="">
      <h3 className="font-bold text-lg hidden md:block">
        טיסה{" "}
        <span>
          {"("}
          {selectedFlight.numOfTravelers}
          {" נוסעים)"}
        </span>
      </h3>
      <div className="flex justify-between w-full" dir="rtl">
        <div>
          <div className="text-[16px] flex items-center hidden md:block" dir="rtl">
            <div className="font-bold ml-1" dir="ltr">
              {airlineFullName}
            </div>
          </div>
          <div className="flex text-[14px]" dir="rtl">
            <div>מ-</div>
            <div>
              {dayjs(selectedFlight.outbound.departureTime).format(
                "DD/MM/YYYY"
              )}
            </div>
            <div className="w-1"></div>
            <div>עד-</div>
            <div>
              {dayjs(selectedFlight.inbound.departureTime).format("DD/MM/YYYY")}
            </div>
          </div>
        </div>
        {!agentViewer && (
          <div>
            {formatPrice(flightPriceAddition)
              ? formatPrice(flightPriceAddition, {
                  factor: selectedFlight.numOfTravelers,
                  applyColor: false,
                  bold: false,
                })
              : "כלול במחיר"}
          </div>
        )}
      </div>
      <div className="h-1"></div>
      <div className="text-[12px] mt-2 px-2" dir="rtl">
        {selectedFlight.outbound.operatedBy && (
          <div className="text-[11px] text-forest dark:text-glow" dir="rtl">
            הלוך מופעל ע״י{" "}
            <span dir="ltr">{selectedFlight.outbound.operatedBy}</span>
          </div>
        )}
        <FlightMeta {...selectedFlight.outbound} />
        {selectedFlight.inbound.operatedBy && (
          <div className="text-[11px] text-forest dark:text-glow" dir="rtl">
            חזור מופעל ע״י{" "}
            <span dir="ltr">{selectedFlight.inbound.operatedBy}</span>
          </div>
        )}
        <FlightMeta {...selectedFlight.inbound} />
      </div>
      {/* What's included - quiet, always shown regardless of viewer. Baggage
          policy is enforced identical on both legs for online flights (the
          search route drops any offer where it isn't - see
          app/api/flights/search/route.ts), so one line covers both; offline
          inventory CAN differ per leg, so it gets its own row per direction. */}
      <div className="mt-1.5 space-y-1 px-2" dir="rtl">
        {!selectedFlight.isOffline ? (
          <>
            <BaggageLine
              iconSrc="/icons/noun-luggage-3710164.svg"
              iconSize={18}
              included={checkedIncluded}
              includedLabel="כולל מזוודה"
              notIncludedLabel="ללא מזוודה"
            />
            <BaggageLine
              iconSrc="/icons/noun-luggage-3710176.svg"
              iconSize={16}
              included={cabinIncluded}
              includedLabel="כולל טרולי"
              notIncludedLabel="ללא טרולי"
            />
          </>
        ) : (
          <>
            <BaggageLine
              iconSrc="/icons/noun-luggage-3710164.svg"
              iconSize={18}
              included={outbound.checkBagsIncluded}
              includedLabel="כולל מזוודה (הלוך)"
              notIncludedLabel="ללא מזוודה (הלוך)"
            />
            <BaggageLine
              iconSrc="/icons/noun-luggage-3710164.svg"
              iconSize={18}
              included={inbound.checkBagsIncluded}
              includedLabel="כולל מזוודה (חזור)"
              notIncludedLabel="ללא מזוודה (חזור)"
            />
            <BaggageLine
              iconSrc="/icons/noun-luggage-3710176.svg"
              iconSize={16}
              included={outbound.cabinBagsIncluded}
              includedLabel="כולל טרולי (הלוך)"
              notIncludedLabel="ללא טרולי (הלוך)"
            />
            <BaggageLine
              iconSrc="/icons/noun-luggage-3710176.svg"
              iconSize={16}
              included={inbound.cabinBagsIncluded}
              includedLabel="כולל טרולי (חזור)"
              notIncludedLabel="ללא טרולי (חזור)"
            />
          </>
        )}
      </div>
      {/* Baggage upsells - live Amadeus ancillary pricing for THIS offer.
          An already-added bag still shows (informational) even with
          showUpsells off (the hold-recovery/pay-link page); the "add" chip
          itself only ever appears in the live, editable flow. Silently
          absent otherwise - Amadeus didn't price it, the flight is offline
          (no ancillary price source, v1), or it's already included. */}
      <div className="mt-2 space-y-1.5 px-2" dir="rtl">
        {/* A paid add-on already charged stays visible even if checkedIncluded
            later flips true (e.g. an עריכה flight swap) - only the "offer to
            add" side is gated on it being not-already-free. */}
        {(checkedAdded || (!checkedIncluded && showUpsells && bagOptions?.checked)) && (
          <BagUpsellToggle
            addedLabel={checkedAdded ? `מזוודות (${addedBags!.checked_qty_per_pax * numOfTravelers})` : null}
            addedTotalUsd={addedBags?.total_usd || 0}
            addLabel="הוסף מזוודה לכל נוסע"
            // unitPriceUsd × numOfTravelers, same source the applied charge
            // uses (OrderReview.tsx's handleToggleCheckedBag) - not the
            // server's own totalUsd (unitPrice × flightOffer.travelerPricings
            // .length), which can diverge from numOfTravelers and show a
            // button total that doesn't match what actually gets charged.
            unitTotalUsd={(bagOptions?.checked?.unitPriceUsd || 0) * numOfTravelers}
            removable={!!showUpsells}
            onToggle={() => onToggleCheckedBag?.()}
          />
        )}
        {(cabinAdded || (!cabinIncluded && showUpsells && bagOptions?.cabin)) && (
          <BagUpsellToggle
            addedLabel={
              cabinAdded
                ? `טרולים (${addedBags!.cabin!.qty_per_pax * numOfTravelers})`
                : null
            }
            addedTotalUsd={addedBags?.cabin?.total_usd || 0}
            addLabel="הוסף טרולי לכל נוסע"
            // Same unify-on-one-source rationale as the checked-bag toggle above.
            unitTotalUsd={(bagOptions?.cabin?.unitPriceUsd || 0) * numOfTravelers}
            removable={!!showUpsells}
            onToggle={() => onToggleCabinBag?.()}
          />
        )}
      </div>
    </div>
  );
};
