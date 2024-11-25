import { Event, Order } from "@/lib/app.types";
import { useState } from "react";

export function useOrderState(event: Event) {
  const [order, setOrder] = useState<Order>({
    eventId: event.id,
    ticketType: "",
    quantity: 1,
    flightId: "",
    hotelId: "",
    totalPrice: 0,
  });

  const updateOrder = (key: keyof Order, value: string | number) => {
    setOrder((prev) => ({ ...prev, [key]: value }));
  };

  const submitOrder = async (): Promise<{ bookingReference: string }> => {
    try {
      const response = await fetch("/api/confirm-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      });
      if (!response.ok) throw new Error("Failed to submit order");
      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error submitting order:", error);
      throw error;
    }
  };

  return { order, updateOrder, submitOrder };
}
