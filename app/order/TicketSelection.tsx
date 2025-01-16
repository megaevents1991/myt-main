"use client";

import { Spoiler, ScrollArea } from "@mantine/core";
// import { useSearchParams } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { OrderContext } from "../app.context";
import OptionSelect from "@/components/ui/selector";
import { EventTicketCard } from "@/components/ui/EventTicketCard";
import Image from "next/image";
import { ChevronDownCircle, ChevronUpCircle } from "lucide-react";
import dayjs from "dayjs";

export const TicketSelection = () => {
  //const eventId = useSearchParams().get("eventId") as string;
  //const event = events.find((e) => e.id === eventId);
  const { setEventTicket, event } = useContext(OrderContext);

  const [selectedTicket, setSelectedTicket] = useState<string | undefined>(
    event?.tickets_and_rates[0].id
  );
  const { numberOfEventTickets, setNumberOfEventTickets } =
    useContext(OrderContext);

  useEffect(() => {
    setEventTicket({
      id: event?.tickets_and_rates[0].id || "",
      category: event?.tickets_and_rates[0].category || "",
      price: event?.tickets_and_rates[0].price || 0,
      quantity: 1,
    });
  }, [event]);

  const handleTicketSelect = (ticket: {
    id: string;
    category: string;
    price: number;
  }) => {
    setEventTicket({ ...ticket, quantity: numberOfEventTickets });
    setSelectedTicket(ticket.id);
  };

  const handleQuantityChange = (value: number | string) => {
    setNumberOfEventTickets(+value);
  };

  return (
    <div className="py-6">
      <div className="flex flex-col items-center">
        <div
          dir="rtl"
          className="w-screen gap-2 flex flex-col sm:flex-row  justify-center p-4 bg-gray-200 "
        >
          <div className="text-xs w-full sm:w-1/2 lg:w-1/3">
            <div className="text-center sm:text-right">
              <span className="text-2xl font-bold pre ml-2">{event?.name}</span>
              <span className="whitespace-nowrap hidden sm:inline">
                {dayjs(event?.date).format("DD/MM/YY")} | {event?.location.name}
              </span>
            </div>
            <div>{event?.description}</div>
          </div>
          <div className="flex flex-row-reverse	sm:flex-col gap-2 w-full sm:w-1/2 lg:w-1/3">
            <div className="whitespace-nowrap w-1/2 text-center block sm:hidden">
              {dayjs(event?.date).format("DD/MM/YY")} <br></br>
              {event?.location.name}
            </div>
            <div className="flex w-1/2 sm:w-full flex-row sm:flex-col gap-2 text-xs">
              <div className="w-1/3">כמות כרטיסים</div>
              <OptionSelect
                value={numberOfEventTickets}
                onChange={handleQuantityChange}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-4 flex-col sm:flex-row mt-6">
        <Spoiler
          className="w-full sm:w-1/3 sm:hidden"
          style={{ margin: 0 }}
          maxHeight={90}
          showLabel={<ChevronDownCircle fill="black" width={"100%"} />}
          controlRef={(ref) => {
            ref?.setAttribute(
              "style",
              "left: 50%; transform: translate(-50%, -120%); color: white; width:100%;"
            );
          }}
          hideLabel={<ChevronUpCircle fill="black" width={"100%"} />}
        >
          <Image
            className="rounded-lg"
            width={600}
            height={800}
            src={event?.map_image_url || ""}
            alt="Event map"
          />
        </Spoiler>
        <Image
          className="rounded-lg hidden w-full sm:block w-auto h-auto max-w-[50%]"
          width={600}
          height={800}
          src={event?.map_image_url || ""}
          alt="Event map"
        />
        <div className="w-full sm:w-2/3">
          <ScrollArea h={"40vh"}>
            <div className="flex flex-col gap-2">
              {event?.tickets_and_rates.map((ticket, index) => (
                <EventTicketCard
                  index={index}
                  onClick={() =>
                    handleTicketSelect({
                      id: ticket.id,
                      price: ticket.price,
                      category: ticket.category,
                    })
                  }
                  key={ticket.id}
                  category={ticket.category}
                  categoryDescription={ticket.description}
                  colorOnTheMap={ticket.colorOnTheMap || ""}
                  isSelected={selectedTicket === ticket.id}
                  price={ticket.price}
                  basePrice={event?.tickets_and_rates[0].price || 0}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};
