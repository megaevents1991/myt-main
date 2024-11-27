"use client";

import { useState } from "react";
import TicketSelection from "./TicketSelection";
import { FlightSelection } from "./FlightSelection";
import HotelSelection from "./HotelSelection";
import OrderReview from "./OrderReview";
import { useOrderState } from "./useOrderState";
import { Button } from "@/components/ui/button";
import { Event } from "@/lib/app.types";

export const OrderForm = ({ event }: { event: Event }) => {
  const [step, setStep] = useState(1);
  const { order, updateOrder, submitOrder } = useOrderState(event);

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        Book Your Experience: {event.name}
      </h1>
      {step === 1 && (
        <TicketSelection
          event={event}
          order={order}
          updateOrder={updateOrder}
        />
      )}
      {step === 2 && <FlightSelection />}
      {step === 3 && <HotelSelection order={order} updateOrder={updateOrder} />}
      {step === 4 && <OrderReview order={order} onSubmit={submitOrder} />}
      <div className="flex justify-between mt-8">
        {step > 1 && (
          <Button onClick={prevStep} variant="outline">
            Previous
          </Button>
        )}
        {step < 4 && (
          <Button onClick={nextStep} className="ml-auto">
            Next
          </Button>
        )}
      </div>
    </div>
  );
};
