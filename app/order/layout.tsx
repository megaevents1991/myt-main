"use client";

import { ReactNode, useEffect, useState } from "react";
import { OrderContext } from "../app.context";
import {
  Event,
  OrderTicket,
  Flight,
  OrderHotel,
  FlightSearchCriteria,
  HotelSearchCriteria,
} from "@/lib/app.types";
import { useSearchParams } from "next/navigation";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/carousel/styles.css";
import { Stepper } from "@/components/ui/Stepper";
import { HotelFetchProvider } from "../HotelFetch.provider";

const OrderLayout = ({ children }: { children: ReactNode }) => {
  const [flight, setFlight] = useState<Flight | undefined>({} as Flight);
  const [event, setEvent] = useState<Event | undefined>(undefined);
  const [hotel, setHotel] = useState<OrderHotel | undefined>({} as OrderHotel);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [numberOfEventTickets, setNumberOfEventTickets] = useState(2);
  const [planeTickets, setPlaneTickets] = useState({ adults: 2, children: 0 });
  const [numOfGuests, setNumOfGuests] = useState(2);
  const [step, setStep] = useState(1);
  const [eventTicket, setEventTicket] = useState({} as OrderTicket);
  const eventId = useSearchParams().get("eventId") as string;
  const [selectedPlaneTicketsFilters, setSelectedPlaneTicketsFilters] =
    useState<Partial<FlightSearchCriteria>>({});
  const [selectedHotelFilters, setSelectedHotelFilters] = useState<
    Partial<HotelSearchCriteria>
  >({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const id = eventId || "";
        if (!id) {
          console.error("Event ID is missing");
          return;
        }
        const response = await fetch(`/api/events?id=${id}`);
        const { events }: { events: Event[] } = await response.json();
        setEvent(() => events.find((e) => e.id === +eventId));
      } catch (error) {
        console.error("Error fetching cards:", error);
        // Better user error (via the client).
      }
    };
    fetchData();
  }, []);

  const handleStepperClick = (index: number) => {
    if (index + 1 < step) {
      setStep(index + 1);
    }
  };

  return (
    <div className="w-full">
      {step !== 4 && (
        <Stepper currentStep={step} onStepperClick={handleStepperClick} />
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
          setPaymentMethod,
          paymentMethod,
          event,
          flight,
          selectedPlaneTicketsFilters,
          setSelectedPlaneTicketsFilters,
          selectedHotelFilters,
          setSelectedHotelFilters,
          hotel,
          numberOfEventTickets,
          setNumberOfEventTickets,
          planeTickets,
          setPlaneTickets,
          numOfGuests,
          setNumOfGuests,
        }}
      >
        <HotelFetchProvider>{children}</HotelFetchProvider>
      </OrderContext.Provider>
    </div>
  );
};
export default OrderLayout;
