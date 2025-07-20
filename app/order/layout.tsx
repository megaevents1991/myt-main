"use client";

import { ReactNode, useState } from "react";
import { OrderContext } from "../app.context";
import {
  Event,
  OrderTicket,
  Flight,
  OrderHotel,
  FlightSearchCriteria,
  HotelSearchCriteria,
} from "@/lib/app.types";
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
  const [step, setStep] = useState(1);
  const [eventTicket, setEventTicket] = useState({} as OrderTicket);
  const [selectedPlaneTicketsFilters, setSelectedPlaneTicketsFilters] =
    useState<Partial<FlightSearchCriteria>>({});
  const [selectedHotelFilters, setSelectedHotelFilters] = useState<
    Partial<HotelSearchCriteria>
  >({});

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
        }}
      >
        <HotelFetchProvider>{children}</HotelFetchProvider>
      </OrderContext.Provider>
    </div>
  );
};
export default OrderLayout;
