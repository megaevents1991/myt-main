"use client";

import { useContext } from "react";
import { TicketSelection } from "./TicketSelection";
import { FlightSelection } from "./FlightSelection";
import { HotelSelection } from "./HotelSelection";
import OrderReview from "./OrderReview";
import { useOrderState } from "./useOrderState";
import { Event } from "@/lib/app.types";
import { OrderContext } from "../app.context";
import { cn } from "@/lib/utils";

const buttonText: Record<number, string> = {
  1: "המשך לבחירת טיסה",
  2: "המשך לבחירת מלון",
  3: "המשך לסיכום הזמנה",
  4: "שלח הזמנה",
} as const;

export const OrderForm = ({ event }: { event: Event }) => {
  const { order, submitOrder } = useOrderState(event);
  const { step, setStep, flight, hotel } = useContext(OrderContext);

  const buttonDisabled =
    (!flight?.id && step === 2) || (!hotel?.id && step === 3);

  const nextStep = () => setStep((prev) => prev + 1);
  // const prevStep = () => setStep((prev) => prev - 1);

  return (
    <div className="max-w-5xl mx-auto px-6 pt-6">
      {step === 1 && <TicketSelection />}
      {step === 2 && <FlightSelection />}
      {step === 3 && <HotelSelection />}
      {step === 4 && <OrderReview order={order} onSubmit={submitOrder} />}
      <div className="flex w-full flex-col items-center">
        <div className="mt-4 sticky z-10 w-screen justify-center flex flex-col">
          {/* {step > 1 && (
          <button
            onClick={prevStep}
            className={`${"bg-main"}  text-white rounded-lg p-2 font-bold w-full`}
          >
            {buttonText[step]}
          </button>
        )} */}
          {step < 4 && (
            <div className="w-full bg-black p-4 flex bg-gray-200 flex ">
              <button
                disabled={buttonDisabled}
                onClick={nextStep}
                className={cn(
                  "bg-main text-white rounded-lg p-2 font-bold w-full sm:w-1/4",
                  buttonDisabled && "opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {buttonText[step]}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
