import { FlightMeta } from "@/components/ui/FlightCard";
import { Flight } from "@/lib/app.types";
import { formatPrice } from "@/lib/price.utils";
import dayjs from "dayjs";

export const FlightSummary = ({
  selectedFlight,
  airlineFullName,
  flightPriceAddition,
  agentCommission,
}: {
  selectedFlight: Flight;
  airlineFullName?: string;
  flightPriceAddition: number;
  agentCommission: number;
}) => {
  return (
    <div className="">
      <h3 className="font-bold text-lg hidden md:block">
        טיסה{" "}
        <span>
          {"("}
          {selectedFlight.numOfTravelers}
          {" נוסעים)"}
        </span>
      </h3>
      <div className="flex justify-between w-full" dir="rtl">
        <div>
          <div className="text-[16px] flex items-center hidden md:block" dir="rtl">
            <div className="font-bold ml-1" dir="ltr">
              {airlineFullName}
            </div>
          </div>
          <div className="flex text-[14px]" dir="rtl">
            <div>מ-</div>
            <div>
              {dayjs(selectedFlight.outbound.departureTime).format(
                "DD/MM/YYYY"
              )}
            </div>
            <div className="w-1"></div>
            <div>עד-</div>
            <div>
              {dayjs(selectedFlight.inbound.departureTime).format("DD/MM/YYYY")}
            </div>
          </div>
        </div>
        {agentCommission <= 0 && (
          <div>
            {formatPrice(flightPriceAddition)
              ? formatPrice(flightPriceAddition, {
                  factor: selectedFlight.numOfTravelers,
                  applyColor: false,
                  bold: false,
                })
              : "כלול במחיר"}
          </div>
        )}
      </div>
      <div className="h-1"></div>
      <div className="text-[12px] mt-2 px-2" dir="rtl">
        <FlightMeta {...selectedFlight.outbound} />
        <FlightMeta {...selectedFlight.inbound} />
      </div>
    </div>
  );
};
