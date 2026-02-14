"use client";

import { Spoiler, ScrollArea, Text } from "@mantine/core";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { OrderContext } from "../app.context";
import { EventTicketCard } from "@/components/ui/EventTicketCard";
import Image from "next/image";
import { ChevronDownCircle, ChevronUpCircle } from "lucide-react";
import { EventDataHeader } from "@/components/ui/EventDataHeader";
import { useMediaQuery } from "@mantine/hooks";
import type { EventTicket } from "@/lib/app.types";
import { getAvailableTickets } from "@/lib/utils";
import { TixstockDynamicMap, useFilteredSourceTickets } from "@/components/TixstockDynamicMap";
import { eventTicketToListing, type TixStockListing } from "@/lib/tixstock-map";

export const TicketSelection = () => {
  const { setEventTicket, event } = useContext(OrderContext);
  const [errorMessage, setErrorMessage] = useState("");
  const [cheapestTicket, setCheapestTicket] = useState<EventTicket | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<string | undefined>(
    undefined
  );
  const [hoveredTicket, setHoveredTicket] = useState<TixStockListing | null>(null);
  const [sectionFilter, setSectionFilter] = useState<{
    section: string | null;
    category: string | null;
  }>({ section: null, category: null });

  const MAX_TICKETS = 9;

  /** Is this a TixStock dynamic-map event? */
  const isTxEvent = event?.type === "tx_event";

  const { numberOfEventTickets, setNumberOfEventTickets } =
    useContext(OrderContext);

  const matches = useMediaQuery("(min-width: 1024px)");

  // Consider only tickets that are available (t.available !== false). If "available" is undefined, treat as available.
  const availableTickets: EventTicket[] = useMemo(
    () => {
      const tickets = getAvailableTickets(event);
      const filteredOut = (event?.tickets_and_rates || []).length - tickets.length;
      
      if (filteredOut > 0) {
        console.log(`[TicketSelection] Filtered out ${filteredOut} unavailable ticket(s) for event ${event?.id}`);
      }
      
      return tickets;
    },
    [event]
  );

  useEffect(() => {
    if (!availableTickets || availableTickets.length === 0) {
      // No tickets available; clear selection, cheapest ticket, AND the event ticket in context
      console.log('No available tickets found - clearing all ticket state');
      setCheapestTicket(null);
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
    
    setCheapestTicket(cheapt);
    setSelectedTicket(cheapt?.id);
    setEventTicket({
      id: cheapt?.id || "",
      vendor: cheapt?.vendor || "",
      category: cheapt?.category || "",
      price: cheapt?.price || 0,
      description: cheapt?.description || "",
      quantity: 2,
    });
  }, [availableTickets, setEventTicket]);

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

  // ── TixStock helpers ──────────────────────────────────────────

  /** Convert EventTickets → TixStockListings for map consumption */
  const tixStockListings: TixStockListing[] = useMemo(
    () => availableTickets.map(eventTicketToListing),
    [availableTickets],
  );

  /** Stable callback for TixstockDynamicMap */
  const handleSectionFilterChange = useCallback(
    (filter: { section: string | null; category: string | null }) => {
      setSectionFilter(filter);
    },
    [],
  );

  /** Tickets filtered by the currently-selected map section */
  const filteredListings = useFilteredSourceTickets(
    tixStockListings,
    sectionFilter,
  );

  /** Map the filtered TixStock listings back to EventTickets */
  const displayedTickets: EventTicket[] = useMemo(() => {
    if (!isTxEvent) return availableTickets;
    if (!sectionFilter.section && !sectionFilter.category)
      return availableTickets;
    const filteredIds = new Set(filteredListings.map((l) => l.id));
    return availableTickets.filter((t) => filteredIds.has(t.id));
  }, [isTxEvent, availableTickets, filteredListings, sectionFilter]);

  return (
    <div>
      <div className="sr-only">
        <h1>בחירת כרטיסים לאירוע {event?.name}</h1>
        <p>בחר כמות וקטגוריית כרטיסים עבור האירוע ב{event?.location?.name}</p>
      </div>
      <div className="flex flex-col items-center ">
        <div dir="rtl" className="w-screen px-4 py-2 lg:p-4 bg-gray-200 ">
          <div className="flex justify-between w-full max-w-7xl mx-auto gap-2 px-2 lg:px-6 flex-col lg:flex-row lg:gap-2">
            <EventDataHeader event={event} />
          </div>
        </div>
      </div>
      <main className="flex flex-col" dir="rtl" role="main">
        <div className="mt-4 text-lg">
          בחרו כמות כרטיסים וקטגוריה מועדפת,
          <span className="font-bold"> ישיבה בזוגות מובטחת.</span>
        </div>
        <div className="flex gap-4 flex-col lg:flex-row-reverse mt-4">
          {isTxEvent ? (
            /* ── TixStock dynamic SVG map ──────────────────────── */
            <>
              <div className="w-full lg:hidden">
                <TixstockDynamicMap
                  mapUrl={event?.map_image_url || ""}
                  tickets={tixStockListings}
                  hoveredTicket={hoveredTicket}
                  onSectionFilterChange={handleSectionFilterChange}
                />
              </div>
              <div className="lg:w-[45%] hidden lg:block">
                <TixstockDynamicMap
                  mapUrl={event?.map_image_url || ""}
                  tickets={tixStockListings}
                  hoveredTicket={hoveredTicket}
                  onSectionFilterChange={handleSectionFilterChange}
                />
              </div>
            </>
          ) : (
            /* ── Legacy static image map ──────────────────────── */
            <>
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
                  src={event?.map_image_url || ""}
                  alt={`מפת אירוע ${event?.name || "לא ידוע"} - מיקומי הישיבה`}
                />
              </Spoiler>
              <div className="lg:w-[45%] hidden lg:block">
                <Image
                  className="rounded-lg w-auto h-auto w-full"
                  width={600}
                  height={600}
                  priority={true}
                  src={event?.map_image_url || ""}
                  alt={`מפת אירוע ${event?.name || "לא ידוע"} - מיקומי הישיבה ובלוקים`}
                />
              </div>
            </>
          )}
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
                  [...displayedTickets]
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
                        basePrice={cheapestTicket?.price ?? 0}
                        vip={ticket.vip}
                        onMouseEnter={
                          isTxEvent
                            ? () =>
                                setHoveredTicket(
                                  eventTicketToListing(ticket)
                                )
                            : undefined
                        }
                        onMouseLeave={
                          isTxEvent
                            ? () => setHoveredTicket(null)
                            : undefined
                        }
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
