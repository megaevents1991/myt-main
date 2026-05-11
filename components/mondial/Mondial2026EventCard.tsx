import Image from "next/image";
import dayjs from "dayjs";
import type { Event } from "@/lib/app.types";
import EventButton from "@/components/EventButton";
import {
  getMondial2026MatchPrefix,
  parseMondial2026EventName,
} from "@/lib/mondial2026Title";
import { EventTagBadge, isValidEventTag, type EventTagType } from "./EventTagBadge";
import { TicketOnlyBadge } from "@/components/TicketOnlyBadge";

type Mondial2026EventCardProps = {
  event: Event;
  isSelected: boolean;
  isSoldOut: boolean;
  isSameDateDisabled?: boolean;
  displayedPrice: number;
  hidePrice?: boolean;
  onClick: () => void;
};

export function Mondial2026EventCard({
  event,
  isSelected,
  isSoldOut,
  isSameDateDisabled = false,
  displayedPrice,
  hidePrice = false,
  onClick,
}: Mondial2026EventCardProps) {
  const prefix = getMondial2026MatchPrefix(event.name);
  const parsed = parseMondial2026EventName(event.name);
  const title = parsed.isMondial2026 ? (parsed.teamsTitle || event.name) : event.name;

  const isDisabled = isSoldOut || isSameDateDisabled;

  const tagToShow = isSoldOut
    ? "Sold"
    : isValidEventTag(event.tags)
      ? event.tags
      : null;

  return (
    <div role="listitem" aria-label={isSoldOut ? "משחק - אזל מהמלאי" : "בחירת משחק"}>
      <EventButton event={event} eventPriceOverride={displayedPrice}>
        <button
          type="button"
          disabled={isDisabled}
          onClick={onClick}
          className={isDisabled ? "cursor-default w-full text-left" : "cursor-pointer w-full text-left"}
        >
          <div
            className={`rounded-lg shadow-lg flex flex-row-reverse sm:flex-col transition-all duration-200 ${
              isSelected 
                ? "outline outline-4 outline-secondary ring-4 ring-secondary/20 shadow-xl scale-[1.02]" 
                : isDisabled
                  ? "opacity-50 grayscale"
                  : "outline outline-2 outline-transparent hover:outline-secondary hover:shadow-xl"
            }`}
          >
            <div
              className="relative group overflow-hidden rounded-l-lg sm:rounded-t-lg sm:rounded-b-none w-[48%] sm:w-auto"
              dir="rtl"
            >
              {tagToShow && <EventTagBadge tag={tagToShow as EventTagType} />}
              {event.skip_flight === true && <TicketOnlyBadge />}
              <Image
                src={event.card_image_url}
                alt={event.name}
                priority={true}
                width={400}
                height={300}
                style={{ objectPosition: "center top" }}
                className="object-cover w-full h-72 transition-transform group-hover:scale-105"
              />
            </div>
            <div className="flex flex-col text-center w-[52%] sm:w-auto">
              <div
                className={
                  hidePrice
                    ? "p-2 min-h-[72px] flex flex-col justify-center"
                    : "p-2"
                }
                style={{ lineHeight: "1.1" }}
              >
                {!hidePrice && prefix ? (
                  <>
                    <div className="text-sm font-medium text-muted-foreground">{prefix}</div>
                    <div className="text-2xl font-bold">{title}</div>
                  </>
                ) : (
                  <div className="text-2xl font-bold">{title}</div>
                )}
              </div>
              <div className="py-1 px-2 bg-secondary font-semibold text-white flex flex-wrap justify-center items-center">
                <span>
                  {event.date ? dayjs(event.date).format("DD/MM/YYYY") : "תאריך יפורסם בקרוב"}
                </span>
                <span className="sm:inline hidden mx-2">|</span>
                <span className="w-full sm:w-auto whitespace-nowrap">{event.location.name}</span>
              </div>
              <div
                className={
                  hidePrice
                    ? "p-2 text-center flex flex-col min-h-[72px] justify-center"
                    : "p-2 text-center flex flex-col flex-grow"
                }
              >
                {!hidePrice && (
                  <>
                    <div className="text-sm sm:text-base">מחיר חבילה ממוצע לאדם</div>
                    <div className="text-2xl font-extrabold">
                      ${displayedPrice.toLocaleString("en-US")}
                    </div>
                    <div className="flex-grow min-h-[4px]"></div>
                    <div className="text-[14px]" style={{ lineHeight: "1.1" }}>
                      לנוסע, עבור טיסה וכרטיס לאירוע
                    </div>
                  </>
                )}
                {isSoldOut ? (
                  <div className="my-2 py-2 flex-shrink-0 h-[22px] sm:h-[40px]"></div>
                ) : (
                  <>
                    {!hidePrice ? (
                      <>
                        <div className="bg-[#002240] text-[14px] font-bold mx-1 my-2 justify-center text-white rounded-lg px-4 py-2 flex items-center sm:hidden">
                          הוזילו או שדרגו כאן {"  >"}
                        </div>
                        <u className="my-2 flex justify-center text-[#178189] text-[14px] font-bold hidden sm:flex">
                          הוזילו או שדרגו כאן {"  >"}
                        </u>
                      </>
                    ) : 
                    (
                      prefix ? (
                        <div className="text-xl text-center font-bold text-muted-foreground">
                          {prefix}
                        </div>
                      ) : null
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </button>
      </EventButton>
    </div>
  );
}
