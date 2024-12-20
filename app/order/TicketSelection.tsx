"use client";

import { events } from "@/lib/events-data";
import { Text, Spoiler, ScrollArea } from "@mantine/core";
import { useSearchParams } from "next/navigation";
import { useContext, useState } from "react";
import { OrderContext } from "../app.context";
import OptionSelect from "@/components/ui/selector";
import { TicketCard } from "@/components/ui/ticketCard";
import Image from "next/image";
import { ChevronDownCircle, ChevronUpCircle } from "lucide-react";

export const TicketSelection = () => {
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const eventId = useSearchParams().get("eventId") as string;
  const event = events.find((e) => e.id === eventId);

  const { numberOfEventTickets, setNumberOfEventTickets } =
    useContext(OrderContext);

  const handleTicketSelect = (id: string) => {
    setSelectedTicket(id);
  };

  const handleQuantityChange = (value: number | string) => {
    setNumberOfEventTickets(+value);
  };

  return (
    <div>
      <OptionSelect
        value={numberOfEventTickets}
        onChange={handleQuantityChange}
      />
      <Text
        size="xl"
        mb="lg"
        style={{ fontWeight: 700, alignContent: "center" }}
      >
        Choose Your Ticket
      </Text>
      <div className="flex flex-col sm:flex-row">
        <Spoiler
          className="w-full sm:w-1/3"
          maxHeight={120}
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
            src={event?.mapUrl || ""}
            alt="Event map"
          />
        </Spoiler>
        <div className="w-full sm:w-2/3">
          <ScrollArea h={"50vh"}>
            <div className="flex flex-col gap-2">
              {event?.tickets.map((ticket, index) => (
                <TicketCard
                  index={index}
                  onClick={() => handleTicketSelect(ticket.id)}
                  key={ticket.id}
                  category={ticket.category}
                  categoryDescription={ticket.description}
                  colorOnTheMap={ticket.colorOnTheMap || ""}
                  isSelected={selectedTicket === ticket.id}
                  price={ticket.price}
                  basePrice={event?.tickets[0].price || 0}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
      {/* <Grid>
        {event?.tickets.map((ticket) => (
          <Grid.Col key={ticket.id} span={12}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group mb="xs">
                <Text style={{ fontWeight: 700 }}>{ticket.category}</Text>
                <Badge
                  color={selectedTicket === ticket.id ? "green" : "gray"}
                  variant="light"
                >
                  {selectedTicket === ticket.id ? "Selected" : "Available"}
                </Badge>
              </Group>

              <Text size="sm" color="dimmed" mb="md">
                {ticket.description}
              </Text>

              <Text style={{ fontWeight: 700 }} size="lg" mb="md">
                {ticket.price}
              </Text>

              <Button
                variant={selectedTicket === ticket.id ? "filled" : "light"}
                color="blue"
                fullWidth
                onClick={() => handleTicketSelect(ticket.id)}
              >
                {selectedTicket === ticket.id ? "Selected" : "Select Ticket"}
              </Button>
            </Card>
          </Grid.Col>
        ))}
      </Grid> */}
    </div>
  );
};
