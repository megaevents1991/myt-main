"use client";

import dayjs from "dayjs";
import { BedDouble, Check, Loader2, Minus, Phone, Plane, Plus, Star, Ticket } from "lucide-react";
import type { ReactNode } from "react";
import type { ReadyPackageState } from "@/app/app.context";
import { mealPlanLabel } from "@/app/order/order-review.utils";
import type { Event, Flight, FlightSegment, OrderHotel } from "@/lib/app.types";
import { cityName, hasEventCity } from "@/lib/events/lodging";
import { neighbourPax } from "@/lib/events/readyPackage";
import { cn } from "@/lib/utils";

const PHONE_HREF = "tel:+97237684800";
const PHONE_LABEL = "03-768-4800";
const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** "<event city> · טיסה ל<flight city>" on a two-city event, else the city (as the summary prints it). */
const placeLine = (event: Event) =>
  hasEventCity(event) && event.event_location
    ? `${cityName(event, "event")} · טיסה ל${cityName(event, "flight")}`
    : event.location.name;

/** No stop on the way: `stops` lists the stopovers and then the destination. */
const isDirect = (leg: FlightSegment) => (leg.stops?.length ?? 1) <= 1;

const Card = ({
  icon,
  title,
  onSwap,
  children,
}: {
  icon: ReactNode;
  title: string;
  onSwap?: () => void;
  children: ReactNode;
}) => (
  <div className="overflow-hidden rounded-2xl border border-border bg-background">
    <div className="space-y-2.5 p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[15px] font-bold text-muted-foreground">
          <span className="text-forest dark:text-glow" aria-hidden>
            {icon}
          </span>
          {title}
        </span>
        {onSwap && (
          <button
            type="button"
            onClick={onSwap}
            className="rounded-lg px-2 py-1 text-[13px] font-bold text-muted-foreground underline underline-offset-4 transition-colors hover:text-forest dark:hover:text-glow"
          >
            החלפה
          </button>
        )}
      </div>
      {children}
    </div>
  </div>
);

const Included = ({ children }: { children: ReactNode }) => (
  <p className="flex items-center gap-1.5 text-[15px] font-semibold text-forest dark:text-glow">
    <Check className="h-4 w-4 shrink-0" strokeWidth={3} aria-hidden />
    {children}
  </p>
);

