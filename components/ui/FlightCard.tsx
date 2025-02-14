import { Flight, FlightSegment } from "@/lib/app.types";
import { CardWrapper } from "./cardWrapper";
import Image from "next/image";
import { Luggage, Plane } from "lucide-react";
import { Skeleton, Tooltip } from "@mantine/core";
import { isMobile } from "react-device-detect";
import { useState } from "react";
import { useClickOutside } from "@mantine/hooks";
import { formatPrice } from "@/lib/price.utils";
import { airports } from "@nwpr/airport-codes";

type FlightTicketCardProps = {
  isSelected: boolean;
  onClick: (flightId: string) => void;
  flightId: string;
  isLoading: boolean;
  minPrice: number;
} & Flight;

const stopsMap: { [key: number]: string } = {
  0: "טיסה ישירה",
  1: "עצירה אחת",
  2: "עצירות 2",
  3: "עצירות 3",
};

const numberToHourString = (hours: number | null) => {
  switch (hours) {
    case 1:
      return "שעה";
    case 2:
      return "שעתיים";
    default:
      return hours + " שעות";
  }
};

const StopsString = (
  stops: { iataCode: string; duration: number | null }[]
) => {
  return (
    <span>
      <span
        style={{
          color: stops.length - 1 > 0 ? "#FF3B30" : "#277E89",
          textDecoration:
            stops.length - 1 > 0 && isMobile ? "underline" : "none",
        }}
      >
        {`${stopsMap[stops.length - 1]} `}
      </span>
      {stops
        .map(({ iataCode }) => iataCode)
        .slice(0, -1)
        .join(", ")}
    </span>
  );
};

const convertDuration = (duration: string) => {
  const match = duration.match(/PT(\d+)H(\d*)M?/);

  if (match) {
    // If minutes exist, format as "15h 40", else just "15h"
    const hours = match[1];
    const minutes = match[2];
    if (minutes) {
      return `${hours}h ${minutes}`;
    } else {
      return `${hours}h`;
    }
  }

  return duration;
};

