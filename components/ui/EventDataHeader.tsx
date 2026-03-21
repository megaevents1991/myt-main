import { Event } from "@/lib/app.types";
import dayjs from "dayjs";
import { isMobile } from "react-device-detect";

export const EventDataHeader = ({ event }: { event?: Event }) => {
  return (
    <div className="flex flex-col w-full lg:w-[25%]">
      <h1 className="flex flex-col font-normal text-base m-0">
        <span className="text-3xl mb-1 font-bold">{event?.name}</span>
        <span className="whitespace-nowrap text-xl">
          {dayjs(event?.date).format("DD/MM/YY")} | {event?.location.name}
        </span>
      </h1>
      {!isMobile && (
        <span className="text-lg mt-1" style={{ lineHeight: "1.1" }}>
          {event?.description}
        </span>
      )}
    </div>
  );
};
