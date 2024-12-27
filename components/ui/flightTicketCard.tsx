import { Flight } from "@/lib/app.types";
import { CardWrapper } from "./cardWrapper";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

type FlightTicketCardProps = {
  isSelected: boolean;
  onClick: (flightId: string) => void;
  flightId: string;
} & Flight;

export const FlightTicketCard = ({
  onClick,
  isSelected,
  outbound,
  inbound,
  metadata,
  flightId,
  stops,
  price,
}: FlightTicketCardProps) => {
  return (
    <CardWrapper isSelected={isSelected} onClick={() => onClick(flightId)}>
      <div className="flex flex-col w-full py-2">
        <FlightCard {...outbound} metadata={metadata} stops={stops} />
        <div className="border w-full my-2"></div>
        <FlightCard {...inbound} metadata={metadata} stops={stops} />
        <div className="font-bold mt-2">
          מחיר: {price}
          &#8364;
        </div>
      </div>
    </CardWrapper>
  );
};

type FlightCardProps = {} & Pick<FlightTicketCardProps, "metadata" | "stops"> &
  (FlightTicketCardProps["inbound"] | FlightTicketCardProps["outbound"]);

const FlightCard = ({
  arrivalAirport,
  arrivalTime,
  departureAirport,
  departureTime,
  metadata,
  stops,
}: FlightCardProps) => {
  return (
    <div className="flex flex-row items-center justify-between w-full">
      <div className="w-2/6">
        <div className="mb-2">
          <Image
            src={metadata.logo || ""}
            alt={`${metadata.name} logo`}
            width={80}
            height={80}
          />
        </div>
        <div className="text-sm">{metadata.name}</div>
      </div>
      <div className="w-3/6">
        <div className="text-lg font-bold">
          {String(new Date(departureTime).getHours()).padStart(2, "0")}:
          {String(new Date(departureTime).getMinutes()).padStart(2, "0")} -{" "}
          {String(new Date(arrivalTime).getHours()).padStart(2, "0")}:
          {String(new Date(arrivalTime).getMinutes()).padStart(2, "0")}
        </div>
        <div className="text-sm inline-flex items-center">
          {departureAirport} <ArrowLeft size={12} />
          {arrivalAirport}
        </div>
      </div>
      <div className="w-1/6 text-center">
        <div className="text-sm font-bold">
          {stops === 0 ? "טיסה ישירה" : "עצירה אחת"}
        </div>
      </div>
    </div>
  );
};
