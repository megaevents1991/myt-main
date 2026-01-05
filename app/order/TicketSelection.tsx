"use client";

import { Spoiler, ScrollArea, Text } from "@mantine/core";
import { useContext, useEffect, useMemo, useState } from "react";
import { OrderContext } from "../app.context";
import { EventTicketCard } from "@/components/ui/EventTicketCard";
import Image from "next/image";
import { ChevronDownCircle, ChevronUpCircle } from "lucide-react";
import { EventDataHeader } from "@/components/ui/EventDataHeader";
import { useMediaQuery } from "@mantine/hooks";
import type { EventTicket } from "@/lib/app.types";
import { getAvailableTickets } from "@/lib/utils";
import { MONDIAL_2026_MAIN_TITLE, parseMondial2026EventName } from "@/lib/mondial2026Title";

export const TicketSelection = () => {
  const {
    setEventTicket,
    event,
    selectedEvents,
    activeTicketEventIndex,
    setActiveTicketEventIndex,
    selectedEventTickets,
    setSelectedEventTickets,
  } = useContext(OrderContext);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<string | undefined>(
    undefined
  );

  const effectiveEvents = selectedEvents && selectedEvents.length > 0
    ? selectedEvents
    : (event ? [event] : []);
  const activeEvent = effectiveEvents[activeTicketEventIndex];

  const MAX_TICKETS = 9;

  const { numberOfEventTickets, setNumberOfEventTickets } =
    useContext(OrderContext);

  const matches = useMediaQuery("(min-width: 1024px)");

  // Consider only tickets that are available (t.available !== false). If "available" is undefined, treat as available.
  const availableTickets: EventTicket[] = useMemo(
    () => {
      const tickets = getAvailableTickets(activeEvent);
      const filteredOut = (activeEvent?.tickets_and_rates || []).length - tickets.length;
      
      if (filteredOut > 0) {
        console.log(`[TicketSelection] Filtered out ${filteredOut} unavailable ticket(s) for event ${activeEvent?.id}`);
      }
      
      return tickets;
    },
    [activeEvent]
  );

  // Always compute base ticket price from the CURRENT active event.
  // This prevents stale or cross-event basePrice when switching between bundled events.
  const baseTicketPrice = useMemo(() => {
    if (!availableTickets || availableTickets.length === 0) return 0;
    return availableTickets.reduce(
      (min, ticket) => (ticket.price < min ? ticket.price : min),
      availableTickets[0].price
    );
  }, [availableTickets]);

  useEffect(() => {
    if (!activeEvent) return;

    const existingSelection = selectedEventTickets?.[activeEvent.id];
    if (existingSelection?.id) {
      setSelectedTicket(existingSelection.id);
      setEventTicket({
        ...existingSelection,
        quantity: numberOfEventTickets,
      });
      return;
    }

    if (!availableTickets || availableTickets.length === 0) {
      // No tickets available; clear selection, cheapest ticket, AND the event ticket in context
      console.log('No available tickets found - clearing all ticket state');
      setSelectedTicket(undefined);
      // CRITICAL FIX: Clear the eventTicket in context to prevent stale data
      setEventTicket({
        id: "",
        vendor: "",
        category: "",
        price: 0,
        description: "",
        quantity: 0,
      });
      return;
    }

    console.log(`Found ${availableTickets.length} available tickets:`, 
      availableTickets.map(t => ({ id: t.id, category: t.category, available: t.available }))
    );

    const cheapt = availableTickets.reduce<EventTicket>((min, ticket) =>
      ticket.price < min.price ? ticket : min,
      availableTickets[0]
    );
    
    console.log(`Auto-selecting cheapest ticket: ${cheapt.category} (ID: ${cheapt.id}, available: ${cheapt.available})`);
    
    setSelectedTicket(cheapt?.id);
    const ticketPayload = {
      id: cheapt?.id || "",
      vendor: cheapt?.vendor || "",
      category: cheapt?.category || "",
      price: cheapt?.price || 0,
      description: cheapt?.description || "",
      quantity: numberOfEventTickets,
    };
    setEventTicket(ticketPayload);
    if (activeEvent?.id) {
      setSelectedEventTickets((prev) => ({
        ...prev,
        [activeEvent.id]: {
          ...ticketPayload,
          quantity: numberOfEventTickets,
        },
      }));
    }
  }, [activeEvent, availableTickets, numberOfEventTickets, selectedEventTickets, setEventTicket, setSelectedEventTickets]);

  useEffect(() => {
    if (matches) return; // Don't scroll on desktop (1024px+)
    const timer = setTimeout(() => {
      window.scrollTo({
        top: 90,
        behavior: "smooth",
      });
    }, 1000); // 1 second delay

    return () => clearTimeout(timer); // Cleanup timeout if component unmounts
  }, [matches]); // Add matches as dependency

  const handleTicketSelect = (ticket: {
    id: string;
    category: string;
    price: number;
    vendor?: string;
    description?: string;
  }) => {
    // Defensive: ensure the selected ticket is still available
    const ticketInAvailableList = availableTickets.find((t) => t.id === ticket.id);
    if (!ticketInAvailableList) {
      console.warn(`Attempted to select unavailable ticket: ${ticket.category} (ID: ${ticket.id})`);
      return;
    }
    
    // Additional check: verify the ticket is not explicitly marked as unavailable
    if (ticketInAvailableList.available === false) {
      console.warn(`Ticket is marked as unavailable: ${ticket.category} (ID: ${ticket.id})`);
      return;
    }
    
    setEventTicket({
      ...ticket,
      description: ticket.description || "",
      quantity: numberOfEventTickets,
    });
    if (activeEvent?.id) {
      setSelectedEventTickets((prev) => ({
        ...prev,
        [activeEvent.id]: {
          ...ticket,
          description: ticket.description || "",
          quantity: numberOfEventTickets,
        },
      }));
    }
    setSelectedTicket(ticket.id);
  };

  const handleQuantityChange = (value: number | string) => {
    if (+value > MAX_TICKETS) {
      setErrorMessage("ניתן לרכוש עד 9 כרטיס בשלב זה");
      return;
    }
    setErrorMessage("");
    setNumberOfEventTickets(+value);
  };

  return (
    <div>
      <div className="sr-only">
        <h1>בחירת כרטיסים לאירוע {activeEvent?.name || event?.name}</h1>
        <p>
          בחר כמות וקטגוריית כרטיסים עבור האירוע ב{activeEvent?.location?.name || event?.location?.name}
        </p>
      </div>

      {effectiveEvents.length > 1 && activeEvent && (
        <div dir="rtl" className="mb-3">
          <div className="text-sm font-semibold text-secondary">
            בחירת כרטיסים: אירוע {activeTicketEventIndex + 1} מתוך {effectiveEvents.length}
          </div>
          <div className="flex flex-wrap gap-2 mt-2" dir="rtl">
            {effectiveEvents.map((e, idx) => {
              const parsed = parseMondial2026EventName(e.name);
              const buttonLabel = parsed.isMondial2026
                ? (parsed.teamsTitle || e.name)
                : e.name;

              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setActiveTicketEventIndex(idx)}
                  className={
                    idx === activeTicketEventIndex
                      ? "bg-main text-white px-3 py-1 rounded-lg text-sm font-bold"
                      : "bg-gray-200 text-secondary px-3 py-1 rounded-lg text-sm font-semibold"
                  }
                  aria-label={`בחירת אירוע ${e.name}`}
                >
                  {buttonLabel}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col items-center ">
        <div dir="rtl" className="w-screen px-4 py-2 lg:p-4 bg-gray-200 ">
          <div className="flex justify-between w-full max-w-7xl mx-auto gap-2 px-2 lg:px-6 flex-col lg:flex-row lg:gap-2">
            {(() => {
              const headerEvent = activeEvent || event;
              const parsed = parseMondial2026EventName(headerEvent?.name);
              return parsed.isMondial2026 ? (
                <EventDataHeader
                  event={headerEvent}
                  titleOverride={MONDIAL_2026_MAIN_TITLE}
                  subtitleOverride={parsed.teamsTitle}
                />
              ) : (
                <EventDataHeader event={headerEvent} />
              );
            })()}
          </div>
        </div>
      </div>
      <main className="flex flex-col" dir="rtl" role="main">
        <div className="mt-4 text-lg">
          בחרו כמות כרטיסים וקטגוריה מועדפת,
          <span className="font-bold"> ישיבה בזוגות מובטחת.</span>
        </div>
        <div className="flex gap-4 flex-col lg:flex-row-reverse mt-4">
          <Spoiler
            className="w-full lg:hidden flex justify-center"
            style={{ margin: 0 }}
            maxHeight={90}
            showLabel={<ChevronDownCircle fill="black" width={"100%"} aria-label="הרחב מפת האירוע" />}
            controlRef={(ref) => {
              ref?.setAttribute(
                "style",
                "left: 50%; transform: translate(-50%, -120%); color: white;"
              );
              ref?.setAttribute("aria-label", "הרחב מפת האירוע");
            }}
            hideLabel={<ChevronUpCircle fill="black" width={"100%"} aria-label="כווץ מפת האירוע" />}
          >
            <Image
              className="rounded-lg"
              width={600}
              height={600}
              priority={true}
              src={activeEvent?.map_image_url || event?.map_image_url || ""}
              alt={`מפת אירוע ${activeEvent?.name || event?.name || "לא ידוע"} - מיקומי הישיבה`}
            />
          </Spoiler>
          <div className="lg:w-[45%] hidden lg:block">
            <Image
              className="rounded-lg w-auto h-auto w-full"
              width={600}
              height={600}
              priority={true}
              src={activeEvent?.map_image_url || event?.map_image_url || ""}
              alt={`מפת אירוע ${activeEvent?.name || event?.name || "לא ידוע"} - מיקומי הישיבה ובלוקים`}
            />
          </div>
          <div className="w-full lg:w-[55%]" dir="ltr">
            <ScrollArea h={"60vh"}>
              {errorMessage && (
                <Text c="red" ta="right" mb="xs" role="alert" aria-live="polite">
                  {errorMessage}
                </Text>
              )}
              <div
                className="flex flex-col gap-2"
                role="group"
                aria-labelledby="ticket-selection-heading"
              >
                <div id="ticket-selection-heading" className="sr-only">
                  קטגוריות כרטיסים זמינות
                </div>
                {availableTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center gap-4">
                    <Text size="xl" fw={700} c="red" aria-live="polite">
                      אין כרטיסים זמינים כרגע
                    </Text>
                    <Text size="md" c="dimmed">
                      כל הכרטיסים לאירוע זה אזלו או אינם זמינים למכירה.
                    </Text>
                    <Text size="sm" c="dimmed">
                      אנא נסו אירוע אחר או צרו קשר עם שירות הלקוחות לקבלת עזרה.
                    </Text>
                  </div>
                ) : (
                  [...availableTickets]
                    .sort((a: EventTicket, b: EventTicket) => a.price - b.price)
                    .filter((ticket: EventTicket) => {
                      // Double-check: ensure ticket is still available before rendering
                      if (ticket.available === false) {
                        console.warn(`Attempted to render unavailable ticket: ${ticket.category} (ID: ${ticket.id})`);
                        return false;
                      }
                      return true;
                    })
                    .map((ticket: EventTicket, index: number) => (
                      <EventTicketCard
                        index={index}
                        onClick={() =>
                            handleTicketSelect({
                              id: ticket.id,
                              price: ticket.price,
                              category: ticket.category,
                              vendor: ticket.vendor,
                              description: ticket.description,
                            })
                        }
                        numberOfTickets={numberOfEventTickets}
                        onChangeNumberOfTickets={handleQuantityChange}
                        key={ticket.id}
                        category={ticket.category}
                        categoryDescription={ticket.description}
                        colorOnTheMap={ticket.colorOnTheMap || ""}
                        isSelected={selectedTicket === ticket.id}
                        price={ticket.price}
                        basePrice={baseTicketPrice}
                        vip={ticket.vip}
                      />
                    ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </main>
    </div>
  );
};
