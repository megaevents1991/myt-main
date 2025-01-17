import { Flight, FlightSegment } from "@/lib/app.types";
import { CardWrapper } from "./cardWrapper";
import Image from "next/image";
import { ArrowLeft, Info, Luggage } from "lucide-react";
import { Skeleton, Tooltip } from "@mantine/core";
import { isMobile } from "react-device-detect";
import { useState } from "react";
import { useClickOutside } from "@mantine/hooks";

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
    price - minPrice > 0 ? `€${Math.ceil(price - minPrice)}+` : "כלול במחיר";
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
          <div className="font-bold md:w-1/6 text-lg lg:text-xl mt-2 w-full sm:w-1/3 text-right sm:text-center">
            {priceToShow}
            <div className="hidden sm:block"></div>
          </div>
        </div>
      </CardWrapper>
    </Skeleton>
  );
};

type FlightCardProps = {} & Pick<FlightTicketCardProps, "metadata"> &
  FlightSegment;

const FlightCard = ({
  stops,
  metadata,
  checkBagsIncluded,
  ...flightMeta
}: FlightCardProps) => {
  const [tooltipOpened, setTooltipOpened] = useState(false);
  const ref = useClickOutside(() => isMobile && setTooltipOpened(false));

  return (
    <div
      className="flex flex-row items-center justify-between w-full gap-1"
      ref={ref}
    >
      <div className="w-2/6 md:w-[30%]">
        <div className="mb-2">
          <Image
            src={metadata.logo || ""}
            alt={`${metadata.name} logo`}
            width={80}
            height={80}
          />
        </div>
        <div className="text-[0.8rem]">{metadata.name}</div>
      </div>
      <div className="w-[25%] md:w-[30%]">
        <FlightMeta {...flightMeta} />
      </div>
      <div className="w-[25%] md:w-[20%] text-center display flex flex-col items-center md:items-start gap-2">
        <div
          className="text-[0.6rem] font-bold flex flex-col md:flex-row gap-2 text-right items-center"
          onTouchStart={() => setTooltipOpened((curr) => !curr)}
        >
          {stops.length - 1 ? (
            <Tooltip
              label={`${stops.slice(0, -1).join(", ")} עצירה ב`}
              position="top"
              opened={isMobile ? tooltipOpened : undefined}
            >
              <Info size={"16px"} />
            </Tooltip>
          ) : null}
          {stopsMap[stops.length - 1]}
        </div>
        {checkBagsIncluded && (
          <div className="text-[0.6rem] font-bold flex flex-col md:flex-row gap-2 text-right items-center whitespace-nowrap">
            <Luggage size={"16px"} /> כולל מזוודה
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
}: Pick<
  FlightCardProps,
  "arrivalAirport" | "arrivalTime" | "departureAirport" | "departureTime"
>) => {
  const plusOne =
    new Date(departureTime).getDay() !== new Date(arrivalTime).getDay();
  return (
    <>
      <div className="sm:text-sm md:text-lg font-bold flex flex-row items-center w-fit">
        <div>
          {String(new Date(departureTime).getHours()).padStart(2, "0")}:
          {String(new Date(departureTime).getMinutes()).padStart(2, "0")}{" "}
        </div>
        <ArrowLeft size={12} />
        <div className="flex flex-row items-center">
          {String(new Date(arrivalTime).getHours()).padStart(2, "0")}:
          {String(new Date(arrivalTime).getMinutes()).padStart(2, "0")}
          <sup className="mr-1 text-secondary">{plusOne ? "1+" : ""}</sup>
        </div>
      </div>
      <div className="text-sm inline-flex items-center flex-row">
        {departureAirport}
        <ArrowLeft size={12} />
        {arrivalAirport}
      </div>
    </>
  );
};
