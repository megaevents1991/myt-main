/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { PillStepper } from "@/components/ui/pillStepper";
import { ReactNode, useEffect, useState } from "react";
import { OrderContext } from "../app.context";
import { Event, OrderTicket, Flight, OrderHotel } from "@/lib/app.types";
import { useSearchParams } from "next/navigation";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/carousel/styles.css";

const OrderLayout = ({ children }: { children: ReactNode }) => {
  const [flight, setFlight] = useState<Flight | undefined>({} as Flight);
  const [event, setEvent] = useState<Event | undefined>(undefined);
  const [hotel, setHotel] = useState<OrderHotel | undefined>({} as OrderHotel);
  const [numberOfEventTickets, setNumberOfEventTickets] = useState(1);
  const [planeTickets, setPlaneTickets] = useState({ adults: 1, children: 0 });
  const [step, setStep] = useState(1);
  const [eventTicket, setEventTicket] = useState({} as OrderTicket);
  const eventId = useSearchParams().get("eventId") as string;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/events");
        const { events }: { events: Event[] } = await response.json();
        setEvent(() => events.find((e) => e.id == eventId));
      } catch (error) {
        console.error("Error fetching cards:", error);
        // Better user error (via the client).
      }
    };
    fetchData();
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
          eventTicket,
          setEventTicket,
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
