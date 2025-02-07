import { Rate } from "@/lib/hotel.type";
import { cn } from "@/lib/utils";

export const RoomCard = ({
  room,
  isSelected,
  onRoomSelect,
  minDailyPrice,
  persons,
  days,
}: {
  persons: number;
  minDailyPrice: number;
  room: Rate;
  isSelected: boolean;
  days: number;
  onRoomSelect: (room: Rate) => void;
}) => {
  const roomPrice = (+room.daily_prices[0] / persons) * days;

  const priceToShowFull =
    roomPrice - minDailyPrice !== 0
      ? ` לאורח/$${Math.abs(Math.ceil(+roomPrice - minDailyPrice))}${
          +roomPrice - minDailyPrice > 0 ? "+" : "-"
        }`
      : "כלול במחיר";
  return (
    <div onClick={() => onRoomSelect(room)}>
      <div
        className={cn(
          "py-2 w-full flex flex-col items-right cursor-pointer hover:font-bold border-b border-gray-200 text-sm flex flex-row justify-between items-center",
          isSelected && "text-secondary font-bold"
        )}
      >
        <div className="font-extrabold">
          {room.room_data_trans.main_name}
          {room.room_data_trans.bedding_type
            ? ` (${room.room_data_trans.bedding_type})`
            : ""}
        </div>
        {/* <Badge color="pink" variant="light">
          {room.room_name} ★
        </Badge> */}
        {/* <div>Meal: {room.meal}</div> */}
        <div> {priceToShowFull}</div>
        {/* {room.room_name_info}
        {room.daily_prices[0]} / night
        {room.amenities_data.map((amenity) => (
          <Badge
            key={amenity}
            size="sm"
            color="gray"
            component="span"
            className="m-1"
          >
            {amenity}
          </Badge>
        ))} */}
      </div>
    </div>
  );
};
