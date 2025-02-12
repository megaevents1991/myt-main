import { formatHotelName } from "@/lib/formatHotelName";
import { Stars } from "./stars";
import { Ham } from "lucide-react";

type HotelCardHeaderProps = {
  hotelName: string;
  distanceFromCenter: number;
  meals: boolean;
  roomName: string;
  rating: number;
};

export const HotelCardHeader = ({
  rating,
  distanceFromCenter,
  hotelName,
  roomName,
  meals,
}: HotelCardHeaderProps) => {
  return (
    <div className="flex flex-col gap-2 m">
      <div className="flex flex-col justify-between items-start">
        <div className="flex flex-row gap-2 items-center ">
          <div className="font-bold text-lg lg:text-2xl">
            {formatHotelName(hotelName)}
          </div>
          <Stars rating={rating} />
        </div>
        <div className="text-[16px]">
          {distanceFromCenter} מ&#39; ממרכז העיר
        </div>
      </div>
      {roomName && (
        <div className="w-full flex flex-col lg:flex-row justify-between items-left text-sm lg:w-2/3">
          <div className="font-bold">{roomName}</div>
          {meals && <div>{<Ham />}</div>}
        </div>
      )}
    </div>
  );
};
