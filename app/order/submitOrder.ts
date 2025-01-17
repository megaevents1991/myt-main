import { Order } from "@/lib/app.types";

export const submitOrder = async (
  order: Order
): Promise<{ bookingReference: string }> => {
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
