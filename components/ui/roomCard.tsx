import { Rate } from "@/lib/hotel.type";
import { CardWrapper } from "./cardWrapper";

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
    <CardWrapper isSelected={isSelected} onClick={() => onRoomSelect(room)}>
      <div className="p-2 w-full flex flex-col items-right cursor-pointer">
        {room.room_name}
        {/* <Badge color="pink" variant="light">
          {room.room_name} ★
        </Badge> */}
        <div>Meal: {room.meal}</div>
        {room.daily_prices[0]} / night
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
    </CardWrapper>
  );
};
