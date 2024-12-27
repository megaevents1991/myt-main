import { CardWrapper } from "./cardWrapper";

export type TicketCardProps = {
  price: number;
  basePrice: number;
  category: string;
  categoryDescription: string;
  colorOnTheMap: string;
  isSelected: boolean;
  onClick: () => void;
  index: number;
};

export const TicketCard = ({
  isSelected,
  price,
  basePrice,
  category,
  colorOnTheMap,
  categoryDescription,
  onClick,
  index,
}: TicketCardProps) => {
  const priceToDisplay = price - basePrice;
  return (
    <CardWrapper isSelected={isSelected} onClick={onClick}>
      <div className="w-2/5">
        <div>{category}</div>
        <div>{categoryDescription}</div>
        <div
          className="rounded-lg p-1 text-white font-bold text-center text-xs"
          style={{ background: colorOnTheMap, width: 80 }}
        >
          צבע אזור
        </div>
      </div>
      <div className="w-3/5 sm:w-2/5 text-left sm:text-right">
        {index === 0 ? (
          "כלול במחיר"
        ) : (
          <>
            <div className="font-bold text-2xl">
              ${Math.abs(priceToDisplay)}
              {priceToDisplay < 0 ? "-" : "+"}
            </div>
            <div className="text-xs">{"תוספת לכל כרטיס"}</div>
          </>
        )}
      </div>
      <div className="w-1/5 hidden sm:block">
        <button
          className={`${
            isSelected ? "bg-main" : "bg-secondary"
          }  text-white rounded-lg p-2 font-bold w-full`}
        >
          {isSelected ? "הבחירה שלך" : "בחר"}
        </button>
      </div>
    </CardWrapper>
  );
};
