import React from "react";
import { getPrices } from "../utils";

export const PriceSummary = ({
  finalPurchasePrice,
  finalPurchasePriceILS,
  recommendedPriceAllPax,
  numberOfPersons,
  agentCommission,
  affDiscount,
  isNumberOfPersonsEqual,
}: {
  finalPurchasePrice: number;
  finalPurchasePriceILS: number;
  recommendedPriceAllPax: number;
  numberOfPersons: number;
  agentCommission: number;
  // Total affiliate discount in USD (already normalized for percentage discounts)
  affDiscount: number;
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
    <div className="flex flex-row justify-between items-center py-4 px-6 border-b border-border">
      <div>
        <div className="flex justify-between items-baseline w-full text-[18px] gap-2 font-bold">
          <span className="text-xl tabular-nums" data-testid="order-total">
            ${formattedFinalPurchasePrice}
          </span>
          {originalNoDiscount && (
            <span className="line-through tabular-nums text-destructive">
              ${originalNoDiscount}
            </span>
          )}
        </div>
        <div className="flex justify-left items-center w-full text-lg font-semibold text-muted-foreground gap-1">
            <span>(לאדם</span>
            <span className="tabular-nums">${pricePerPerson})</span>
        </div>
        {/* <div dir="rtl" className="text-left">
          {formattedFinalPurchasePriceILS} ש&quot;ח
        </div> */}
      </div>
      <div className="flex flex-col items-start font-bold" dir="rtl">
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
              כולל הנחת $
              {affDiscount.toLocaleString("en-US")}
            </span>
          )
        )}
      </div>
    </div>
  );
};
