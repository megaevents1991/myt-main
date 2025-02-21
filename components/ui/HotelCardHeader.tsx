import { formatHotelName } from "@/lib/formatHotelName";
import { Stars } from "./stars";
import { Utensils } from "lucide-react";
import { Tooltip } from "@mantine/core";
import { useClickOutside } from "@mantine/hooks";
import { isMobile } from "react-device-detect";
import { useState } from "react";

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
  const [tooltipOpened, setTooltipOpened] = useState(false);
  const ref = useClickOutside(() => isMobile && setTooltipOpened(false));
  return (
    <div className="flex flex-col gap-2 m" ref={ref}>
      <div className="flex flex-col justify-between items-start">
        <div className="flex flex-row gap-2 items-center w-full">
          <div className="font-bold text-lg lg:text-2xl" dir="ltr">
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
          <div
            onTouchStart={() => setTooltipOpened((curr) => !curr)}
            className="text-xs font-bold flex"
            dir="ltr"
          >
            <span className="font-bold text-[16px] ml-2">{roomName}</span>
            {meals ? (
              <Tooltip
                label="כולל ארוחת בוקר"
                position="top"
                opened={true && (isMobile ? tooltipOpened : undefined)}
              >
                <div className="w-4 h-4">
                  <span> {<Utensils size={18} />}</span>
                </div>
              </Tooltip>
            ) : (
              <div />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
