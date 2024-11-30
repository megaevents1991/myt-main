"use client";

import { events } from "@/lib/events-data";
import {
  Badge,
  Button,
  Card,
  Grid,
  Group,
  NumberInput,
  Text,
} from "@mantine/core";
import { useSearchParams } from "next/navigation";
import { useContext, useState } from "react";
import { OrderContext } from "../app.context";

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
      <NumberInput
        value={numberOfEventTickets}
        onChange={handleQuantityChange}
        label="Quantity"
        min={1}
        placeholder="Enter number of tickets"
        step={1}
      />
      <Text
        size="xl"
        mb="lg"
        style={{ fontWeight: 700, alignContent: "center" }}
      >
        Choose Your Ticket
      </Text>
      <Grid>
        {event?.tickets.map((ticket) => (
          <Grid.Col key={ticket.id} span={12}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group mb="xs">
                <Text style={{ fontWeight: 700 }}>{ticket.type}</Text>
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
      </Grid>
    </div>
  );
};
