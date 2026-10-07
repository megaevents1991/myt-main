"use client";

import dayjs from "dayjs";
import {
  BedDouble,
  Check,
  Loader2,
  MapPin,
  Minus,
  Phone,
  Plane,
  Plus,
  Ticket,
  Users,
} from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { ReadyPackageState } from "@/app/app.context";
import { mealPlanLabel } from "@/app/order/order-review.utils";
import { TixstockDynamicMap } from "@/components/TixstockDynamicMap";
import { Amenities } from "@/components/ui/Amenities";
import { FlightMeta } from "@/components/ui/FlightCard";
import { Stars } from "@/components/ui/stars";
import type { Event, Flight, FlightSegment, OrderHotel } from "@/lib/app.types";
import { cityName, hasEventCity } from "@/lib/events/lodging";
import { neighbourPax, roomsLabel } from "@/lib/events/readyPackage";
import { eventTicketToListing } from "@/lib/tixstock-map";
import { cn } from "@/lib/utils";

const PHONE_HREF = "tel:+97237684800";
const PHONE_LABEL = "03-768-4800";
const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** "<event city> · טיסה ל<flight city>" on a two-city event, else the city (as the summary prints it). */
const placeLine = (event: Event) =>
  hasEventCity(event) && event.event_location
    ? `${cityName(event, "event")} · טיסה ל${cityName(event, "flight")}`
    : event.location.name;

const people = (count: number, one: string, many: string) =>
  count === 1 ? one : `${count} ${many}`;

/** How many of this piece the order holds - the same number the picker shows, beside every piece. */
const Count = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-forest/10 px-2.5 py-0.5 text-[13px] font-bold text-forest dark:bg-glow/15 dark:text-glow">
    <Users className="h-3.5 w-3.5" aria-hidden />
    {children}
  </span>
);

const Head = ({
  icon,
  title,
  count,
  onSwap,
}: {
  icon: ReactNode;
  title: string;
  count: ReactNode;
  onSwap?: () => void;
}) => (
  <div className="flex items-center justify-between gap-2">
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[15px] font-bold text-muted-foreground">
      <span className="flex items-center gap-2">
        <span className="text-forest dark:text-glow" aria-hidden>
          {icon}
        </span>
        {title}
      </span>
      <Count>{count}</Count>
    </span>
    {onSwap && (
      <button
        type="button"
        onClick={onSwap}
        className="shrink-0 rounded-lg px-2 py-1 text-[13px] font-bold text-muted-foreground underline underline-offset-4 transition-colors hover:text-forest dark:hover:text-glow"
      >
        החלפה
      </button>
    )}
  </div>
);

const Included = ({ children }: { children: ReactNode }) => (
  <p className="flex items-center gap-1.5 text-[15px] font-semibold text-forest dark:text-glow">
    <Check className="h-4 w-4 shrink-0" strokeWidth={3} aria-hidden />
    {children}
  </p>
);

/** One direction: which day, which flight, then the site's own times / duration / stops strip. */
const Leg = ({ label, leg }: { label: string; leg: FlightSegment }) => {
  const departure = dayjs(leg.departureTime);
  return (
    <div className="space-y-1.5">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[15px]">
        <span className="font-bold">{label}</span>
        <span className="whitespace-nowrap">
          יום {WEEKDAYS[departure.day()]} {departure.format("DD/MM/YYYY")}
        </span>
        {leg.flightNumber && (
          <span className="whitespace-nowrap text-[13px] tabular-nums text-muted-foreground" dir="ltr">
            {leg.flightNumber}
          </span>
        )}
        {leg.operatedBy && (
          <span className="text-[12px] text-muted-foreground">
            מופעל ע״י <span dir="ltr">{leg.operatedBy}</span>
          </span>
        )}
      </p>
      <FlightMeta {...leg} />
    </div>
  );
};

/**
 * The order summary of a READY package ("חבילה מוכנה", lib/events/readyPackage.ts),
 * drawn in place of the plain Review - the page the customer lands on. The event,
 * a traveller picker with the price it gives, and one card per piece - flight,
 * hotel, ticket - each saying how many it holds and what is included. The customer
 * chooses nothing; a quiet "החלפה" appears only on a piece the backoffice left
 * open, opens the regular step for that piece and comes back here. The traveller
 * form and payment stay where the summary already has them.
 */
