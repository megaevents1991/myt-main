import { Flight, FlightSegment } from "@/lib/app.types";
import { CardWrapper } from "./cardWrapper";
import Image from "next/image";
import { Plane } from "lucide-react";
import { Skeleton, Tooltip } from "@mantine/core";
import { isMobile } from "react-device-detect";
import { ReactNode, useState, memo } from "react";
import { useClickOutside } from "@mantine/hooks";
import { formatPrice } from "@/lib/price.utils";
import { airports } from "@nwpr/airport-codes";
import { cn } from "@/lib/utils";
//import { InfoIcon } from "../icons/InfoIcon";

type FlightTicketCardProps = {
  selectedFlightId?: string;
  onClick: (flightId: string) => void;
  flightId: string;
  isLoading: boolean;
  minPrice: number;
  isBest?: boolean;
  isCheapest?: boolean;
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

const BagIconContainer = ({
  bagIcon,
  count,
}: {
  bagIcon: ReactNode;
  count: number;
}) => {
  return (
    <div className="text-xs font-bold flex items-center justify-end gap-1 w-full">
      <div className="w-full flex justify-center">{bagIcon}</div>
      <div>{count}</div>
    </div>
  );
};

const LuggageButton = ({
  cabinBagsIncluded,
  checkBagsIncluded,
  isSelected,
}: {
  cabinBagsIncluded: boolean;
  checkBagsIncluded: boolean;
  isSelected: boolean;
}) => {
  return (
    <button
      className={cn(
        "bg-gray-200 rounded-l-md absolute h-full px-2 left-0 block lg:hidden",
        isSelected && "bg-[#277E892e]"
      )}
      type="button"
      aria-label={`מידע על מזוודות: תיק יד כלול, ${
        cabinBagsIncluded
          ? "מזוודת תא נוסעים כלולה"
          : "מזוודת תא נוסעים לא כלולה"
      }, ${checkBagsIncluded ? "מזוודה נרשמת כלולה" : "מזוודה נרשמת לא כלולה"}`}
    >
      <div className="flex flex-col items-center justify-evenly h-full gap-0">
        <BagIconContainer
          bagIcon={
            <Image
              alt="hand-bag-icon"
              src="/icons/hand-bag.svg"
              width={12}
              height={12}
              unoptimized
            />
          }
          count={1}
        />
        <div className="border-b w-full border-gray-400"></div>
        <BagIconContainer
          count={cabinBagsIncluded ? 1 : 0}
          bagIcon={
            <Image
              alt="cabin-bag-icon"
              src="/icons/cabin-bag.svg"
              width={14}
              height={14}
              unoptimized
            />
          }
        />
        <div className="border-b w-full border-gray-400"></div>

        <BagIconContainer
          bagIcon={
            <Image
              alt="checked-bag-icon"
              src="/icons/checked-bag.svg"
              width={22}
              height={22}
              unoptimized
            />
          }
          count={checkBagsIncluded ? 1 : 0}
        />
        {/*
          <div className="border-b w-full border-gray-400"></div>

        <div className="text-xs font-bold flex items-center justify-center gap-1 w-full ">
          <InfoIcon fill={isSelected ? "#277E89" : "grey"} />
        </div>
           */}
      </div>
    </button>
  );
};

export const FlightTicketCard = memo(
  ({
    onClick,
    selectedFlightId,
    outbound,
    inbound,
    metadata,
    flightId,
    price,
    isLoading,
    minPrice,
    isBest,
    isCheapest,
  }: FlightTicketCardProps) => {
    const isSelected = selectedFlightId === flightId;
    const priceToShow = formatPrice(price - minPrice);

    const priceOutsidePackBoundries =
      Math.abs(price - minPrice) > 4 ? true : false;

    return (
      <Skeleton visible={isLoading}>
        <CardWrapper isSelected={isSelected} onClick={() => onClick(flightId)}>
          {isBest && (
            <div className="bg-amber-400 text-white text-xs font-bold px-3 py-1 rounded-t-lg" dir="rtl">
              ⭐ הטוב ביותר — טיסה מהמלאי שלנו
            </div>
          )}
          {isCheapest && (
            <div className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-t-lg" dir="rtl">
              💰 הזול ביותר
            </div>
          )}
          <div className="flex items-center lg:flex-row w-full py-2 pl-12 lg:pl-0">
            <div className="w-full lg:w-5/6 mt-2 lg:mt-0">
              <FlightCard {...outbound} metadata={metadata} />
              <div className="border w-full my-2"></div>
              <FlightCard {...inbound} metadata={metadata} />
            </div>
            <div className="border-l hidden lg:block border h-32 mx-4"></div>{" "}
            {/* Desktop pricing element */}
            <div className="hidden lg:block font-bold w-1/6 mt-2 text-center pt-2 border-none">
              {priceOutsidePackBoundries ? (
                <>
                  <span className="text-lg lg:text-2xl">{priceToShow}</span>
                  {price - minPrice < 0 ? (
                    <span className="whitespace-nowrap text-lg inline pr-2 lg:block lg:pr-0">
                      {"חסכון לכל נוסע"}
                    </span>
                  ) : (
                    <span className="whitespace-nowrap text-lg inline pr-2 lg:block lg:pr-0">
                      {"תוספת לכל נוסע"}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xl">כלול במחיר</span>
              )}
            </div>
            {/* Mobile pricing element */}
            <div
              className={cn(
                "absolute bg-white border lg:hidden right-2 top-0 whitespace-nowrap font-bold transform -translate-y-1/2 text-secondary rounded-2xl px-3 py-1 text-sm",
                isSelected && "bg-secondary text-white"
              )}
            >
              {priceOutsidePackBoundries ? (
                <>
                  {price - minPrice < 0 ? (
                    <span>
                      {"הפחיתו"} {priceToShow} {"לנוסע ממחיר החבילה"}
                    </span>
                  ) : (
                    <span>
                      {"תוספת"} {priceToShow} {"לנוסע"}
                    </span>
                  )}
                </>
              ) : (
                <span>כלול במחיר</span>
              )}
            </div>
            <LuggageButton
              isSelected={isSelected}
              cabinBagsIncluded={outbound.cabinBagsIncluded}
              checkBagsIncluded={outbound.checkBagsIncluded}
            />{" "}
          </div>
        </CardWrapper>
      </Skeleton>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if the selection state for this specific card changes
    // or if other critical props change
    const prevSelected = prevProps.selectedFlightId === prevProps.flightId;
    const nextSelected = nextProps.selectedFlightId === nextProps.flightId;

    return (
      prevSelected === nextSelected &&
      prevProps.isLoading === nextProps.isLoading &&
      prevProps.price === nextProps.price &&
      prevProps.flightId === nextProps.flightId &&
      prevProps.isBest === nextProps.isBest &&
      prevProps.isCheapest === nextProps.isCheapest
    );
  }
);

FlightTicketCard.displayName = "FlightTicketCard";

export const MemoizedFlightCard = memo(FlightTicketCard);

type FlightCardProps = {} & Pick<FlightTicketCardProps, "metadata"> &
  FlightSegment;

const FlightCard = ({
  metadata,
  checkBagsIncluded,
  cabinBagsIncluded,
  flightNumber,
  ...flightMeta
}: FlightCardProps) => {
  const [tooltipCabinOpened, setTooltipCabinOpened] = useState(false);
  const [tooltipCheckedOpened, setTooltipCheckedOpened] = useState(false);

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
      <div className="w-full lg:w-[50%] flex justify-center">
        <FlightMeta {...flightMeta} />
      </div>
      <div className="hidden lg:block lg:w-[20%] pr-2 text-center flex flex-col lg:items-start gap-2">
        {checkBagsIncluded && (
          <div className="text-xs font-bold flex flex-col lg:flex-row gap-2 text-right items-center whitespace-nowrap">
            <div
              onTouchStart={() => setTooltipCheckedOpened((curr) => !curr)}
              className="text-xs font-bold flex"
            >
              <Tooltip
                label="כולל מזוודה"
                position="top"
                opened={true && (isMobile ? tooltipCheckedOpened : undefined)}
              >
                <div className="flex items-center">
                  <Image
                    alt="checked-bags-icon"
                    src="/icons/noun-luggage-3710164.svg"
                    width={isMobile ? 28 : 32}
                    height={isMobile ? 28 : 32}
                    unoptimized
                  />
                  <span className="hidden text-[15px] mr-1 lg:block">
                    כולל מזוודה
                  </span>
                </div>
              </Tooltip>
            </div>
          </div>
        )}
        {cabinBagsIncluded && (
          <div className="text-xs font-bold flex flex-col lg:flex-row gap-2 text-right items-center whitespace-nowrap">
            <div
              onTouchStart={() => setTooltipCabinOpened((curr) => !curr)}
              className="text-xs font-bold flex"
            >
              <Tooltip
                label="כולל טרולי"
                position="top"
                opened={true && (isMobile ? tooltipCabinOpened : undefined)}
              >
                <div className="flex items-center">
                  <Image
                    alt="cabin-bags-icon"
                    src="/icons/noun-luggage-3710176.svg"
                    width={isMobile ? 20 : 24}
                    height={isMobile ? 20 : 24}
                    className="lg:mr-1 lg:ml-1"
                    unoptimized
                  />
                  <span className="hidden text-[15px] mr-1 lg:block">
                    כולל טרולי
                  </span>
                </div>
              </Tooltip>
            </div>
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
        <div className="flex flex-row items-center text-md font-bold lg:text-2xl whitespace-nowrap">
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
        <div className="flex flex-row items-center relative text-md font-bold lg:text-2xl whitespace-nowrap">
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
