import { cn } from "@/lib/utils";
import { getPrices } from "../utils";
import { isMobile } from "react-device-detect";

export const ButtonSummary = ({
  finalPurchasePrice,
  finalPurchasePriceILS,
  recommendedPriceAllPax,
  numberOfPersons,
  agentCommission,
  isNumberOfPersonsEqual,
  isSticky = false,
}: {
  finalPurchasePrice: number;
  finalPurchasePriceILS: number;
  recommendedPriceAllPax: number;
  numberOfPersons: number;
  agentCommission: number;
  isNumberOfPersonsEqual: boolean;
  isSticky?: boolean; // when true show shorter label
}) => {
  const {
    finalPurchasePrice: finalPurchasePriceFormatted,
    finalPurchasePriceILS: finalPurchasePriceILSFormatted,
    originalNoDiscount,
  } = getPrices({
    finalPurchasePrice,
    recommendedPriceAllPax,
    agentCommission,
    isNumberOfPersonsEqual,
    numberOfPersons,
    finalPurchasePriceILS,
  });
  return (
    <div
      className={cn(
        "flex flex-row items-center justify-center w-full font-normal",
        isMobile && "justify-between"
      )}
      dir="rtl"
    >
      <span className={cn("font-bold", isMobile && "text-md", "leading-[1.15]")}> 
        {isSticky ? "המשך לתשלום" : "המשך לתשלום מאובטח"}
      </span>
      {isMobile && (
        <div className="flex flex-col items-end">
          <div className="text-xs line-through">
            ${originalNoDiscount}
          </div>
          <div className="flex flex-row items-baseline items-center">
            <div className="pl-1 text-xs">
              (₪{finalPurchasePriceILSFormatted})
            </div>
            <div className="text-sm font-bold">${finalPurchasePriceFormatted}</div>
          </div>
        </div>
      )}{" "}
    </div>
  );
};