export const FlightTicketCard = ({
  onClick,
  isSelected,
  outbound,
  inbound,
  metadata,
  flightId,
  price,
  isLoading,
  minPrice,
}: FlightTicketCardProps) => {
  const priceToShow = formatPrice(price - minPrice);

  return (
    <Skeleton visible={isLoading}>
      <CardWrapper isSelected={isSelected} onClick={() => onClick(flightId)}>
        <div className="flex flex-col items-center lg:flex-row w-full py-2">
          <div className="w-full lg:w-5/6">
            <FlightCard {...outbound} metadata={metadata} />
            <div className="border w-full my-2"></div>
            <FlightCard {...inbound} metadata={metadata} />
          </div>
          <div className="border-l hidden lg:block border h-32 mx-4"></div>{" "}
          <div className="font-bold lg:w-1/6 mt-2 w-full text-center border-t-2 pt-2 lg:border-none">
            {!!priceToShow ? (
              <>
                <span className="text-lg lg:text-2xl">{priceToShow}</span>
                {price - minPrice < 0 ? (
                  <span className="whitespace-nowrap text-[16px] inline pr-2 lg:block lg:pr-0">
                    {"חסכון לכל נוסע!"}
                  </span>
                ) : (
                  <span className="whitespace-nowrap text-[16px] inline pr-2 lg:block lg:pr-0">
                    {"תוספת לכל נוסע"}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[20px]">כלול במחיר</span>
            )}
          </div>
        </div>
      </CardWrapper>
    </Skeleton>
  );
};

type FlightCardProps = {} & Pick<FlightTicketCardProps, "metadata"> &
  FlightSegment;

const FlightCard = ({
  metadata,
  checkBagsIncluded,
  flightNumber,
  ...flightMeta
}: FlightCardProps) => {
  return (
    <div className="flex flex-row items-center justify-between w-full gap-2 lg:gap-1">
      <div className="w-[20%] lg:w-[20%] flex flex-col items-center">
        <div className="mb-2">
          <Image
            src={metadata.logo || ""}
            alt={`${metadata.name} logo`}
            width={100}
            height={100}
          />
        </div>
        <div className="text-sm hidden lg:block">{flightNumber}</div>
      </div>
      <div className="w-[70%] lg:w-[50%] flex justify-center">
        <FlightMeta {...flightMeta} />
      </div>
      <div className="w-[10%] lg:w-[20%] text-center display flex flex-col items-center gap-2">
        {checkBagsIncluded && (
          <div className="text-xs font-bold flex flex-col lg:flex-row gap-2 text-right items-center whitespace-nowrap">
            <Luggage size={isMobile ? "18px" : "24px"} />
            <span className="hidden text-[16px] lg:block">כולל מזוודה</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const FlightMeta = ({
  arrivalAirport,
  arrivalTime,
  departureAirport,
  departureTime,
  duration,
  stops,
}: Pick<
  FlightCardProps,
  | "arrivalAirport"
  | "arrivalTime"
  | "departureAirport"
  | "departureTime"
  | "duration"
  | "stops"
>) => {
  const [tooltipOpened, setTooltipOpened] = useState(false);
  const ref = useClickOutside(() => isMobile && setTooltipOpened(false));
  const plusOne =
    new Date(departureTime).getDay() !== new Date(arrivalTime).getDay();

  return (
    <div className="flex flex-row items-center w-full justify-around" ref={ref}>
      <div className="text-end">
        <div className="flex flex-row items-center text-md font-bold lg:text-2xl">
          {String(new Date(departureTime).getHours()).padStart(2, "0")}:
          {String(new Date(departureTime).getMinutes()).padStart(2, "0")}{" "}
        </div>
        <div className="text-sm lg:text-lg">{departureAirport}</div>
      </div>
      <div className="flex flex-col items-center relative w-full">
        <div className="text-xs pb-1">{convertDuration(duration)}</div>
        <Plane
          size={14}
          fill="currentColor"
          style={{ transform: "rotate(-135deg) translate(-60%, -80%)" }}
          className="absolute top-0 left-2"
        />
        {!!(stops.length - 1) && (
          <div
            style={{ transform: "translate(0, 210%)" }}
            className="rounded-full w-2 h-2 bg-[red] absolute top-0"
          />
        )}
        <div
          onTouchStart={() => setTooltipOpened((curr) => !curr)}
          className="text-xs font-bold flex flex-row gap-2 items-center justify-center whitespace-nowrap border-t-2 border-main mx-4 pt-1 w-[90%]"
          dir="rtl"
        >
          <Tooltip
            label={
              <span dir="rtl">
                {stops
                  .map((stop, i) => (
                    <span key={i} dir="rtl" className="mr-1">
                      {"המתנה של " +
                        numberToHourString(stop.duration) +
                        " ב-" +
                        //airports.find(
                        //  (airport) => airport.iata === stop.iataCode
                        //)?.name +
                        //", " +
                        airports.find(
                          (airport) => airport.iata === stop.iataCode
                        )?.city}
                    </span>
                  ))
                  .slice(0, -1)}
              </span>
            }
            position="top"
            opened={
              !!(stops.length - 1) && (isMobile ? tooltipOpened : undefined)
            }
          >
            {StopsString(stops)}
          </Tooltip>
        </div>
      </div>
      <div>
        <div className="flex flex-row items-center relative text-md font-bold lg:text-2xl">
          {String(new Date(arrivalTime).getHours()).padStart(2, "0")}:
          {String(new Date(arrivalTime).getMinutes()).padStart(2, "0")}
          <Tooltip label="נחיתה ביום למחרת" position="top">
            <span className="text-xs mr-1 text-secondary absolute top-0 left-0 transform translate-x-[-100%] translate-y-[-30%]">
              {plusOne ? "1+" : ""}
            </span>
          </Tooltip>
        </div>
        <div className="text-sm lg:text-lg">{arrivalAirport}</div>
      </div>
    </div>
  );
};
