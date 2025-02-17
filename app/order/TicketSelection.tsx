"use client";

import { Spoiler, ScrollArea, Text } from "@mantine/core";
// import { useSearchParams } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { OrderContext } from "../app.context";
import { EventTicketCard } from "@/components/ui/EventTicketCard";
import Image from "next/image";
import { ChevronDownCircle, ChevronUpCircle } from "lucide-react";
import { EventDataHeader } from "@/components/ui/EventDataHeader";
import { isMobile } from "react-device-detect";

export const TicketSelection = () => {
  //const eventId = useSearchParams().get("eventId") as string;
  //const event = events.find((e) => e.id === eventId);
  const { setEventTicket, event } = useContext(OrderContext);
  const [errorMessage, setErrorMessage] = useState("");
  const [cheapestTicket, setCheapestTicket] = useState(Object);
  const [selectedTicket, setSelectedTicket] = useState<string | undefined>(
    undefined
  );

  const MAX_TICKETS = 9;

  const { numberOfEventTickets, setNumberOfEventTickets } =
    useContext(OrderContext);

  useEffect(() => {
    const cheapt = event?.tickets_and_rates.reduce(
      (min, ticket) => (ticket.price < min.price ? ticket : min),
      event.tickets_and_rates[0]
    );
    setCheapestTicket(cheapt);
    setSelectedTicket(cheapt?.id);
    setEventTicket({
      id: cheapt?.id || "",
      category: cheapt?.category || "",
      price: cheapt?.price || 0,
      quantity: 2,
    });
  }, [event]);

  useEffect(() => {
    if (!isMobile) return;
    const timer = setTimeout(() => {
      window.scrollTo({
        top: 90,
        behavior: "smooth", // Adds a smooth scrolling effect
      });
    }, 1000); // 1 second delay

    return () => clearTimeout(timer); // Cleanup timeout if component unmounts
  }, []);

  const handleTicketSelect = (ticket: {
    id: string;
    category: string;
    price: number;
  }) => {
    setEventTicket({ ...ticket, quantity: numberOfEventTickets });
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
      <div className="flex flex-col items-center ">
        <div dir="rtl" className="w-screen px-4 py-2 lg:p-4 bg-gray-200 ">
          <div className="flex justify-between w-full max-w-7xl mx-auto gap-2 px-2 lg:px-6 flex-col lg:flex-row lg:gap-2">
            <EventDataHeader event={event} />
          </div>
        </div>
      </div>
      <div className="flex flex-col" dir="rtl">
        <div className="mt-4 text-lg">
          אנו נבחר עבורכם את המושבים הטובים ביותר,
          <span className="font-bold"> ישיבה בזוגות מובטחת.</span>
        </div>
        <div className="flex gap-4 flex-col lg:flex-row-reverse mt-6">
          <Spoiler
            className="w-full lg:hidden flex justify-center"
            style={{ margin: 0 }}
            maxHeight={90}
            showLabel={<ChevronDownCircle fill="black" width={"100%"} />}
            controlRef={(ref) => {
              ref?.setAttribute(
                "style",
                "left: 50%; transform: translate(-50%, -120%); color: white;"
              );
            }}
            hideLabel={<ChevronUpCircle fill="black" width={"100%"} />}
          >
            <Image
              className="rounded-lg"
              width={600}
              height={600}
              src={event?.map_image_url || ""}
              alt="Event map"
            />
          </Spoiler>
          <div className="lg:w-[45%] hidden lg:block">
            <Image
              className="rounded-lg w-auto h-auto w-full"
              width={600}
              height={600}
              src={event?.map_image_url || ""}
              alt="Event map"
            />
          </div>
          <div className="w-full lg:w-[55%]" dir="ltr">
            <ScrollArea h={"60vh"}>
              {errorMessage && (
                <Text c="red" ta="right" mb="xs">
                  {errorMessage}
                </Text>
              )}
              <div className="flex flex-col gap-2">
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
      </div>
    </div>
  );
};
