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
  numberOfEventTickets,
}: {
  finalPurchasePrice: number;
  finalPurchasePriceILS: number;
  recommendedPriceAllPax: number;
  numberOfPersons: number;
  agentCommission: number;
  affDiscount: number;
  isNumberOfPersonsEqual: boolean;
  numberOfEventTickets: number;
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
    <div className="flex flex-row justify-between items-center py-4 px-6 border-b border-gray-400">
      <div>
        <div className="flex justify-between items-baseline w-full text-[18px] gap-2 font-bold">
          <span className="text-xl">${formattedFinalPurchasePrice}</span>
          {originalNoDiscount && (
            <span className="line-through text-[red]">
              ${originalNoDiscount}
            </span>
          )}
        </div>
        <div className="flex justify-left items-center w-full text-lg font-semibold text-gray-500 gap-1">
            <span>(לאדם</span>
            <span>${pricePerPerson})</span>
        </div>
        {/* <div dir="rtl" className="text-left">
          {formattedFinalPurchasePriceILS} ש&quot;ח
        </div> */}
      </div>
      <div className="flex flex-col items-start font-bold" dir="rtl">
        <span className="text-[22px] ">סה&quot;כ</span>
        {agentCommission > 0 ? (
          <span className="text-[14px]" style={{ color: "green" }}>
            עמלה צפויה $
            {((agentCommission / 100) * finalPurchasePrice).toLocaleString(
              "en-US"
            )}
          </span>
        ) : (
          affDiscount > 0 && (
            <span className="text-[14px]" style={{ color: "green" }}>
              כולל הנחת $
              {(affDiscount * numberOfEventTickets).toLocaleString("en-US")}
            </span>
          )
        )}
      </div>
    </div>
  );
};
