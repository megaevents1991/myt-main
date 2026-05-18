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
import { HotelFetchProvider } from "../hooks/HotelFetch.provider";
import { LoaderWrapper } from "@/components/ui/loader";
import { OrderExpiryProvider, useOrderExpiry } from "../hooks/useOrderExpiry";
import OrderExpiredNotice from "@/components/OrderExpiredNotice";

const OrderLayoutContent = ({ children }: { children: ReactNode }) => {
  const [flight, setFlight] = useState<Flight | undefined>({} as Flight);
  const [event, setEvent] = useState<Event | undefined>(undefined);
  const [selectedEvents, setSelectedEvents] = useState<Event[]>([]);
  const [activeTicketEventIndex, setActiveTicketEventIndex] = useState(0);
  const [selectedEventTickets, setSelectedEventTickets] = useState<
    Record<number, OrderTicket>
  >({});
  const [hotel, setHotel] = useState<OrderHotel | undefined>({} as OrderHotel);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [numberOfEventTickets, setNumberOfEventTickets] = useState(2);
  const [currentMinTicketPrices, setCurrentMinTicketPrices] = useState<
    Record<number, number>
  >({});
  const [planeTickets, setPlaneTickets] = useState({ adults: 2, children: 0 });
  const [step, setStep] = useState(1);
  const [eventTicket, setEventTicket] = useState({} as OrderTicket);
  const [selectedPlaneTicketsFilters, setSelectedPlaneTicketsFilters] =
    useState<Partial<FlightSearchCriteria>>({});
  const [selectedHotelFilters, setSelectedHotelFilters] = useState<
    Partial<HotelSearchCriteria>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [passengers, setPassengers] = useState<
    { [key: string]: string }[] | undefined
  >(undefined);
  const [skipHotel, setSkipHotel] = useState(false);
  const [forceSkipHotel, setForceSkipHotel] = useState(false);
  const [skipFlight, setSkipFlight] = useState(false);
  const [flightSkipped, setFlightSkipped] = useState(false);

  const { isOrderExpired, expiryDetails, clearExpiry } = useOrderExpiry();

  const isUS = event?.location?.country_code === "US";
  const isNoHotelFlow = isUS || forceSkipHotel;
  const isTicketOnlyNoHotel = flightSkipped && isNoHotelFlow;

  const handleStepperClick = (index: number) => {
    if (index + 1 < step) {
      // For US events we don't have a hotel step (step 3). Prevent navigating back to it.
      const targetStep = index + 1;
      if (isNoHotelFlow && targetStep === 3) return;
      // Ticket-only: prevent navigating back to the (skipped) flight step.
      if (isTicketOnlyNoHotel && targetStep === 2) return;
      setStep(targetStep);
    }
  };

  // If order is expired, show the expiry notice
  if (isOrderExpired) {
    return (
      <OrderExpiredNotice
        eventId={expiryDetails?.eventId}
        eventName={expiryDetails?.eventName}
        onRedirect={clearExpiry}
      />
    );
  }

  return (
    <div className="w-full">
      {step !== 4 && (
        <Stepper
          currentStep={step}
          onStepperClick={handleStepperClick}
          steps={
            isTicketOnlyNoHotel
              ? ["כרטיס", "סיום"]
              : flightSkipped
                ? ["כרטיס", "מלון", "סיום"]
                : isNoHotelFlow
                  ? ["כרטיס", "טיסה", "סיום"]
                  : undefined
          }
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
          setPaymentMethod,
          paymentMethod,
          event,
          selectedEvents,
          setSelectedEvents,
          activeTicketEventIndex,
          setActiveTicketEventIndex,
          selectedEventTickets,
          setSelectedEventTickets,
          flight,
          selectedPlaneTicketsFilters,
          setSelectedPlaneTicketsFilters,
          selectedHotelFilters,
          setSelectedHotelFilters,
          hotel,
          numberOfEventTickets,
          setNumberOfEventTickets,
          currentMinTicketPrices,
          setCurrentMinTicketPrices,
          planeTickets,
          setPlaneTickets,
          globalLoader: isLoading,
          setGlobalLoader: setIsLoading,
          passengers,
          setPassengers,
          skipHotel,
          setSkipHotel,
          forceSkipHotel,
          setForceSkipHotel,
          skipFlight,
          setSkipFlight,
          flightSkipped,
          setFlightSkipped,
        }}
      >
        <HotelFetchProvider>
          <LoaderWrapper isLoading={isLoading}>{children}</LoaderWrapper>
        </HotelFetchProvider>
      </OrderContext.Provider>
    </div>
  );
};

const OrderLayout = ({ children }: { children: ReactNode }) => {
  return (
    <OrderExpiryProvider>
      <OrderLayoutContent>{children}</OrderLayoutContent>
    </OrderExpiryProvider>
  );
};
export default OrderLayout;
