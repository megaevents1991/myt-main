import Image from "next/image";
import Link from "next/link";
import { Event } from "@/lib/app.types";
import dayjs from "dayjs";
import { isMobile } from "react-device-detect";
import { ChevronLeft } from "lucide-react";

export const EventDataHeader = ({
  event,
  artistHref,
}: {
  event?: Event;
  /** When set, the round photo links to the artist page. */
  artistHref?: string;
}) => {
  const imageUrl = event?.card_image_url;
  const photo = imageUrl && (
    <Image
      src={imageUrl}
      alt={artistHref ? `${event?.name ?? ""} — לעמוד האמן` : ""}
      width={80}
      height={80}
      className="size-16 shrink-0 rounded-full border-2 border-white object-cover object-top shadow-md md:size-20"
    />
  );
  return (
    <div className="flex w-full flex-row items-center gap-4 lg:w-[30%]">
      {photo &&
        (artistHref ? (
          <Link
            href={artistHref}
            aria-label={`${event?.name ?? "האמן"} — מעבר לעמוד האמן`}
            className="shrink-0 rounded-full transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-forest"
          >
            {photo}
          </Link>
        ) : (
          photo
        ))}
      <div className="flex flex-col">
        <h1 className="flex flex-col font-normal text-base m-0">
          <span className="text-3xl mb-1 font-bold">{event?.name}</span>
          <span className="whitespace-nowrap text-xl">
            {dayjs(event?.date).format("DD/MM/YY")} | {event?.location.name}
          </span>
        </h1>
        {artistHref && (
          <Link
            href={artistHref}
            className="mt-1 inline-flex w-fit items-center gap-0.5 text-sm font-semibold text-forest underline decoration-forest/40 underline-offset-2 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-forest dark:text-glow dark:decoration-glow/40 dark:focus-visible:outline-glow"
          >
            לכל ההופעות של {event?.name?.trim()}
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
        )}
        {!isMobile && (
          <span className="text-lg mt-1" style={{ lineHeight: "1.1" }}>
            {event?.description}
          </span>
        )}
      </div>
    </div>
  );
};
