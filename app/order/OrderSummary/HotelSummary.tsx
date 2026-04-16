import { OrderHotel } from "@/lib/app.types";
import { formatPrice } from "@/lib/price.utils";
import dayjs from "dayjs";

export const HotelSummary = ({
  selectedHotel,
  agentCommission,
  hotelPriceAddition,
  totalGuests,
}: {
  selectedHotel: OrderHotel;
  agentCommission: number;
  hotelPriceAddition: number;
  totalGuests: number;
}) => {
  return (
    <div className="">
      <h3 className="font-bold text-lg hidden md:block">
        לינה{" "}
        <span>
          {"("}
          {selectedHotel.guests.reduce(
            (ppl, room) => ppl + room.children.length + room.adults,
            0
          )}
          {" אורחים)"}
        </span>
      </h3>
      <div className="flex w-full justify-between" dir="rtl">
        <div>
          <p className="font-bold hidden md:block" dir="ltr">
            {selectedHotel.name}
          </p>
          <p dir="ltr">
          {selectedHotel.isOffline
            ? selectedHotel.hotelInformation.roomName
            : selectedHotel.rate?.room_data_trans?.main_name}
        </p>
        </div>
        {agentCommission <= 0 && (
          <div>
            {hotelPriceAddition
              ? formatPrice(hotelPriceAddition, {
                  factor: totalGuests,
                  applyColor: false,
                  bold: false,
                })
              : "כלול במחיר"}
          </div>
        )}
      </div>
      <div className="flex text-[14px]" dir="rtl">
        <div>מ-</div>
        <div>
          {dayjs(selectedHotel.checkin).format(
            // pass check-in and check-out dates to selectedhotel (need to chaned hotel order type)
            "DD/MM/YYYY"
          )}
        </div>
        <div className="w-1"></div>
        <div>עד-</div>
        <div>{dayjs(selectedHotel.checkout).format("DD/MM/YYYY")}</div>
      </div>
    </div>
  );
};