const Leg = ({ label, leg }: { label: string; leg: FlightSegment }) => {
  const departure = dayjs(leg.departureTime);
  const arrival = dayjs(leg.arrivalTime);
  // Lands on a later calendar day (a night flight home): say so beside the time.
  const daysLater = arrival.startOf("day").diff(departure.startOf("day"), "day");
  return (
    <div className="flex items-baseline gap-3 text-[16px]">
      <span className="w-10 shrink-0 text-muted-foreground">{label}</span>
      {/* Each piece stays whole; on a narrow screen they wrap as units. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="whitespace-nowrap font-semibold">
          יום {WEEKDAYS[departure.day()]} {departure.format("DD/MM")}
        </span>
        <span className="whitespace-nowrap tabular-nums" dir="ltr">
          {departure.format("HH:mm")} → {arrival.format("HH:mm")}
          {daysLater > 0 && <sup className="ml-0.5 text-[11px]">+{daysLater}</sup>}
        </span>
        <span className="whitespace-nowrap text-[13px] text-muted-foreground" dir="ltr">
          {leg.departureAirport} → {leg.arrivalAirport}
        </span>
      </div>
    </div>
  );
};

/**
 * The order summary of a READY package ("חבילה מוכנה", lib/events/readyPackage.ts),
 * drawn in place of the plain Review: the event, a traveller picker, and one
 * card per piece - flight, hotel, ticket - each saying what is included. The
 * customer chooses nothing; a quiet "החלפה" on a card opens the regular step
 * for that piece and comes back here. Prices, the traveller form and payment
 * stay where the summary already has them.
 */
export const ReadyPackageShowcase = ({
  event,
  flight,
  hotel,
  eventTicket,
  travelers,
  airlineFullName,
  ready,
  onChangePax,
  onEdit,
}: {
  event: Event;
  /** Undefined = the package has no flight. */
  flight?: Flight;
  /** Undefined = the package has no hotel. */
  hotel?: OrderHotel;
  eventTicket: { category: string; zoneLabel?: string };
  travelers: number;
  airlineFullName?: string;
  ready: ReadyPackageState;
  onChangePax: (pax: number) => void;
  /** Opens a step (1 ticket / 2 flight / 3 hotel) to swap that piece; undefined = locked. */
  onEdit?: (step: 1 | 2 | 3) => void;
}) => {
  const fewer = neighbourPax(ready.paxOptions, travelers, -1);
  const more = neighbourPax(ready.paxOptions, travelers, 1);
  const sizes = ready.paxOptions;
  // Sizes with a hole in the middle (1, 2, 4) deserve a word: "+" jumps over it.
  const gapped = sizes.length > 1 && sizes[sizes.length - 1] - sizes[0] + 1 !== sizes.length;

  const nights = hotel ? Math.max(1, dayjs(hotel.checkout).diff(dayjs(hotel.checkin), "day")) : 0;
  const stars = Math.round(Number(hotel?.hotelInformation?.stars) || 0);
  const roomName = hotel
    ? hotel.isOffline
      ? hotel.hotelInformation?.roomName
      : hotel.rate?.room_data_trans?.main_name || hotel.hotelInformation?.roomName
    : "";
  const hasMeal = !!hotel?.rate?.meal_data?.has_breakfast;

  const checkedBag = !!flight && flight.outbound.checkBagsIncluded && flight.inbound.checkBagsIncluded;
  const cabinBag = !!flight && flight.outbound.cabinBagsIncluded && flight.inbound.cabinBagsIncluded;
  const bagKg = flight?.outbound.checkedBagKg;

  const stepButton =
    "flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-forest hover:text-forest disabled:opacity-35 disabled:hover:border-border disabled:hover:text-foreground dark:hover:border-glow dark:hover:text-glow";

  return (
    <section dir="rtl" className="space-y-4 px-4 py-5 text-right md:px-6" data-ready-package>
      <header className="space-y-1.5 text-center">
        <span className="inline-flex items-center rounded-full bg-forest/10 px-3 py-1 text-[13px] font-bold text-forest dark:bg-glow/15 dark:text-glow">
          חבילה מוכנה
        </span>
        <h2 className="text-2xl font-bold leading-tight md:text-3xl">{event.name}</h2>
        <p className="text-[16px] text-muted-foreground md:text-lg">
          {placeLine(event)} | {dayjs(event.date).format("DD/MM/YYYY")}
        </p>
        <p className="text-[15px]">בחרנו עבורכם טיסה, מלון וכרטיס. נשאר רק למלא פרטים ולהזמין.</p>
      </header>

      <div className="rounded-2xl border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-lg font-bold">כמה נוסעים?</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="פחות נוסעים"
              disabled={fewer == null || ready.loading}
              onClick={() => fewer != null && onChangePax(fewer)}
              className={stepButton}
            >
              <Minus className="h-5 w-5" aria-hidden />
            </button>
            <span
              className="flex min-w-[2.5ch] items-center justify-center text-2xl font-bold tabular-nums"
              aria-live="polite"
            >
              {ready.loading ? <Loader2 className="h-6 w-6 animate-spin" aria-label="מעדכן" /> : travelers}
            </span>
            <button
              type="button"
              aria-label="עוד נוסעים"
              disabled={more == null || ready.loading}
              onClick={() => more != null && onChangePax(more)}
              className={stepButton}
            >
              <Plus className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
        {gapped && (
          <p className="mt-2 text-[14px] text-muted-foreground">
            החבילה זמינה ל-{sizes.slice(0, -1).join(", ")} או {sizes[sizes.length - 1]} נוסעים. להרכב אחר דברו איתנו.
          </p>
        )}
        {ready.error && (
          <p role="alert" className="mt-2 text-[14px] font-semibold text-red-600 dark:text-red-400">
            {ready.error}
          </p>
        )}
      </div>

      <div className={cn("space-y-4 transition-opacity", ready.loading && "opacity-60")}>
        {flight ? (
          <Card icon={<Plane className="h-5 w-5" />} title="טיסה" onSwap={onEdit && (() => onEdit(2))}>
            <div className="flex items-center gap-2.5">
              {flight.metadata?.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={flight.metadata.logo} alt="" className="h-8 w-8 rounded object-contain" />
              )}
              <p className="text-lg font-bold">
                {airlineFullName || flight.metadata?.name || flight.airline}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {isDirect(flight.outbound) && isDirect(flight.inbound) ? "טיסה ישירה" : "עם עצירת ביניים"}
                </span>
              </p>
            </div>
            <div className="space-y-1">
              <Leg label="הלוך" leg={flight.outbound} />
              <Leg label="חזור" leg={flight.inbound} />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {checkedBag ? (
                <Included>מזוודה כלולה{bagKg ? ` (${bagKg} ק״ג)` : ""}</Included>
              ) : (
                <p className="text-[15px] text-muted-foreground">ללא מזוודה לבטן המטוס</p>
              )}
              {cabinBag && <Included>תיק יד כלול</Included>}
            </div>
          </Card>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-4 text-[15px] text-muted-foreground">
            החבילה הזו ללא טיסה.
          </p>
        )}

        {hotel ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-background">
            {ready.hotelImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ready.hotelImage}
                alt={hotel.name}
                className="h-44 w-full object-cover md:h-56"
                loading="lazy"
              />
            )}
            <div className="space-y-2.5 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[15px] font-bold text-muted-foreground">
                  <span className="text-forest dark:text-glow" aria-hidden>
                    <BedDouble className="h-5 w-5" />
                  </span>
                  מלון
                </span>
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(3)}
                    className="rounded-lg px-2 py-1 text-[13px] font-bold text-muted-foreground underline underline-offset-4 transition-colors hover:text-forest dark:hover:text-glow"
                  >
                    החלפה
                  </button>
                )}
              </div>
              <div>
                <p className="text-lg font-bold" dir="auto">
                  {hotel.name}
                </p>
                {stars > 0 && (
                  <p className="flex items-center gap-0.5 text-amber-500" aria-label={`${stars} כוכבים`}>
                    {Array.from({ length: stars }, (_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" aria-hidden />
                    ))}
                  </p>
                )}
              </div>
              <p className="text-[16px]">
                {nights} לילות ·{" "}
                <span className="tabular-nums" dir="ltr">
                  {dayjs(hotel.checkin).format("DD/MM")} – {dayjs(hotel.checkout).format("DD/MM")}
                </span>
              </p>
              {roomName && (
                <p className="text-[15px] text-muted-foreground" dir="auto">
                  {roomName}
                </p>
              )}
              {hasMeal ? (
                <Included>{mealPlanLabel(hotel.rate)}</Included>
              ) : (
                <p className="text-[15px] text-muted-foreground">{mealPlanLabel(hotel.rate)}</p>
              )}
            </div>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-4 text-[15px] text-muted-foreground">
            החבילה הזו ללא מלון.
          </p>
        )}

        <Card icon={<Ticket className="h-5 w-5" />} title="כרטיס לאירוע" onSwap={onEdit && (() => onEdit(1))}>
          <p className="text-lg font-bold">{eventTicket.zoneLabel || eventTicket.category}</p>
          <p className="text-[16px]">
            {travelers === 1 ? "כרטיס אחד" : `${travelers} כרטיסים`}
          </p>
        </Card>
      </div>

      <a
        href={PHONE_HREF}
        className="flex items-center justify-center gap-2 rounded-2xl border border-border py-3.5 text-[16px] font-bold transition-colors hover:border-forest hover:text-forest dark:hover:border-glow dark:hover:text-glow"
      >
        <Phone className="h-5 w-5" aria-hidden />
        מעדיפים לסגור בטלפון?{" "}
        <span dir="ltr" className="tabular-nums">
          {PHONE_LABEL}
        </span>
      </a>
    </section>
  );
};
