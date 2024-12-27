"use client";

import { useContext } from "react";
import { TicketSelection } from "./TicketSelection";
import { FlightSelection } from "./FlightSelection";
import { HotelSelection } from "./HotelSelection";
import OrderReview from "./OrderReview";
import { useOrderState } from "./useOrderState";
import { Event } from "@/lib/app.types";
import { OrderContext } from "../app.context";

const buttonText: Record<number, string> = {
  1: "המשך לבחירת טיסה",
  2: "המשך לבחירת מלון",
  3: "המשך לסיכום הזמנה",
  4: "שלח הזמנה",
} as const;

export const OrderForm = ({ event }: { event: Event }) => {
  const { order, submitOrder } = useOrderState(event);
  const { step, setStep } = useContext(OrderContext);

  const nextStep = () => setStep((prev) => prev + 1);
  // const prevStep = () => setStep((prev) => prev - 1);

  return (
    <div className="max-w-5xl mx-auto p-6">
      {step === 1 && <TicketSelection />}
      {step === 2 && <FlightSelection />}
      {step === 3 && <HotelSelection />}
      {step === 4 && <OrderReview order={order} onSubmit={submitOrder} />}
      <div className="flex justify-between mt-4 sticky bottom-5 z-10">
        {/* {step > 1 && (
          <button
            onClick={prevStep}
            className={`${"bg-main"}  text-white rounded-lg p-2 font-bold w-full`}
          >
            {buttonText[step]}
          </button>
        )} */}
        {step < 4 && (
          <button
            onClick={nextStep}
            className="bg-main mt-4 text-white rounded-lg p-2 font-bold w-full sm:w-1/4"
          >
            {buttonText[step]}
          </button>
        )}
      </div>
    </div>
  );
};
