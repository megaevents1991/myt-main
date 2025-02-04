import { formatHotelName } from "@/lib/formatHotelName";
import { Stars } from "./stars";

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
      <div className="flex flex-col justify-between items-start gap-2">
        <div className="flex flex-row gap-2 items-center ">
          <div className="font-bold text-lg lg:text-2xl">
            {formatHotelName(hotelName)}
          </div>
          <Stars rating={rating} />
        </div>
        <div className="text-[16px]">
          {Math.round((distanceFromCenter / 1000) * 10) / 10} ק&quot;מ ממרכז
          העיר
        </div>
      </div>
      {roomName && (
        <div className="w-full flex flex-col lg:flex-row justify-between items-left gap-2 text-sm lg:w-2/3 mb-2">
          <div className="font-bold">{roomName}</div>
          <div>{meals ? "כולל ארוחות" : "ללא ארוחות"}</div>
        </div>
      )}
    </div>
  );
};
