import { Rate } from "@/lib/hotel.type";
import { CardWrapper } from "./cardWrapper";
import { cn } from "@/lib/utils";

export const RoomCard = ({
  room,
  isSelected,
  onRoomSelect,
}: {
  room: Rate;
  isSelected: boolean;
  onRoomSelect: (room: Rate) => void;
}) => {
  return (
    <div onClick={() => onRoomSelect(room)}>
      <div
        className={cn(
          "p-2 w-full flex flex-col items-right cursor-pointer hover:font-bold border-b border-gray-200 hover:border-main flex flex-row justify-between items-center",
          isSelected && "text-secondary font-bold"
        )}
      >
        <div className="text-sm">
          {room.room_data_trans.bedding_type} {room.room_data_trans.main_name}
          {room.room_data_trans.bedding_type
            ? ` - ${room.room_data_trans.bedding_type}`
            : ""}
        </div>
        {/* <Badge color="pink" variant="light">
          {room.room_name} ★
        </Badge> */}
        {/* <div>Meal: {room.meal}</div> */}
        <div> {room.daily_prices[0]}&#8364; / ליליה</div>
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
