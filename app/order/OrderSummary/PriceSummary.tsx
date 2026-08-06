import React from "react";
import { getPrices } from "../utils";

export const PriceSummary = ({
  finalPurchasePrice,
  finalPurchasePriceILS,
  recommendedPriceAllPax,
  numberOfPersons,
  agentCommission,
  agentCommissionUsd,
  isAgent,
  affDiscount,
  isCouponDiscount = false,
  isNumberOfPersonsEqual,
}: {
  finalPurchasePrice: number;
  finalPurchasePriceILS: number;
  recommendedPriceAllPax: number;
  numberOfPersons: number;
  agentCommission: number;
  /** Expected commission in USD, computed per the commission's unit (percent /
   *  fixed-per-ticket). When given it replaces the legacy percent-only math. */
  agentCommissionUsd?: number;
  /** Any signed agent code — commission may be 0. Falls back to commission>0. */
  isAgent?: boolean;
  // Total winning discount in USD (affiliate or coupon — best one wins)
  affDiscount: number;
  // true when the winning discount came from a coupon (changes the label)
  isCouponDiscount?: boolean;
  isNumberOfPersonsEqual: boolean;
}) => {
  const agentViewer = isAgent ?? agentCommission > 0;
  const {
    originalNoDiscount,
    pricePerPerson,
    finalPurchasePrice: formattedFinalPurchasePrice,
  } = getPrices({
    finalPurchasePrice,
    recommendedPriceAllPax,
    agentCommission,
    isAgent: agentViewer,
    isNumberOfPersonsEqual,
    numberOfPersons,
    finalPurchasePriceILS,
  });

  return (
    // Explicit RTL: "סה"כ" (+ discount note) on the right, the amounts on the
    // left — Hebrew-native layout regardless of the surrounding context.
    <div dir="rtl" className="flex flex-row justify-between items-center py-4 px-6 border-b border-border">
      <div className="flex flex-col items-start font-bold">
        <span className="text-[22px] ">סה&quot;כ</span>
        {agentViewer ? (
          // Agent framing: expected commission, or nothing for a 0 agent —
          // never the customer's discount line. agentCommissionUsd (computed
          // per the commission's UNIT) wins; the percent math is the legacy
          // fallback for callers that never pass it.
          (agentCommissionUsd ?? agentCommission) > 0 && (
            <span className="text-[14px] tabular-nums text-success">
              עמלה צפויה $
              {(agentCommissionUsd != null
                ? agentCommissionUsd
                : (agentCommission / 100) * finalPurchasePrice
              ).toLocaleString("en-US")}
            </span>
          )
        ) : (
          affDiscount > 0 && (
            <span className="text-[14px] tabular-nums text-success">
              {isCouponDiscount ? "כולל הנחת קופון $" : "כולל הנחת $"}
              {affDiscount.toLocaleString("en-US")}
            </span>
          )
        )}
      </div>
      <div className="text-left">
        <div className="flex justify-end items-baseline w-full text-[18px] gap-2 font-bold" dir="ltr">
          {originalNoDiscount && (
            <span className="line-through tabular-nums text-destructive">
              ${originalNoDiscount}
            </span>
          )}
          <span className="text-xl tabular-nums" data-testid="order-total">
            ${formattedFinalPurchasePrice}
          </span>
        </div>
        <div className="flex justify-end items-center w-full text-lg font-semibold text-muted-foreground gap-1">
          <span>
            (לאדם <span className="tabular-nums" dir="ltr">${pricePerPerson}</span>)
          </span>
        </div>
        {/* <div dir="rtl" className="text-left">
          {formattedFinalPurchasePriceILS} ש&quot;ח
        </div> */}
      </div>
    </div>
  );
};