export const ReadyPackageShowcase = ({
  event,
  flight,
  hotel,
  eventTicket,
  travelers,
  airlineFullName,
  ready,
  total,
  perPerson,
  onChangePax,
  onEdit,
}: {
  event: Event;
  /** Undefined = the package has no flight. */
  flight?: Flight;
  /** Undefined = the package has no hotel. */
  hotel?: OrderHotel;
  eventTicket: { id?: string; category: string; zoneLabel?: string };
  travelers: number;
  airlineFullName?: string;
  ready: ReadyPackageState;
  /** Whole order, USD, as the summary charges it; 0 while it is still being worked out. */
  total: number;
  /** Per traveller, USD. */
  perPerson: number;
  onChangePax: (pax: number) => void;
  /** Opens a step (1 ticket / 2 flight / 3 hotel) to swap that piece; undefined = nothing may be swapped. */
  onEdit?: (step: 1 | 2 | 3) => void;
}) => {
  const fewer = neighbourPax(ready.paxOptions, travelers, -1);
  const more = neighbourPax(ready.paxOptions, travelers, 1);
  const sizes = ready.paxOptions;
  // Sizes with a hole in the middle (1, 2, 4) deserve a word: "+" jumps over it.
  const gapped = sizes.length > 1 && sizes[sizes.length - 1] - sizes[0] + 1 !== sizes.length;

  const swapTicket = onEdit && ready.swap.ticket ? () => onEdit(1) : undefined;
  const swapFlight = onEdit && ready.swap.flight ? () => onEdit(2) : undefined;
  const swapHotel = onEdit && ready.swap.hotel ? () => onEdit(3) : undefined;

  const nights = hotel ? Math.max(1, dayjs(hotel.checkout).diff(dayjs(hotel.checkin), "day")) : 0;
  const stars = Math.round(Number(hotel?.hotelInformation?.stars) || 0);
  const roomName = hotel
    ? hotel.isOffline
      ? hotel.hotelInformation?.roomName
      : hotel.rate?.room_data_trans?.main_name || hotel.hotelInformation?.roomName
    : "";
  const hasMeal = !!hotel?.rate?.meal_data?.has_breakfast;
  const hotelGuests = (hotel?.guests ?? []).reduce(
    (sum, room) => sum + (room.adults || 0) + (room.children?.length ?? 0),
    0,
  );
  const rooms = roomsLabel(hotel?.guests);
  const distanceKm = Math.floor((Number(hotel?.hotelInformation?.distance) || 0) / 100) / 10;
  const amenities = hotel?.hotelInformation?.amenities ?? [];
  // The photo is of the PACKAGE's hotel - never drawn over a hotel swapped in.
  const hotelPhoto =
    hotel && ready.hotelImage && hotel.id === ready.hotelImageFor ? ready.hotelImage : null;

  const flightTravelers = flight?.numOfTravelers || travelers;
  const checkedBag = !!flight && flight.outbound.checkBagsIncluded && flight.inbound.checkBagsIncluded;
  const cabinBag = !!flight && flight.outbound.cabinBagsIncluded && flight.inbound.cabinBagsIncluded;
  const bagKg = flight?.outbound.checkedBagKg;

  // The order's ticket carries a name and an id; where it sits is on the event's own ticket.
  const ticket = useMemo(() => {
    const all = event.tickets_and_rates ?? [];
    return (
      all.find((t) => !!eventTicket.id && t.id === eventTicket.id) ??
      all.find((t) => t.category === eventTicket.category) ??
      null
    );
  }, [event.tickets_and_rates, eventTicket.id, eventTicket.category]);
  const ticketName = eventTicket.zoneLabel || ticket?.zoneLabel || eventTicket.category;
  // A TixStock drawing is an SVG the map can paint the ticket's own zone on; any other event has a picture.
  const mapListing = useMemo(
    () => (event.type === "tx_event" && ticket ? [eventTicketToListing(ticket)] : null),
    [event.type, ticket],
  );
  // Said only when the drawing really has a section for this ticket.
  const [zoneOnMap, setZoneOnMap] = useState(false);
  const mapTicketId = mapListing?.[0].id;
  const onMapMatched = useCallback(
    (ids: Set<string>) => setZoneOnMap(!!mapTicketId && ids.has(mapTicketId)),
    [mapTicketId],
  );

  const stepButton =
    "flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-forest hover:text-forest disabled:opacity-35 disabled:hover:border-border disabled:hover:text-foreground dark:hover:border-glow dark:hover:text-glow";
  const card = "overflow-hidden rounded-2xl border border-border bg-background";

  // Layout, by the room the package column really has (the page gives it the whole
  // screen - app/order/OrderReview.tsx): one column of cards on a phone and a tablet;
  // from 1360px the event sits beside the traveller picker and the hotel beside the
  // ticket, so a wide screen is used instead of scrolled. The flight's two legs sit
  // side by side from 768px.
  return (
    <section
      dir="rtl"
      className="space-y-4 px-4 py-5 text-right md:px-6 min-[1360px]:space-y-5 min-[1360px]:p-7"
      data-ready-package
    >
      <div className="grid gap-4 min-[1360px]:grid-cols-[minmax(0,1fr)_minmax(380px,460px)] min-[1360px]:items-center min-[1360px]:gap-8">
      <header className="space-y-1.5 text-center min-[1360px]:text-right">
        <span className="inline-flex items-center rounded-full bg-forest/10 px-3 py-1 text-[13px] font-bold text-forest dark:bg-glow/15 dark:text-glow">
          חבילה מוכנה
        </span>
        <h2 className="text-balance text-2xl font-bold leading-tight md:text-3xl min-[1360px]:text-[2rem]">{event.name}</h2>
        <p className="text-[16px] text-muted-foreground md:text-lg">
          {placeLine(event)} | {dayjs(event.date).format("DD/MM/YYYY")}
        </p>
        <p className="text-[15px]">בחרנו עבורכם טיסה, מלון וכרטיס. נשאר רק למלא פרטים ולהזמין.</p>
      </header>

      <div className={cn(card, "p-4")}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div>
            <span className="block text-lg font-bold">כמה נוסעים?</span>
            <span className="block text-[14px] text-muted-foreground">
              הטיסה, המלון והכרטיסים מתעדכנים למספר שתבחרו.
            </span>
          </div>
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
              data-ready-pax
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
        {total > 0 && (
          <p
            className={cn(
              "mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border pt-3 transition-opacity",
              ready.loading && "opacity-50",
            )}
            data-ready-price
          >
            <span className="text-[15px] text-muted-foreground">
              מחיר לאדם{" "}
              <span className="text-lg font-bold tabular-nums text-foreground" dir="ltr">
                ${perPerson.toLocaleString("en-US")}
              </span>
            </span>
            <span className="text-[15px] text-muted-foreground">
              סה״כ ל-{people(travelers, "נוסע אחד", "נוסעים")}{" "}
              <span className="text-lg font-bold tabular-nums text-foreground" dir="ltr">
                ${total.toLocaleString("en-US")}
              </span>
            </span>
          </p>
        )}
        {gapped && (
          <p className="mt-2 text-[14px] text-muted-foreground">
            החבילה זמינה ל-{sizes.slice(0, -1).join(", ")} או {sizes[sizes.length - 1]} נוסעים. להרכב אחר דברו איתנו.
          </p>
        )}
        {ready.notice && (
          <p role="status" className="mt-2 text-[14px] font-semibold text-amber-700 dark:text-amber-300" data-ready-notice>
            {ready.notice}
          </p>
        )}
        {ready.error && (
          <p role="alert" className="mt-2 text-[14px] font-semibold text-red-600 dark:text-red-400">
            {ready.error}
          </p>
        )}
      </div>
      </div>

      <div
        className={cn(
          "grid gap-4 transition-opacity min-[1360px]:grid-cols-2 min-[1360px]:gap-5",
          ready.loading && "opacity-60",
        )}
      >
        {flight ? (
          <div className={cn(card, "min-[1360px]:col-span-2")} data-ready-piece="flight">
            <div className="space-y-3 p-4 min-[1360px]:p-5">
              <Head
                icon={<Plane className="h-5 w-5" />}
                title="טיסה"
                count={people(flightTravelers, "נוסע אחד", "נוסעים")}
                onSwap={swapFlight}
              />
              {/* The airline and what the fare carries share one line when there is room. */}
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                <div className="flex items-center gap-2.5">
                  {flight.metadata?.logo && (
                    <span className="rounded-md dark:bg-white/95 dark:p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={flight.metadata.logo} alt="" className="h-9 w-9 object-contain" />
                    </span>
                  )}
                  <p className="text-lg font-bold">{airlineFullName || flight.metadata?.name || flight.airline}</p>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  {checkedBag ? (
                    <Included>מזוודה כלולה{bagKg ? ` (${bagKg} ק״ג)` : ""}</Included>
                  ) : (
                    <p className="text-[15px] text-muted-foreground">ללא מזוודה לבטן המטוס</p>
                  )}
                  {cabinBag && <Included>טרולי כלול</Included>}
                </div>
              </div>
              <div className="grid gap-3 rounded-xl bg-muted/40 p-3 md:grid-cols-2 md:gap-0 md:p-4">
                <div className="md:pe-5">
                  <Leg label="הלוך" leg={flight.outbound} />
                </div>
                <div className="border-t border-border pt-3 md:border-s md:border-t-0 md:ps-5 md:pt-0">
                  <Leg label="חזור" leg={flight.inbound} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-4 text-[15px] text-muted-foreground min-[1360px]:col-span-2">
            החבילה הזו ללא טיסה.
          </p>
        )}

        {hotel ? (
          <div className={cn(card, "md:flex min-[1360px]:flex-col")} data-ready-piece="hotel">
            {hotelPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hotelPhoto}
                alt={hotel.name}
                // Wide screen: the photo is the top of the card and takes the height the
                // ticket card beside it sets - the text below never floats over an empty band.
                className="h-44 w-full object-cover md:h-auto md:min-h-[220px] md:w-[38%] md:shrink-0 min-[1360px]:min-h-[240px] min-[1360px]:w-full min-[1360px]:flex-1 min-[1360px]:shrink"
                loading="lazy"
              />
            )}
            <div className="min-w-0 flex-1 space-y-2.5 p-4 min-[1360px]:flex-none min-[1360px]:p-5">
              <Head
                icon={<BedDouble className="h-5 w-5" />}
                title="מלון"
                count={people(hotelGuests || travelers, "אורח אחד", "אורחים")}
                onSwap={swapHotel}
              />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-lg font-bold" dir="auto">
                    {hotel.name}
                  </p>
                  {stars > 0 && (
                    <span aria-label={`${stars} כוכבים`}>
                      <Stars rating={stars} />
                    </span>
                  )}
                </div>
                {distanceKm > 0 && (
                  <p className="flex items-center gap-1 text-[14px] text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                    {distanceKm} ק״מ ממרכז העיר
                  </p>
                )}
              </div>
              <p className="text-[16px]">
                {people(nights, "לילה אחד", "לילות")} ·{" "}
                <span className="tabular-nums" dir="ltr">
                  {dayjs(hotel.checkin).format("DD/MM")} – {dayjs(hotel.checkout).format("DD/MM")}
                </span>
              </p>
              {(rooms || roomName) && (
                <p className="text-[15px]" data-ready-rooms>
                  {rooms && <span className="font-bold">{rooms}</span>}
                  {rooms && roomName && <span className="text-muted-foreground"> · </span>}
                  {roomName && (
                    <span className="text-muted-foreground" dir="auto">
                      {roomName}
                    </span>
                  )}
                </p>
              )}
              {hasMeal ? (
                <Included>{mealPlanLabel(hotel.rate)}</Included>
              ) : (
                <p className="text-[15px] text-muted-foreground">{mealPlanLabel(hotel.rate)}</p>
              )}
              {amenities.length > 0 && (
                <div>
                  <Amenities roomAmenities={[]} hotelAmenities={amenities} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-4 text-[15px] text-muted-foreground">
            החבילה הזו ללא מלון.
          </p>
        )}

        <div
          className={cn(card, "md:flex md:items-stretch min-[1360px]:flex-col", !hotel && "min-[1360px]:col-span-2")}
          data-ready-piece="ticket"
        >
          {event.map_image_url && (
            // Beside the text on a medium screen; on a wide one it is the top of the card and
            // takes whatever height the hotel card next to it leaves - no empty band under the text.
            <div className="flex items-center justify-center border-b border-border bg-muted/30 p-3 md:w-[40%] md:shrink-0 md:border-b-0 md:border-l xl:w-[32%] min-[1360px]:w-full min-[1360px]:flex-1 min-[1360px]:border-b min-[1360px]:border-l-0 min-[1360px]:p-4">
              <div className="w-full min-[1360px]:max-w-[380px]">
              {mapListing ? (
                <TixstockDynamicMap
                  mapUrl={event.map_image_url}
                  tickets={mapListing}
                  hoveredTicket={null}
                  selectedTicketId={mapListing[0].id}
                  onMatchedTicketIds={onMapMatched}
                  excludedSections={event.tx_excluded_sections}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.map_image_url}
                  alt="מפת המקום"
                  className="mx-auto max-h-64 w-full rounded-lg object-contain"
                  loading="lazy"
                />
              )}
              </div>
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2.5 p-4 md:flex md:flex-col md:justify-center md:space-y-0 md:gap-2.5 min-[1360px]:flex-none min-[1360px]:p-5">
            <Head
              icon={<Ticket className="h-5 w-5" />}
              title="כרטיס לאירוע"
              count={people(travelers, "כרטיס אחד", "כרטיסים")}
              onSwap={swapTicket}
            />
            <p className="text-lg font-bold">{ticketName}</p>
            {ticket?.description && ticket.description !== ticketName && (
              <p className="text-[15px] text-muted-foreground">{ticket.description}</p>
            )}
            {zoneOnMap && (
              <p className="text-[14px] text-muted-foreground">האזור שלכם מסומן במפה.</p>
            )}
          </div>
        </div>
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
