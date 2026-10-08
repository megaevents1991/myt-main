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
import type { BagPricingOptions, FareUpgradeOption } from "@/app/order/hooks/useBagPricing";
import { ClassicUpgradeInfo, isClassic, upgradeLabel } from "@/app/order/OrderSummary/FlightSummary";
import {
  addedCheckedBagsCount,
  mealPlanLabel,
  type BreakfastUpgrade,
} from "@/app/order/order-review.utils";
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

const Money = ({ amount }: { amount: number }) => (
  <span className="tabular-nums" dir="ltr">
    +${Math.ceil(amount).toLocaleString("en-US")}
  </span>
);

/**
 * A paid extra on one piece - a suitcase, breakfast: the summary's own add-ons
 * (FlightSummary / HotelSummary), drawn to this page's scale. Not on the order: a
 * dashed row that adds it, with what it costs. On the order: a confirmed row with
 * the sum it added and, where it can be undone, "הסרה".
 */
const Extra = ({
  label,
  cost,
  info,
  added,
  onAdd,
  onRemove,
}: {
  label: string;
  /** What adding it costs or, once added, what it added. */
  cost: ReactNode;
  /** A small "what is this" control after the label. */
  info?: ReactNode;
  added?: boolean;
  onAdd?: () => void;
  onRemove?: () => void;
}) =>
  added ? (
    <div
      className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 rounded-xl border border-forest/40 bg-forest/5 px-3.5 py-1.5 text-[15px] dark:border-glow/40 dark:bg-glow/10"
      data-ready-extra="added"
    >
      <span className="flex flex-wrap items-center gap-x-1.5 font-bold text-forest dark:text-glow">
        <Check className="h-4 w-4 shrink-0" strokeWidth={3} aria-hidden />
        {label}
        {info}
        {cost}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="-me-2 shrink-0 rounded-lg px-2 py-2 text-[14px] font-semibold text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          הסרה
        </button>
      )}
    </div>
  ) : (
    // The whole row adds it (the button's ::after covers the row); an info control sits above that.
    <div
      className="relative flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-xl border border-dashed border-forest/45 px-3.5 py-1.5 text-[15px] transition-colors hover:border-forest hover:bg-forest/5 dark:border-glow/45 dark:hover:border-glow dark:hover:bg-glow/10"
      data-ready-extra="offer"
    >
      <span className="flex items-center gap-1.5">
        <Plus className="h-4 w-4 shrink-0 text-forest dark:text-glow" strokeWidth={3} aria-hidden />
        <button
          type="button"
          onClick={onAdd}
          className="text-start font-bold after:absolute after:inset-0 after:content-['']"
        >
          {label}
        </button>
        {info}
      </span>
      <span className="font-semibold text-muted-foreground">{cost}</span>
    </div>
  );

/**
 * The summary's paid add-ons, offered on the package's own cards. Undefined =
 * nothing new may be added; what is already on the order is still shown.
 */
export type ReadyExtras = {
  bagOptions: BagPricingOptions;
  fareUpgrade: FareUpgradeOption;
  breakfastUpgrade: BreakfastUpgrade | null;
  /** A suitcase for every traveller - as a fare upgrade where the airline sells it that way. */
  onAddBag: () => void;
  onRemoveBag: () => void;
  onToggleTrolley: () => void;
  onAddBreakfast: () => void;
  onRemoveBreakfast: () => void;
};

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

const STEP_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-forest hover:text-forest disabled:opacity-35 disabled:hover:border-border disabled:hover:text-foreground dark:hover:border-glow dark:hover:text-glow";
const CARD = "overflow-hidden rounded-2xl border border-border bg-background";
// One piece of the package = what it says, then what it shows - the flight's times,
// the hotel's photo, the seat map - in that order on every card and every screen
// (Dor 08.10). From 1360px the two parts are two rows of the grid the pieces share,
// so the texts start on one line and the pictures stand on another, one height,
// however long each text is.
const PIECE =
  "min-[1360px]:row-span-2 min-[1360px]:grid min-[1360px]:grid-cols-1 min-[1360px]:grid-rows-subgrid min-[1360px]:gap-y-0";
const PIECE_TEXT = "flex min-w-0 flex-col gap-2.5 p-4 min-[1360px]:p-5";
const PIECE_SHOW = "p-4 pt-0 min-[1360px]:p-5 min-[1360px]:pt-0";
// 768-1360px: the hotel and the ticket set the two parts side by side, text first.
const SHOW_BESIDE =
  "md:shrink-0 md:ps-0 md:pt-4 min-[1360px]:w-auto min-[1360px]:ps-5 min-[1360px]:pt-0";
const SHOW_PANEL = "rounded-xl bg-muted/40";

