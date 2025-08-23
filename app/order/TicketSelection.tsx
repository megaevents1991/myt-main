"use client";

import { Spoiler, ScrollArea, Text } from "@mantine/core";
import { useContext, useEffect, useState } from "react";
import { OrderContext } from "../app.context";
import { EventTicketCard } from "@/components/ui/EventTicketCard";
import Image from "next/image";
import { ChevronDownCircle, ChevronUpCircle } from "lucide-react";
import { EventDataHeader } from "@/components/ui/EventDataHeader";
import { useMediaQuery } from "@mantine/hooks";

export const TicketSelection = () => {
  const { setEventTicket, event } = useContext(OrderContext);
  const [errorMessage, setErrorMessage] = useState("");
  const [cheapestTicket, setCheapestTicket] = useState(Object);
  const [selectedTicket, setSelectedTicket] = useState<string | undefined>(
    undefined
  );

  const MAX_TICKETS = 9;

  const { numberOfEventTickets, setNumberOfEventTickets } =
    useContext(OrderContext);

  const matches = useMediaQuery("(min-width: 1024px)");

  useEffect(() => {
    if (!event?.tickets_and_rates || event.tickets_and_rates.length === 0) {
      return;
    }
    
    const cheapt = event.tickets_and_rates.reduce(
      (min, ticket) => (ticket.price < min.price ? ticket : min),
      event.tickets_and_rates[0]
    );
    setCheapestTicket(cheapt);
    setSelectedTicket(cheapt?.id);
    setEventTicket({
      id: cheapt?.id || "",
      vendor: cheapt?.vendor || "",
      category: cheapt?.category || "",
      price: cheapt?.price || 0,
      quantity: 2,
    });
  }, [event, setEventTicket]);

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
  }) => {
    setEventTicket({ 
      ...ticket, 
      quantity: numberOfEventTickets
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
              unoptimized
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
              unoptimized
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
                {[...(event?.tickets_and_rates || [])]
                  .sort((a, b) => a.price - b.price)
                  .map((ticket, index) => (
                    <EventTicketCard
                      index={index}
                      onClick={() =>
                        handleTicketSelect({
                          id: ticket.id,
                          price: ticket.price,
                          category: ticket.category,
                          vendor: ticket.vendor,
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
                      basePrice={cheapestTicket.price}
                    />
                  ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </main>
    </div>
  );
};
