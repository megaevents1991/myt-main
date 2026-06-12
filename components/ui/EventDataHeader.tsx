import Image from "next/image";
import { Event } from "@/lib/app.types";
import dayjs from "dayjs";
import { isMobile } from "react-device-detect";

export const EventDataHeader = ({ event }: { event?: Event }) => {
  const imageUrl = event?.card_image_url;
  return (
    <div className="flex w-full flex-row items-center gap-4 lg:w-[30%]">
      {imageUrl && (
        <Image
          src={imageUrl}
          alt=""
          width={80}
          height={80}
          className="size-16 shrink-0 rounded-full border-2 border-white object-cover object-top shadow-md md:size-20"
        />
      )}
      <div className="flex flex-col">
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
    </div>
  );
};
