import { Event, Flight, OrderHotel, OrderTicket } from "@/lib/app.types";
import { isMobile } from "react-device-detect";
import { useMemo, useState } from "react";
import { Accordion } from "@mantine/core";
import { EventSummary } from "./EventSummary";
import { HotelSummary } from "./HotelSummary";
import { FlightSummary } from "./FlightSummary";
import dayjs from "dayjs";
import { cn } from "@/lib/utils";
import { FaPlane, FaTicketAlt, FaHotel } from "react-icons/fa";
import { MONDIAL_2026_MAIN_TITLE, parseMondial2026EventName } from "@/lib/mondial2026Title";

export const Review = ({
  agentCommission,
  hotelPriceAddition,
  totalGuests,
  numberOfEventTickets,
  eventTicket,
  selectedEvents,
  selectedEventTickets,
  selectedHotel,
  selectedFlight,
  airlineFullName,
  flightPriceAddition,
  eventTicketPriceAddition,
  event,
  skipHotel,
  flightSkipped,
}: {
  agentCommission: number;
  hotelPriceAddition: number;
  totalGuests: number;
  numberOfEventTickets: number;
  selectedHotel: OrderHotel;
  eventTicket: {
    category: string;
    description?: string;
  };
  selectedEvents?: Event[];
  selectedEventTickets?: Record<number, OrderTicket>;
  selectedFlight?: Flight;
  airlineFullName?: string;
  flightPriceAddition: number;
  eventTicketPriceAddition: number;
  event: Event;
  skipHotel?: boolean;
  flightSkipped?: boolean;
}) => {
  const mondialParsed = useMemo(() => parseMondial2026EventName(event?.name), [event?.name]);

  const effectiveEvents = useMemo<Event[]>(
    () => (selectedEvents && selectedEvents.length > 0 ? selectedEvents : [event]),
    [selectedEvents, event]
  );
  const isBundle = effectiveEvents.length > 1;

  const minTicketPriceForEvent = (evt: Event): number => {
    const rates = (evt.tickets_and_rates || []).filter((t) => t?.available !== false);
    if (rates.length === 0) return 0;
    return Math.min(...rates.map((t) => t.price));
  };

  const ticketLines = useMemo(() => {
    return effectiveEvents
      .map((evt) => {
        const parsed = parseMondial2026EventName(evt?.name);
        const label = parsed.isMondial2026 ? (parsed.teamsTitle || evt.name) : evt.name;

        const locationText = evt?.location?.name || "";
        const dateText = evt?.date ? dayjs(evt.date).format("DD/MM/YYYY") : "";

        const ticket = selectedEventTickets?.[evt.id];
        const quantity = ticket?.quantity;
        return {
          eventId: evt.id,
          label,
          dateText,
          locationText,
          category: ticket?.category,
          description: ticket?.description,
          price: ticket?.price,
          minPrice: minTicketPriceForEvent(evt),
          quantity,
        };
      })
      .filter((l) => typeof l.label === "string" && l.label.length > 0);
  }, [effectiveEvents, selectedEventTickets]);

  const totalTickets = useMemo(() => {
    if (!isBundle) return numberOfEventTickets;
    return ticketLines.reduce((sum, l) => sum + (l.quantity ?? numberOfEventTickets), 0);
  }, [isBundle, ticketLines, numberOfEventTickets]);

  // For bundles, compute combined TOTAL ticket addition across all events and quantities.
  // For single event, keep the existing per-ticket addition passed from useOrderVars.
  const ticketPriceAdditionTotal = useMemo(() => {
    if (!isBundle) return eventTicketPriceAddition;
    return ticketLines.reduce((sum, l) => {
      const chosen = typeof l.price === "number" ? l.price : l.minPrice;
      const qty = l.quantity ?? numberOfEventTickets;
      return sum + (chosen - l.minPrice) * qty;
    }, 0);
  }, [isBundle, ticketLines, eventTicketPriceAddition, numberOfEventTickets]);

  const items = useMemo(
    () => [
      {
        id: "event-summary",
        primary: `כרטיסים (${totalTickets} כרטיסים)`,
        secondary: isBundle
          ? (
              <div className="text-[14px] text-[#5A6475] whitespace-pre-line" dir="rtl">
                {ticketLines.map((l) => (
                  <div key={l.eventId}>
                    {l.label}
                  </div>
                ))}
              </div>
            )
          : mondialParsed.isMondial2026
            ? mondialParsed.teamsTitle || MONDIAL_2026_MAIN_TITLE
            : event.name,
        icon: <FaTicketAlt />,
        component: (
          <EventSummary
            key={"event-summary"}
            eventTitle={
              mondialParsed.isMondial2026 && !isBundle ? MONDIAL_2026_MAIN_TITLE : undefined
            }
            eventSubtitle={
              mondialParsed.isMondial2026 && !isBundle ? mondialParsed.teamsTitle : undefined
            }
            numberOfEventTickets={numberOfEventTickets}
            totalTickets={totalTickets}
            eventTicket={eventTicket}
            agentCommission={agentCommission}
            eventTicketPriceAddition={ticketPriceAdditionTotal}
            isBundle={isBundle}
            bundleLines={
              isBundle
                ? ticketLines.map((l) => ({
                    label: l.label,
                    category: l.category,
                    locationText: l.locationText,
                    dateText: l.dateText,
                    quantity: l.quantity ?? numberOfEventTickets,
                  }))
                : undefined
            }
          />
        ),
      },
      // Conditionally include hotel only if not skipped
      ...(!skipHotel && selectedHotel ? [{
        id: "hotel-summary",
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
            hotelPriceAddition={hotelPriceAddition}
            totalGuests={totalGuests}
          />
        ),
      }] : []),
      ...(!flightSkipped && selectedFlight ? [{
        id: "flight-summary",
        primary: `טיסה (${selectedFlight.numOfTravelers} נוסעים)` ,
        secondary: airlineFullName || selectedFlight.airline,
        icon: <FaPlane />,
        component: (
          <FlightSummary
            key={"flight-summary"}
            agentCommission={agentCommission}
            airlineFullName={airlineFullName}
            flightPriceAddition={flightPriceAddition}
            selectedFlight={selectedFlight}
          />
        ),
      }] : []),
    ],
    [
      mondialParsed.isMondial2026,
      mondialParsed.teamsTitle,
      event.name,
      numberOfEventTickets,
      eventTicket,
      agentCommission,
      ticketPriceAdditionTotal,
      selectedHotel,
      hotelPriceAddition,
      totalGuests,
      flightPriceAddition,
      airlineFullName,
      selectedFlight,
      skipHotel,
      isBundle,
      ticketLines,
      totalTickets,
      flightSkipped,
    ]
  );

  // For mobile we control opened state to adjust font sizes & styles
  const [opened, setOpened] = useState<string[]>([]);

  return (
    <div className={cn("py-4 px-6 space-y-3 text-right", isMobile && "px-4")}>
      {isMobile ? (
        <>
          <div className="flex flex-row items-center w-full gap-2" dir="rtl">
            <div className="flex-1 flex justify-center px-1">
              <div className="text-center">
                <h2 className="text-2xl font-bold leading-tight">
                  {mondialParsed.isMondial2026 ? MONDIAL_2026_MAIN_TITLE : event.name}
                </h2>
                {mondialParsed.isMondial2026 && mondialParsed.teamsTitle && !isBundle ? (
                  <div className="text-sm font-semibold text-muted-foreground leading-tight">
                    {mondialParsed.teamsTitle}
                  </div>
                ) : null}
              </div>
            </div>
            {!isBundle ? (
              <div className="shrink-0 text-center">
                <p className="text-md font-bold">{event.location.name}</p>
                <p className="text-sm">{dayjs(event.date).format("DD/MM/YYYY")}</p>
              </div>
            ) : null}
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
                  <Accordion.Control>
                    <div className="flex items-center gap-3 w-full text-right" dir="rtl">
                      <div className="text-main flex-shrink-0 text-[18px] flex items-center justify-center leading-none" aria-hidden>
                          {item.icon}
                        </div>
                      <div className="flex flex-col flex-1 gap-[2px]">
                        <div className="font-bold text-main text-[18px] leading-[18px]">{item.primary}</div>
                        <div
                          className={cn(
                            "text-[14px] text-[#5A6475]", // grey secondary line
                            isOpen ? "" : ""
                          )}
                          dir={item.id === "hotel-summary" ? "ltr" : "rtl"}
                        >
                          {item.secondary}
                        </div>
                      </div>
                    </div>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <div className="text-[14px] leading-[20px] space-y-2">
                      {item.component}
                    </div>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}
          </Accordion>
        </>
      ) : (
        <>
          <div className="text-center">
            <div>
              <h2 className="text-2xl font-bold">
                {mondialParsed.isMondial2026 ? MONDIAL_2026_MAIN_TITLE : event.name}
              </h2>
              {mondialParsed.isMondial2026 && mondialParsed.teamsTitle && !isBundle ? (
                <div className="text-sm font-semibold text-muted-foreground mt-1">
                  {mondialParsed.teamsTitle}
                </div>
              ) : null}
            </div>
            {!isBundle ? (
              <p className="text-lg">
                {event.location.name +
                  " | " +
                  dayjs(event.date).format("DD/MM/YYYY")}
              </p>
            ) : null}
          </div>
          {items.map((item) => item.component)}
        </>
      )}
    </div>
  );
};
