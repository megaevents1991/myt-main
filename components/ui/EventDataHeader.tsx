import { Event } from "@/lib/app.types";
import dayjs from "dayjs";
import { isMobile } from "react-device-detect";

export const EventDataHeader = ({
  event,
  titleOverride,
  subtitleOverride,
  hideDateLocation,
}: {
  event?: Event;
  titleOverride?: string;
  subtitleOverride?: string;
  hideDateLocation?: boolean;
}) => {
  return (
    <div className="flex flex-col w-full lg:w-[25%]">
      <h1 className="flex flex-col font-normal text-base m-0">
        <span className="text-3xl mb-1 font-bold">{titleOverride ?? event?.name}</span>
        {subtitleOverride ? (
          <span className="text-xl font-semibold text-muted-foreground" style={{ lineHeight: "1.1" }}>
            {subtitleOverride}
          </span>
        ) : null}
        {!hideDateLocation ? (
          <span className="whitespace-nowrap text-xl">
            {dayjs(event?.date).format("DD/MM/YY")} | {event?.location.name}
          </span>
        ) : null}
      </h1>
      {!isMobile && (
        <span className="text-lg mt-1" style={{ lineHeight: "1.1" }}>
          {event?.description}
        </span>
      )}
    </div>
  );
};
