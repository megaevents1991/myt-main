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
  const [artistSlug, setArtistSlug] = useState<string | undefined>(undefined);
  const [hotel, setHotel] = useState<OrderHotel | undefined>({} as OrderHotel);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [numberOfEventTickets, setNumberOfEventTickets] = useState(2);
  const [currentMinTicketPrice, setCurrentMinTicketPrice] = useState(0);
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
  const [skipFlight, setSkipFlight] = useState(false);
  const [flightSkipped, setFlightSkipped] = useState(false);

  const { isOrderExpired, expiryDetails, clearExpiry } = useOrderExpiry();

  const isUS = event?.location?.country_code === "US";

  const handleStepperClick = (index: number) => {
    if (index + 1 < step) {
      // For US events we don't have a hotel step (step 3). Prevent navigating back to it.
      const targetStep = index + 1;
      if (isUS && targetStep === 3) return;
      // Prevent navigating back to flight step if the client already skipped it.
      if (flightSkipped && targetStep === 2) return;
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
      <Stepper
        currentStep={step}
        onStepperClick={handleStepperClick}
        steps={isUS ? ["כרטיסים", "טיסה", "סיום"] : undefined}
        hideSteps={step === 4}
      />
      <OrderContext.Provider
        value={{
          eventTicket,
          setEventTicket,
          setStep,
          step,
          setEvent,
          artistSlug,
          setArtistSlug,
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
          currentMinTicketPrice,
          setCurrentMinTicketPrice,
          planeTickets,
          setPlaneTickets,
          globalLoader: isLoading,
          setGlobalLoader: setIsLoading,
          passengers,
          setPassengers,
          skipHotel,
          setSkipHotel,
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
