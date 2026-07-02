import { Minus, Plus } from "lucide-react";
import { CardWrapper } from "./cardWrapper";
import { Radio } from "@mantine/core";
import { cn } from "@/lib/utils";
import type { VipConfig } from "@/lib/app.types";

export type TicketCardProps = {
  price: number;
  basePrice: number;
  category: string;
  categoryDescription: string;
  colorOnTheMap: string;
  isSelected: boolean;
  onClick: () => void;
  index: number;
  numberOfTickets: number;
  onChangeNumberOfTickets: (value: number) => void;
  vip?: VipConfig;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  disabled?: boolean;
};

export const EventTicketCard = ({
  isSelected,
  price,
  basePrice,
  category,
  colorOnTheMap,
  categoryDescription,
  onClick,
  index,
  numberOfTickets = 1,
  onChangeNumberOfTickets,
  vip,
  onMouseEnter,
  onMouseLeave,
  disabled = false,
}: TicketCardProps) => {
  const priceToDisplay = price - basePrice;
  const isVip = vip?.enabled === true;
  const hasVipDetails = isVip && vip?.details && vip.details.trim().length > 0;
  
  return (
    <CardWrapper
      isSelected={isSelected}
      onClick={onClick}
      hasBorderColor={colorOnTheMap}
      className={cn("p-2 pr-8 relative overflow-visible")}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={disabled}
    >
      {/* VIP Ribbon */}
      {isVip && (
        <div className="absolute top-0 left-0 w-24 h-24 overflow-hidden pointer-events-none z-20">
          <div className="absolute top-[6px] -left-[40px] lg:top-[10px] lg:-left-[36px] w-28 h-6 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-bold text-xs transform rotate-[-45deg] flex items-center justify-center shadow-md">
            <span className="text-center">VIP</span>
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between w-full lg:flex-row flex-col">
        <div className="flex items-center justify-between w-full">
          {/* Brand accent strip (was per-section colorOnTheMap, often an
              off-brand navy from event data) — always Glow Green; it pops on
              both the white resting card and the forest selected card. */}
          <div
            className={cn(
              "absolute top-0 right-0 bottom-0 w-[20px] rounded-r-md bg-glow"
            )}
          ></div>
          <div className="w-2/3 lg:w-5/9 flex items-center gap-4">
            <Radio
              onChange={() => void 0}
              checked={!disabled && isSelected}
              color="hsl(var(--brand-forest))"
              style={{ pointerEvents: "none" }}
              disabled={disabled}
            />
            <div>
              <div className="text-xl font-bold flex items-center gap-2">
                {category}
              </div>
              {categoryDescription?.length > 0 && (
                <div
                  className={`text-md ${
                    categoryDescription.includes("כרטיסים אחרונים")
                      ? "font-bold text-red-600"
                      : ""
                  }`}
                >
                  {categoryDescription}
                </div>
              )}
              {hasVipDetails && (
                <div className="text-sm font-semibold">
                  {vip.details}
                </div>
              )}
            </div>
          </div>
          <div
            className="w-1/3 hidden lg:block"
            style={{ visibility: isSelected && !disabled ? "visible" : "hidden" }}
          >
            <CounterInput
              value={numberOfTickets}
              onChange={onChangeNumberOfTickets}
            />
          </div>
          <div className="w-1/3 lg:w-2/9 text-center font-bold ">
            {index === 0 ? (
              <span className="text-[20px]">כלול במחיר</span>
            ) : (
              <>
                {priceToDisplay === 0 ? (
                  <span className="text-[20px]">כלול במחיר</span>
                ) : (
                  <div className="text-2xl">
                    ${Math.abs(priceToDisplay)}
                    {priceToDisplay < 0 ? "-" : "+"}
                    {priceToDisplay < 0 ? (
                      <div className="text-[16px] leading-[22px]">
                        {"חסכון לכל כרטיס!"}
                      </div>
                    ) : (
                      <div className="text-[16px] leading-[22px]">
                        {"תוספת לכל כרטיס"}
                      </div>
                    )}
                  </div>
                )}
                <div></div>
              </>
            )}
          </div>
        </div>
        {isSelected && !disabled && (
          <div className="w-full block lg:hidden border-t-2 pt-2 border-border mt-2">
            <CounterInput
              value={numberOfTickets}
              onChange={onChangeNumberOfTickets}
            />
          </div>
        )}
      </div>
    </CardWrapper>
  );
};

type CounterInputProps = {
  value: number;
  onChange: (value: number) => void;
  minValue?: number;
};

const CounterInput = ({ value, onChange, minValue = 1 }: CounterInputProps) => (
  <div className="flex items-center flex-col items-center text-center gap-2">
    <span className="text-me">אנחנו רוצים</span>
    <div className="flex items-center gap-2 justify-between">
      <button
        onClick={() => onChange(value - 1)}
        disabled={+value <= minValue}
        className="bg-background rounded-full p-1 hover:border-main dark:hover:border-foreground border border-border border-solid border-1"
        type="button"
        aria-label="הפחת כמות כרטיסים"
      >
        <Minus className="h-4 w-4" />
      </button>
      <div className="w-8 text-xl font-bold text-center" role="status" aria-live="polite" aria-label={`${value} כרטיסים נבחרו`}>{value}</div>
      <button
        onClick={() => onChange(value + 1)}
        className="bg-background rounded-full p-1 hover:border-main dark:hover:border-foreground border border-border border-solid border-1"
        type="button"
        aria-label="הוסף כמות כרטיסים"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
    <span className="text-me">כרטיסים לאירוע</span>
  </div>
);
