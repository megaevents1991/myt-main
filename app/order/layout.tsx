"use client";
import { PillStepper } from "@/components/ui/pillStepper";
import { ReactNode, useEffect, useState } from "react";
import { OrderContext } from "../app.context";
import { Event, Flight, Hotel } from "@/lib/app.types";
import { events } from "@/lib/events-data";
import { useSearchParams } from "next/navigation";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/carousel/styles.css";

const OrderLayout = ({ children }: { children: ReactNode }) => {
  const [flight, setFlight] = useState<Flight | undefined>({} as Flight);
  const [event, setEvent] = useState<Event | undefined>({} as Event);
  const [hotel, setHotel] = useState<Hotel | undefined>({} as Hotel);
  const [numberOfEventTickets, setNumberOfEventTickets] = useState(1);
  const [planeTickets, setPlaneTickets] = useState({ adults: 1, children: 0 });
  const [step, setStep] = useState(1);
  const eventId = useSearchParams().get("eventId") as string;

  useEffect(() => {
    setEvent(() => events.find((e) => e.id === eventId));
  }, []);

  return (
    <div className="w-full">
      {step !== 4 && (
        <PillStepper
          currentStep={step - 1}
          steps={[{ label: "כרטיסים" }, { label: "טיסות" }, { label: "מלון" }]}
        />
      )}
      <OrderContext.Provider
        value={{
          setStep,
          step,
          setEvent,
          setFlight,
          setHotel,
          event,
          flight,
          hotel,
          numberOfEventTickets,
          setNumberOfEventTickets,
          planeTickets,
          setPlaneTickets,
        }}
      >
        {children}
      </OrderContext.Provider>
    </div>
  );
};
export default OrderLayout;
