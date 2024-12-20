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
    <div
      onClick={onClick}
      dir="rtl"
      className={`flex flex-row items-center justify-between px-6 py-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:shadow-xl hover:border-main ${
        isSelected ? "border-main border-2" : ""
      }`}
    >
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
      <div className="sm:w-2/5 w-full text-left sm:text-right">
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
    </div>
  );
};
