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

export const Review = ({
  agentCommission,
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
  selectedFlight?: Flight;
  airlineFullName?: string;
  flightPriceAddition: number;
  eventTicketPriceAddition: number;
  event: Event;
  skipHotel?: boolean;
  flightSkipped?: boolean;
}) => {
  const items = useMemo(
    () => [
      {
        id: "event-summary",
        primary: `כרטיסים (${numberOfEventTickets})`,
        secondary: `קטגוריה: ${eventTicket.category}`,
        icon: <FaTicketAlt />,
        component: (
          <EventSummary
            key={"event-summary"}
            numberOfEventTickets={numberOfEventTickets}
            eventTicket={eventTicket}
            agentCommission={agentCommission}
            eventTicketPriceAddition={eventTicketPriceAddition}
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
      // Conditionally include flight only if not skipped
      ...(!flightSkipped && selectedFlight ? [{
        id: "flight-summary",
        primary: `טיסה (${selectedFlight.numOfTravelers} נוסעים)`,
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
      numberOfEventTickets,
      eventTicket,
      agentCommission,
      eventTicketPriceAddition,
      selectedHotel,
      hotelPriceAddition,
      totalGuests,
      flightPriceAddition,
      airlineFullName,
      selectedFlight,
      skipHotel,
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
              <h2 className="text-2xl font-bold">{event.name}</h2>
            </div>
            <p className="text-lg">
              {event.location.name +
                " | " +
                dayjs(event.date).format("DD/MM/YYYY")}
            </p>
          </div>
          {items.map((item) => item.component)}
        </>
      )}
    </div>
  );
};
