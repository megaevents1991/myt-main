"use client";

import { useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  CalendarDays,
  MapPin,
  Plane,
  Hotel,
  CreditCard,
} from "lucide-react";
import { events } from "@/lib/events-data";
import { Order } from "@/lib/app.types";
import { OrderContext } from "../app.context";

interface OrderReviewProps {
  order: Order;
  onSubmit: () => Promise<{ bookingReference: string }>;
}

export default function OrderReview({ order, onSubmit }: OrderReviewProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { flight: selectedFlight, hotel: selectedHotel } =
    useContext(OrderContext);
  const router = useRouter();

  const event = events.find((e) => e.id === order.eventId);
  // const selectedFlight = flights.find((f) => f.id === order.flightId);
  // const selectedHotel = hotels.find((h) => h.id === order.hotelId);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await onSubmit();
      router.push(`/confirmation?bookingReference=${result.bookingReference}`);
    } catch (error) {
      console.error("Error submitting order:", error);
      alert("Failed to submit order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!event || !selectedFlight || !selectedHotel) {
    return (
      <div className="text-center p-3 bg-red-50 rounded-lg">
        <p className="text-red-600">
          Missing order information. Please complete all selections.
        </p>
      </div>
    );
  }

  const totalPrice =
    (order.ticketType === "vip"
      ? event.tickets[1].price * 2
      : event.tickets[0].price) *
      order.quantity +
    selectedFlight.price +
    selectedHotel.price;

  return (
    <div className="max-w-5xl mx-auto px-4 py-2">
      <h2 className="text-xl font-semibold mb-3">Review Your Order</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <CalendarDays className="w-4 h-4" />
              Event
            </div>
            <h3 className="font-medium mb-1">{event.name}</h3>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p>{new Date(event.date).toLocaleDateString()}</p>
              <p className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {event.location.name}
              </p>
              <p>
                {order.ticketType.toUpperCase()} Ticket × {order.quantity}
              </p>
              <p className="font-medium text-foreground">
                $
                {(order.ticketType === "vip"
                  ? event.tickets[0].price * 2
                  : event.tickets[0].price) * order.quantity}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <Plane className="w-4 h-4" />
              Flight
            </div>
            <h3 className="font-medium mb-1">{selectedFlight.airline}</h3>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p>
                {selectedFlight.stops === 0
                  ? "Direct Flight"
                  : `${selectedFlight.stops} Stops`}
              </p>
              <p>
                Out: {selectedFlight.outbound.departureTime} -{" "}
                {selectedFlight.outbound.arrivalTime}
              </p>
              <p>
                Return: {selectedFlight.returnDepartureTime} -{" "}
                {selectedFlight.returnArrivalTime}
              </p>
              <p className="font-medium text-foreground">
                ${selectedFlight.price}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <Hotel className="w-4 h-4" />
              Hotel
            </div>
            <h3 className="font-medium mb-1">{selectedHotel.name}</h3>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p>Check-in: {new Date(event.date).toLocaleDateString()}</p>
              <p>
                Check-out:{" "}
                {new Date(
                  new Date(event.date).setDate(
                    new Date(event.date).getDate() + 1
                  )
                ).toLocaleDateString()}
              </p>
              <p className="font-medium text-foreground">
                ${selectedHotel.price}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <Card>
          <CardContent className="p-3 flex justify-between items-center">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CreditCard className="w-4 h-4" />
              Total Price
            </div>
            <span className="text-lg font-bold">${totalPrice}</span>
          </CardContent>
        </Card>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          size="lg"
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Order...
            </>
          ) : (
            "Confirm Order"
          )}
        </Button>
      </div>
    </div>
  );
}
