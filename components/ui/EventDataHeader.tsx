import { Event } from "@/lib/app.types";
import dayjs from "dayjs";

export const EventDataHeader = ({ event }: { event?: Event }) => {
  return (
    <div className="flex flex-col w-full lg:w-[25%]">
      <span className="text-3xl mb-1 font-bold">{event?.name}</span>
      <span className="whitespace-nowrap text-lg">
        {dayjs(event?.date).format("DD/MM/YY")} | {event?.location.name}
      </span>
      <span className="text-lg">{event?.description}</span>
    </div>
  );
};
