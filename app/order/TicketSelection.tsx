"use client";

import { Order, Event } from "@/lib/app.types";
import { useState, useEffect } from "react";

interface Ticket {
  type: string;
  price: number;
}

interface TicketSelectionProps {
  event: Event;
  order: Order;
  updateOrder: (key: keyof Order, value: string | number) => void;
}

export default function TicketSelection({
  event,
  order,
  updateOrder,
}: TicketSelectionProps) {
  const [availableTickets, setAvailableTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    async function fetchTickets() {
      const res = await fetch(`/api/tickets?eventId=${event.id}`);
      const data = await res.json();
      setAvailableTickets(data);
    }
    fetchTickets();
  }, [event.id]);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Select Your Tickets</h2>
      {availableTickets.map((ticket) => (
        <div key={ticket.type} className="mb-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="ticketType"
              value={ticket.type}
              checked={order.ticketType === ticket.type}
              onChange={(e) => updateOrder("ticketType", e.target.value)}
            />
            <span className="ml-2">
              {ticket.type} - ${ticket.price}
            </span>
          </label>
        </div>
      ))}
      <div>
        <label className="block mb-2">Quantity:</label>
        <input
          type="number"
          min="1"
          value={order.quantity}
          onChange={(e) => updateOrder("quantity", parseInt(e.target.value))}
          className="border p-2"
        />
      </div>
    </div>
  );
}
