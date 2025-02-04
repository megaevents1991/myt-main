import { Minus, Plus } from "lucide-react";
import { CardWrapper } from "./cardWrapper";
import { Radio } from "@mantine/core";
import { cn } from "@/lib/utils";

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
}: TicketCardProps) => {
  const priceToDisplay = price - basePrice;
  return (
    <CardWrapper
      isSelected={isSelected}
      onClick={onClick}
      hasBorderColor={colorOnTheMap}
      className={cn("p-2 pr-8")}
    >
      <div className="flex items-center justify-between w-full lg:flex-row flex-col">
        <div className="flex items-center justify-between w-full">
          <div
            className={cn(
              "absolute top-0 right-0 bottom-0 w-[20px] rounded-r-md"
            )}
            style={{
              backgroundColor: colorOnTheMap,
            }}
          ></div>
          <div className="w-2/3 lg:w-1/3 flex items-center gap-4">
            <Radio
              onChange={() => void 0}
              checked={isSelected}
              color="#05203C"
              style={{ pointerEvents: "none" }}
            />
            <div className="text-lg">
              <div>{category}</div>
              <div>{categoryDescription}</div>
            </div>
          </div>
          <div
            className="w-1/3 hidden lg:block"
            style={{ visibility: isSelected ? "visible" : "hidden" }}
          >
            <CounterInput
              value={numberOfTickets}
              onChange={onChangeNumberOfTickets}
            />
          </div>
          <div className="w-1/3 lg:w-1/3 text-center font-bold ">
            {index === 0 ? (
              <span className="text-[20px]">כלול במחיר</span>
            ) : (
              <>
                <div className="text-2xl">
                  ${Math.abs(priceToDisplay)}
                  {priceToDisplay < 0 ? "-" : "+"}
                </div>
                <div className="text-[16px]">{"תוספת לכל כרטיס"}</div>
              </>
            )}
          </div>
        </div>
        {isSelected && (
          <div className="w-full block lg:hidden border-t-2 pt-2 border-white mt-2">
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
    <span className="text-sm">אנחנו רוצים</span>
    <div className="flex items-center gap-2 justify-between">
      <button
        onClick={() => onChange(value - 1)}
        disabled={+value <= minValue}
        className="bg-white rounded-full p-1 hover:border-main border border-solid border-1"
      >
        <Minus className="h-4 w-4" />
      </button>
      <div className="w-8 text-center">{value}</div>
      <button
        onClick={() => onChange(value + 1)}
        className="bg-white rounded-full p-1 hover:border-main border border-solid border-1"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
    <span className="text-sm">כרטיסים לאירוע</span>
  </div>
);
