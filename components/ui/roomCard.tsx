import { Rate } from "@/lib/hotel.type";
import { cn } from "@/lib/utils";

export const RoomCard = ({
  room,
  isSelected,
  onRoomSelect,
  minDailyPrice,
}: {
  minDailyPrice: number;
  room: Rate;
  isSelected: boolean;
  onRoomSelect: (room: Rate) => void;
}) => {
  const priceToShowFull =
    +room.daily_prices[0] - minDailyPrice > 0
      ? ` ללילה/ $${Math.ceil(+room.daily_prices[0] - minDailyPrice)}+`
      : "כלול במחיר";
  return (
    <div onClick={() => onRoomSelect(room)}>
      <div
        className={cn(
          "py-2 w-full flex flex-col items-right cursor-pointer hover:font-bold border-b border-gray-200 hover:border-main text-sm flex flex-row justify-between items-center",
          isSelected && "text-secondary font-bold"
        )}
      >
        <div className="font-extrabold">
          {room.room_data_trans.main_name}
          {room.room_data_trans.bedding_type
            ? ` - (${room.room_data_trans.bedding_type})`
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