/**
 * How many travel, and the price that gives - per person and for everyone. The ONE
 * place the package's price is printed (a second total beside the pay button read
 * as a second price, Alon 08.10). Its "+" and "-" walk the party sizes the package
 * is priced for; the flight, the hotel, the tickets and the travellers' form follow.
 */
export const ReadyPaxPicker = ({
  ready,
  travelers,
  total,
  perPerson,
  addOnsUsd = 0,
  onChangePax,
  className,
}: {
  ready: ReadyPackageState;
  travelers: number;
  /** Whole order, USD, as the summary charges it; 0 while it is still being worked out. */
  total: number;
  /** Per traveller, USD. */
  perPerson: number;
  /** Suitcases the customer added, USD - inside the total, outside the price per person. */
  addOnsUsd?: number;
  onChangePax: (pax: number) => void;
  className?: string;
}) => {
  const fewer = neighbourPax(ready.paxOptions, travelers, -1);
  const more = neighbourPax(ready.paxOptions, travelers, 1);
  const sizes = ready.paxOptions;
  // Sizes with a hole in the middle (1, 2, 4) deserve a word: "+" jumps over it.
  const gapped = sizes.length > 1 && sizes[sizes.length - 1] - sizes[0] + 1 !== sizes.length;

  return (
    <div className={cn(CARD, "p-4", className)}>
      <div className="flex items-center justify-between gap-4">
        <span className="text-lg font-bold">כמה נוסעים?</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="פחות נוסעים"
            disabled={fewer == null || ready.loading}
            onClick={() => fewer != null && onChangePax(fewer)}
            className={STEP_BUTTON}
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
            className={STEP_BUTTON}
          >
            <Plus className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
      <p className="mt-1.5 text-[14px] text-muted-foreground">
        הטיסה, המלון והכרטיסים מתעדכנים למספר שתבחרו.
      </p>
      {total > 0 && (
        // The total is what is paid, so it is the figure that leads; the price per
        // person - the one the site quotes everywhere else - stands beside it.
        <p
          className={cn(
            "mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-t border-border pt-3 transition-opacity",
            ready.loading && "opacity-50",
          )}
          data-ready-price
        >
          <span className="flex flex-col items-start">
            <span className="text-[15px] text-muted-foreground">
              סה״כ ל-{people(travelers, "נוסע אחד", "נוסעים")}
            </span>
            <span className="text-[1.75rem] font-bold leading-tight tabular-nums" dir="ltr">
              ${total.toLocaleString("en-US")}
            </span>
          </span>
          <span className="pb-1 text-[15px] text-muted-foreground">
            מחיר לאדם{" "}
            <span className="text-lg font-bold tabular-nums text-foreground" dir="ltr">
              ${perPerson.toLocaleString("en-US")}
            </span>
          </span>
        </p>
      )}
      {total > 0 && addOnsUsd > 0 && (
        // Suitcases are for the order, not per person - so the total is more than
        // the price per person times the party, and this line says why.
        <p className="mt-1 text-[14px] text-muted-foreground" data-ready-addons>
          הסה״כ כולל מזוודות שהוספתם:{" "}
          <span className="font-semibold tabular-nums text-foreground" dir="ltr">
            ${Math.ceil(addOnsUsd).toLocaleString("en-US")}
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
  );
};

/**
 * The order summary of a READY package (lib/events/readyPackage.ts), drawn in place
 * of the plain Review - the page the customer lands on. The event, a traveller
 * picker with the price it gives, and one card per piece - flight, hotel, ticket -
 * each saying how many it holds and what is included, then showing it. The customer
 * chooses nothing; a quiet "החלפה" appears only on a piece the backoffice left
 * open, opens the regular step for that piece and comes back here. What the regular
 * summary sells on top - a suitcase, breakfast - is offered on the piece it belongs
 * to. The traveller form and payment stay where the summary already has them.
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
  addOnsUsd,
  onChangePax,
  onEdit,
  headerAside,
  extras,
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
  /** Suitcases the customer added, USD (the picker names them under the total). */
  addOnsUsd?: number;
  onChangePax: (pax: number) => void;
  /** Opens a step (1 ticket / 2 flight / 3 hotel) to swap that piece; undefined = nothing may be swapped. */
  onEdit?: (step: 1 | 2 | 3) => void;
  /** Printed at the far end of the header from 1024px (the summary's terms link). */
  headerAside?: ReactNode;
  extras?: ReadyExtras;
}) => {
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
  const breakfastAdded = hotel?.breakfast_upgrade;
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
  const addedBags = flight?.added_bags;
  const bagsAdded = flight ? addedCheckedBagsCount(addedBags, flightTravelers) : 0;
  const fareUp = flight?.fare_upgrade;
  // A bag's price covers the whole trip, so a round trip says so ("$80 למזוודה" read as one way).
  const perBag = (flight?.offer?.itineraries?.length ?? 0) > 1 ? "למזוודה הלוך-חזור" : "למזוודה";

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

  // Layout, by the room the package column really has (the page gives it the whole
  // screen - app/order/OrderReview.tsx): one column of cards on a phone and a tablet;
  // the traveller picker opens the package there and moves to the summary's narrow
  // column from 1024px; from 1360px the hotel sits beside the ticket; from 1536px the
  // three pieces stand in one row - flight, hotel, ticket - so the whole package is on
  // screen at once. Every card reads the same way: what the piece is, then what it
  // looks like (PIECE above).
  return (
    <section
      dir="rtl"
      className="space-y-4 px-4 py-5 text-right md:px-6 min-[1360px]:space-y-5 min-[1360px]:p-7"
      data-ready-package
    >
      <div className="grid gap-4">
        <div className="lg:flex lg:items-start lg:justify-between lg:gap-6">
          <header className="space-y-1.5 text-center lg:text-right">
            <h2 className="text-balance text-2xl font-bold leading-tight md:text-3xl min-[1360px]:text-[2rem]">{event.name}</h2>
            <p className="text-[16px] text-muted-foreground md:text-lg">
              {placeLine(event)} | {dayjs(event.date).format("DD/MM/YYYY")}
            </p>
            <p className="text-[15px]">בחרנו עבורכם טיסה, מלון וכרטיס. נשאר רק למלא פרטים ולהזמין.</p>
          </header>
          {headerAside && <div className="hidden shrink-0 pt-1 lg:block">{headerAside}</div>}
        </div>
        {/* Phone and tablet: the picker opens the package. From 1024px the summary
            prints it at the top of its narrow column, above the travellers' form. */}
        <ReadyPaxPicker
          className="lg:hidden"
          ready={ready}
          travelers={travelers}
          total={total}
          perPerson={perPerson}
          addOnsUsd={addOnsUsd}
          onChangePax={onChangePax}
        />
      </div>

      <div
        className={cn(
          "grid gap-4 transition-opacity min-[1360px]:grid-cols-2 min-[1360px]:gap-5 min-[1536px]:grid-cols-3",
          ready.loading && "opacity-60",
        )}
      >
        {flight ? (
          <div
            className={cn(CARD, PIECE, "min-[1360px]:col-span-2 min-[1536px]:col-span-1")}
            data-ready-piece="flight"
          >
            <div className={PIECE_TEXT}>
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
                  {/* A suitcase the customer added is said by its own row below, not here. */}
                  {checkedBag && !fareUp ? (
                    <Included>מזוודה כלולה{bagKg ? ` (${bagKg} ק״ג)` : ""}</Included>
                  ) : !checkedBag && bagsAdded === 0 ? (
                    <p className="text-[15px] text-muted-foreground">ללא מזוודה לבטן המטוס</p>
                  ) : null}
                  {cabinBag && <Included>טרולי כלול</Included>}
                </div>
              </div>
              {/* The suitcase: the airline's fare upgrade where it sells one (El Al),
                  else a bag for every traveller at the airline's own price for this flight. */}
              {fareUp ? (
                <Extra
                  added
                  label={`${upgradeLabel(fareUp.brand)} (כולל מזוודה)`}
                  info={isClassic(fareUp.brand) ? <ClassicUpgradeInfo /> : undefined}
                  cost={<Money amount={fareUp.delta_total_usd} />}
                  onRemove={extras && fareUp.prev_price != null ? extras.onRemoveBag : undefined}
                />
              ) : bagsAdded > 0 ? (
                <Extra
                  added
                  label={`מזוודות (${bagsAdded})`}
                  cost={<Money amount={addedBags?.total_usd || 0} />}
                  onRemove={extras?.onRemoveBag}
                />
              ) : checkedBag || !extras ? null : extras.fareUpgrade ? (
                <Extra
                  label={upgradeLabel(extras.fareUpgrade.brand)}
                  info={isClassic(extras.fareUpgrade.brand) ? <ClassicUpgradeInfo /> : undefined}
                  cost={
                    <>
                      <Money amount={extras.fareUpgrade.deltaPerPaxUsd} /> לנוסע
                    </>
                  }
                  onAdd={extras.onAddBag}
                />
              ) : extras.bagOptions?.checked ? (
                <Extra
                  label="הוסף מזוודה לכל נוסע"
                  cost={
                    <>
                      <Money amount={extras.bagOptions.checked.unitPriceUsd} /> {perBag}
                    </>
                  }
                  onAdd={extras.onAddBag}
                />
              ) : null}
              {addedBags?.cabin ? (
                <Extra
                  added
                  label={`טרולים (${addedBags.cabin.qty_per_pax * flightTravelers})`}
                  cost={<Money amount={addedBags.cabin.total_usd || 0} />}
                  onRemove={extras?.onToggleTrolley}
                />
              ) : !cabinBag && extras?.bagOptions?.cabin ? (
                <Extra
                  label="הוסף טרולי לכל נוסע"
                  cost={<Money amount={extras.bagOptions.cabin.unitPriceUsd * flightTravelers} />}
                  onAdd={extras.onToggleTrolley}
                />
              ) : null}
            </div>
            <div className={PIECE_SHOW}>
              {/* Side by side from 768px; in the three-in-a-row layout the legs stack
                  and share the height of the row of pictures. */}
              <div
                className={cn(
                  SHOW_PANEL,
                  "grid h-full gap-3 p-3 md:grid-cols-2 md:gap-0 md:p-4 min-[1536px]:flex min-[1536px]:flex-col min-[1536px]:justify-around min-[1536px]:gap-4",
                )}
              >
                <div className="md:pe-5 min-[1536px]:pe-0">
                  <Leg label="הלוך" leg={flight.outbound} />
                </div>
                <div className="border-t border-border pt-3 md:border-s md:border-t-0 md:ps-5 md:pt-0 min-[1536px]:border-s-0 min-[1536px]:border-t min-[1536px]:ps-0 min-[1536px]:pt-4">
                  <Leg label="חזור" leg={flight.inbound} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-4 text-[15px] text-muted-foreground min-[1360px]:col-span-2 min-[1360px]:row-span-2 min-[1536px]:col-span-1">
            החבילה הזו ללא טיסה.
          </p>
        )}

        {hotel ? (
          <div className={cn(CARD, PIECE, "md:flex")} data-ready-piece="hotel">
            <div className={cn(PIECE_TEXT, "md:flex-1")}>
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
              {breakfastAdded ? (
                <Extra
                  added
                  label="ארוחת בוקר נוספה"
                  cost={breakfastAdded.delta_usd > 0 ? <Money amount={breakfastAdded.delta_usd} /> : "חינם"}
                  onRemove={extras && breakfastAdded.prev_rate ? extras.onRemoveBreakfast : undefined}
                />
              ) : hasMeal ? (
                <Included>{mealPlanLabel(hotel.rate)}</Included>
              ) : (
                <>
                  <p className="text-[15px] text-muted-foreground">{mealPlanLabel(hotel.rate)}</p>
                  {/* The same room's breakfast rate, when the hotel search behind this page has one. */}
                  {extras?.breakfastUpgrade && (
                    <Extra
                      label="הוסף ארוחת בוקר"
                      cost={
                        extras.breakfastUpgrade.deltaUsd > 0 ? (
                          <>
                            <Money amount={extras.breakfastUpgrade.deltaUsd} /> לכל השהות
                          </>
                        ) : (
                          "חינם"
                        )
                      }
                      onAdd={extras.onAddBreakfast}
                    />
                  )}
                </>
              )}
              {amenities.length > 0 && (
                <div>
                  <Amenities roomAmenities={[]} hotelAmenities={amenities} />
                </div>
              )}
            </div>
            {hotelPhoto && (
              <div className={cn(PIECE_SHOW, SHOW_BESIDE, "md:w-[38%]")}>
                {/* The photo fills its part and never sets its height: the text beside it,
                    or the row of pictures, does (a photo that grew with the row made the
                    cards a screen tall). */}
                <div className="relative h-44 overflow-hidden rounded-xl md:h-full md:min-h-[200px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={hotelPhoto}
                    alt={hotel.name}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-4 text-[15px] text-muted-foreground min-[1360px]:row-span-2">
            החבילה הזו ללא מלון.
          </p>
        )}

        <div
          className={cn(
            CARD,
            PIECE,
            "md:flex",
            !hotel && "min-[1360px]:col-span-2 min-[1536px]:col-span-1",
          )}
          data-ready-piece="ticket"
        >
          <div className={cn(PIECE_TEXT, "md:flex-1")}>
            <Head
              icon={<Ticket className="h-5 w-5" />}
              title="כרטיס"
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
          {event.map_image_url && (
            <div className={cn(PIECE_SHOW, SHOW_BESIDE, "md:w-[40%] xl:w-[32%]")}>
              <div className={cn(SHOW_PANEL, "flex h-full items-center justify-center p-3 min-[1360px]:p-4")}>
                <div className="w-full max-w-[300px] min-[1360px]:max-w-[260px]">
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
            </div>
          )}
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
