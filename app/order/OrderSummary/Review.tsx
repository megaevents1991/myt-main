import { Event, Flight, OrderHotel } from "@/lib/app.types";
import { isMobile } from "react-device-detect";
import { useMemo, useState } from "react";
import { Accordion } from "@mantine/core";
import { EventSummary } from "./EventSummary";
import { HotelSummary } from "./HotelSummary";
import { FlightSummary } from "./FlightSummary";
import dayjs from "dayjs";
import { cn } from "@/lib/utils";
import { FaPlane, FaTicketAlt, FaHotel } from "react-icons/fa";
import type { BreakfastUpgrade } from "../order-review.utils";
import type { BagPricingOptions } from "../hooks/useBagPricing";

export const Review = ({
  agentCommission,
  isAgent,
  hotelPriceAddition,
  totalGuests,
  numberOfEventTickets,
  eventTicket,
  selectedHotel,
  selectedFlight,
  airlineFullName,
  flightPriceAddition,
  eventTicketPriceAddition,
  event,
  skipHotel,
  flightSkipped,
  onEdit,
  breakfastUpgrade,
  onAddBreakfast,
  bagOptions,
  onToggleCheckedBag,
  onToggleCabinBag,
  showUpsells,
}: {
  agentCommission: number;
  /** Any signed agent code - commission may be 0. Falls back to commission>0. */
  isAgent?: boolean;
  hotelPriceAddition: number;
  totalGuests: number;
  numberOfEventTickets: number;
  selectedHotel: OrderHotel;
  eventTicket: {
    category: string;
    description?: string;
  };
  selectedFlight?: Flight;
  airlineFullName?: string;
  flightPriceAddition: number;
  eventTicketPriceAddition: number;
  event: Event;
  skipHotel?: boolean;
  flightSkipped?: boolean;
  /** Navigate back to an order step (1 ticket / 2 flight / 3 hotel) to modify. */
  onEdit?: (step: 1 | 2 | 3) => void;
  /** Included-info + paid upsells (breakfast rate-swap, baggage ancillary) -
   *  see OrderReview.tsx for how these are computed/wired. Every upsell prop
   *  is optional so Review keeps working wherever it's used without them. */
  breakfastUpgrade?: BreakfastUpgrade | null;
  onAddBreakfast?: () => void;
  bagOptions?: BagPricingOptions;
  onToggleCheckedBag?: () => void;
  onToggleCabinBag?: () => void;
  /** Interactive upsells only in the live, editable order flow - off on the
   *  hold-recovery/pay-link page (price already locked) and on an
   *  agent-locked prepared package. Included-info always shows regardless. */
  showUpsells?: boolean;
}) => {
  const items = useMemo(
    () => [
      {
        id: "event-summary",
        editStep: 1 as const,
        primary: `כרטיסים (${numberOfEventTickets})`,
        secondary: `קטגוריה: ${eventTicket.category}`,
        icon: <FaTicketAlt />,
        component: (
          <EventSummary
            key={"event-summary"}
            numberOfEventTickets={numberOfEventTickets}
            eventTicket={eventTicket}
            agentCommission={agentCommission}
            isAgent={isAgent}
            eventTicketPriceAddition={eventTicketPriceAddition}
          />
        ),
      },
      // Conditionally include hotel only if not skipped
      ...(!skipHotel && selectedHotel ? [{
        id: "hotel-summary",
        editStep: 3 as const,
        primary: `לינה (${selectedHotel.guests.reduce(
          (ppl, room) => ppl + room.children.length + room.adults,
          0
        )} אורחים)`,
        secondary: `${selectedHotel.name}`,
        icon: <FaHotel />,
        component: (
          <HotelSummary
            key={"hotel-summary"}
            selectedHotel={selectedHotel}
            agentCommission={agentCommission}
            isAgent={isAgent}
            hotelPriceAddition={hotelPriceAddition}
            totalGuests={totalGuests}
            breakfastUpgrade={breakfastUpgrade}
            showUpsells={showUpsells}
            onAddBreakfast={onAddBreakfast}
          />
        ),
      }] : []),
      // Conditionally include flight only if not skipped
      ...(!flightSkipped && selectedFlight ? [{
        id: "flight-summary",
        editStep: 2 as const,
        primary: `טיסה (${selectedFlight.numOfTravelers} נוסעים)`,
        secondary: airlineFullName || selectedFlight.airline,
        icon: <FaPlane />,
        component: (
          <FlightSummary
            key={"flight-summary"}
            agentCommission={agentCommission}
            isAgent={isAgent}
            airlineFullName={airlineFullName}
            flightPriceAddition={flightPriceAddition}
            selectedFlight={selectedFlight}
            bagOptions={bagOptions}
            showUpsells={showUpsells}
            onToggleCheckedBag={onToggleCheckedBag}
            onToggleCabinBag={onToggleCabinBag}
          />
        ),
      }] : []),
    ],
    [
      numberOfEventTickets,
      eventTicket,
      agentCommission,
      isAgent,
      eventTicketPriceAddition,
      selectedHotel,
      hotelPriceAddition,
      totalGuests,
      flightPriceAddition,
      airlineFullName,
      selectedFlight,
      skipHotel,
      flightSkipped,
      breakfastUpgrade,
      onAddBreakfast,
      bagOptions,
      showUpsells,
      onToggleCheckedBag,
      onToggleCabinBag,
    ]
  );

  // For mobile we control opened state to adjust font sizes & styles
  const [opened, setOpened] = useState<string[]>([]);

  // Skipped steps stay bookable - offer a compact "add it" row instead of
  // hiding them entirely (US events are sold without a hotel, so no hotel row).
  const isUS = event?.location?.country_code === "US";
  const addRows = onEdit
    ? [
        ...(flightSkipped
          ? [{ step: 2 as const, icon: <FaPlane />, text: "עדיין אפשר להזמין טיסה" }]
          : []),
        ...(skipHotel && !isUS
          ? [{ step: 3 as const, icon: <FaHotel />, text: "עדיין אפשר להזמין מלון" }]
          : []),
      ]
    : [];

  const addRowsBlock = addRows.length > 0 && (
    <div className="flex flex-col gap-2" dir="rtl">
      {addRows.map((r) => (
        <button
          key={r.step}
          type="button"
          onClick={() => onEdit?.(r.step)}
          className="flex items-center justify-between rounded-xl border border-dashed border-border px-3 py-2.5 text-right transition-colors hover:border-forest hover:bg-forest/5 dark:hover:border-glow dark:hover:bg-glow/10"
        >
          <span className="flex items-center gap-3">
            <span className="text-main dark:text-foreground text-[16px]" aria-hidden>
              {r.icon}
            </span>
            <span className="text-[14px] font-semibold text-muted-foreground">
              {r.text}
            </span>
          </span>
          <span className="rounded-lg border border-forest px-2.5 py-1 text-[12px] font-bold text-forest dark:border-glow dark:text-glow">
            + להוספה
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div className={cn("py-4 px-6 space-y-3 text-right", isMobile && "px-4")}>
      {isMobile ? (
        <>
          <div className="flex flex-row items-center w-full gap-2" dir="rtl">
            <div className="flex-1 flex justify-center px-1">
              <h2 className="text-2xl font-bold leading-tight text-center">{event.name}</h2>
            </div>
            <div className="shrink-0 text-center">
              <p className="text-md font-bold">{event.location.name}</p>
              <p className="text-sm">{dayjs(event.date).format("DD/MM/YYYY")}</p>
            </div>
          </div>
          <div className="h-1 border-b w-full " />
          <Accordion
            dir="rtl"
            multiple
            value={opened}
            onChange={setOpened}
            styles={{
              item: { borderBottom: "none" },
              label: { padding: "0" },
              control: { padding: "8px 0" },
            }}
          >
            {items.map((item) => {
              const isOpen = opened.includes(item.id);
              return (
                <Accordion.Item key={item.id} value={item.id}>
                  {/* Edit sits BESIDE the control (Accordion.Control renders a
                      <button>, so a nested button would be invalid HTML). */}
                  <div className="flex items-center gap-1" dir="rtl">
                    <Accordion.Control>
                      <div className="flex items-center gap-3 w-full text-right" dir="rtl">
                        <div className="text-main dark:text-foreground flex-shrink-0 text-[18px] flex items-center justify-center leading-none" aria-hidden>
                            {item.icon}
                          </div>
                        <div className="flex flex-col flex-1 gap-[2px]">
                          <div className="font-bold text-main dark:text-foreground text-[18px] leading-[18px]">{item.primary}</div>
                          <div
                            className={cn(
                              "text-[14px] text-[#5A6475] dark:text-muted-foreground", // grey secondary line
                              isOpen ? "" : ""
                            )}
                            dir={item.id === "hotel-summary" ? "ltr" : "rtl"}
                          >
                            {item.secondary}
                          </div>
                        </div>
                      </div>
                    </Accordion.Control>
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(item.editStep)}
                        aria-label={`עריכת ${item.primary}`}
                        className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-[12px] font-bold text-muted-foreground transition-colors hover:border-forest hover:text-forest dark:hover:border-glow dark:hover:text-glow"
                      >
                        עריכה
                      </button>
                    )}
                  </div>
                  <Accordion.Panel>
                    <div className="text-[14px] leading-[20px] space-y-2">
                      {item.component}
                    </div>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}
          </Accordion>
          {addRowsBlock}
        </>
      ) : (
        <>
          <div className="text-center">
            <div>
              <h2 className="text-2xl font-bold">{event.name}</h2>
            </div>
            <p className="text-lg">
              {event.location.name +
                " | " +
                dayjs(event.date).format("DD/MM/YYYY")}
            </p>
          </div>
          {items.map((item) => (
            <div key={item.id} className="relative">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(item.editStep)}
                  aria-label={`עריכת ${item.primary}`}
                  className="absolute left-0 top-0 rounded-lg border border-border px-2.5 py-1 text-[12px] font-bold text-muted-foreground transition-colors hover:border-forest hover:text-forest dark:hover:border-glow dark:hover:text-glow"
                >
                  עריכה
                </button>
              )}
              {item.component}
            </div>
          ))}
          {addRowsBlock}
        </>
      )}
    </div>
  );
};
