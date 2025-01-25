import { Flight, FlightSegment } from "@/lib/app.types";
import { CardWrapper } from "./cardWrapper";
import Image from "next/image";
import { Luggage, Plane } from "lucide-react";
import { Skeleton } from "@mantine/core";

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

const StopsString = (stops: string[]) => {
  return (
    <span>
      <span
        style={{
          color: stops.length - 1 > 0 ? "#FF3B30" : "#277E89",
        }}
      >
        {`${stopsMap[stops.length - 1]} `}
      </span>
      {stops.slice(0, -1).join(", ")}
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
  const priceToShow =
    price - minPrice > 0 ? `$${Math.ceil(price - minPrice)}+` : "כלול במחיר";
  return (
    <Skeleton visible={isLoading}>
      <CardWrapper isSelected={isSelected} onClick={() => onClick(flightId)}>
        <div className="flex flex-col items-center sm:flex-row w-full py-2">
          <div className="w-full md:w-5/6">
            <FlightCard {...outbound} metadata={metadata} />
            <div className="border w-full my-2"></div>
            <FlightCard {...inbound} metadata={metadata} />
          </div>
          <div className="border-l hidden sm:block border h-32 mx-4"></div>{" "}
          <div className="font-bold md:w-1/6 text-lg lg:text-xl mt-2 w-full sm:w-1/3 text-center  border-t-2 pt-2 sm:border-none">
            {priceToShow}
            {price - minPrice > 0 ? (
              <span className="whitespace-nowrap text-sm inline pr-2 sm:block sm:pr-0">
                תוספת לכל נוסע
              </span>
            ) : (
              ""
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
    <div className="flex flex-row items-center justify-between w-full gap-1">
      <div className="w-[20%] md:w-[30%]">
        <div className="mb-2">
          <Image
            src={metadata.logo || ""}
            alt={`${metadata.name} logo`}
            width={80}
            height={80}
          />
        </div>
        <div className="text-[0.6rem] hidden md:block">{flightNumber}</div>
      </div>
      <div className="w-[70%] md:w-[50%] flex justify-center">
        <FlightMeta {...flightMeta} />
      </div>
      <div className="w-[10%] md:w-[20%] text-center display flex flex-col items-center md:items-start gap-2">
        {checkBagsIncluded && (
          <div className="text-[0.6rem] font-bold flex flex-col md:flex-row gap-2 text-right items-center whitespace-nowrap">
            <Luggage size={"16px"} />
            <span className="hidden md:block">כולל מזוודה</span>
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
  const plusOne =
    new Date(departureTime).getDay() !== new Date(arrivalTime).getDay();
  return (
    <div className="sm:text-sm md:text-lg font-bold flex flex-row items-center w-fit">
      <div className="text-end">
        <div className="flex flex-row items-center">
          {String(new Date(departureTime).getHours()).padStart(2, "0")}:
          {String(new Date(departureTime).getMinutes()).padStart(2, "0")}{" "}
        </div>
        {departureAirport}
      </div>
      <div className="flex flex-col items-center relative">
        <div className="text-xs pb-1">{convertDuration(duration)}</div>
        <Plane
          size={14}
          fill="currentColor"
          style={{ transform: "rotate(-135deg) translate(-60%, -80%)" }}
          className="absolute top-0 left-3"
        />
        {!!(stops.length - 1) && (
          <div
            style={{ transform: "translate(0, 210%)" }}
            className="rounded-full w-2 h-2 bg-[red] absolute top-0"
          />
        )}
        <div
          className="text-[0.6rem] font-bold flex flex-row gap-2 text-right items-center whitespace-nowrap border-t-2 border-main mx-4 pt-1"
          dir="rtl"
        >
          {StopsString(stops)}
        </div>
      </div>
      <div>
        <div className="flex flex-row items-center">
          {String(new Date(arrivalTime).getHours()).padStart(2, "0")}:
          {String(new Date(arrivalTime).getMinutes()).padStart(2, "0")}
          <sup className="mr-1 text-secondary">{plusOne ? "1+" : ""}</sup>
        </div>
        {arrivalAirport}
      </div>
    </div>
  );
};
