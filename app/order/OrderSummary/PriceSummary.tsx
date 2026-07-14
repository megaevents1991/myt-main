import React from "react";
import { getPrices } from "../utils";

export const PriceSummary = ({
  finalPurchasePrice,
  finalPurchasePriceILS,
  recommendedPriceAllPax,
  numberOfPersons,
  agentCommission,
  affDiscount,
  isCouponDiscount = false,
  isNumberOfPersonsEqual,
}: {
  finalPurchasePrice: number;
  finalPurchasePriceILS: number;
  recommendedPriceAllPax: number;
  numberOfPersons: number;
  agentCommission: number;
  // Total winning discount in USD (affiliate or coupon — best one wins)
  affDiscount: number;
  // true when the winning discount came from a coupon (changes the label)
  isCouponDiscount?: boolean;
  isNumberOfPersonsEqual: boolean;
}) => {
  const {
    originalNoDiscount,
    pricePerPerson,
    finalPurchasePrice: formattedFinalPurchasePrice,
  } = getPrices({
    finalPurchasePrice,
    recommendedPriceAllPax,
    agentCommission,
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
        {agentCommission > 0 ? (
          <span className="text-[14px] tabular-nums text-success">
            עמלה צפויה $
            {((agentCommission / 100) * finalPurchasePrice).toLocaleString(
              "en-US"
            )}
          </span>
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
