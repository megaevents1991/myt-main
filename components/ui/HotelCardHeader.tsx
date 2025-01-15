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
          <div className="font-bold text-sm md:text-lg">
            {formatHotelName(hotelName)}
          </div>
          <Stars rating={rating} />
        </div>
        <div className="text-sm">
          {Math.round((distanceFromCenter / 1000) * 10) / 10} ק&quot;מ ממרכז
          העיר
        </div>
      </div>
      <div className="flex flex-row justify-between items-center gap-2 text-sm sm:w-2/3">
        <div className="font-bold">{roomName}</div>
        <div>{meals ? "כולל ארוחות" : "ללא ארוחות"}</div>
      </div>
    </div>
  );
};
