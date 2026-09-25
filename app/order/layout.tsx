"use client";

import { ReactNode, useEffect, useState } from "react";
import { defaultCity, LodgingCity, NightAssign } from "@/lib/events/lodging";
import { OrderContext, PersonLink } from "../app.context";
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
import { isTicketOnlyEvent } from "@/lib/events/price";
import { HotelFetchProvider } from "../hooks/HotelFetch.provider";
import { LoaderWrapper } from "@/components/ui/loader";
import { OrderExpiryProvider, useOrderExpiry } from "../hooks/useOrderExpiry";
import OrderExpiredNotice from "@/components/OrderExpiredNotice";

const OrderLayoutContent = ({ children }: { children: ReactNode }) => {
  // flight/hotel start undefined, NOT {} - an empty object is truthy and every
  // "is there a flight/hotel?" guard downstream must not need Object.keys().
  const [flight, setFlight] = useState<Flight | undefined>(undefined);
  const [event, setEvent] = useState<Event | undefined>(undefined);
  const [personLink, setPersonLink] = useState<PersonLink | undefined>(undefined);
  const [hotel, setHotel] = useState<OrderHotel | undefined>(undefined);
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
  const [skippedHotelPricePerGuest, setSkippedHotelPricePerGuest] = useState<
    number | null
  >(null);
  const [skipFlight, setSkipFlight] = useState(false);
  const [flightSkipped, setFlightSkipped] = useState(false);
  const [returnToSummary, setReturnToSummary] = useState(false);
  const [packageLocked, setPackageLocked] = useState(false);
  // Agent's price for a prepared package (doc 2026-08-30, item 4) - 0 unless
  // the visitor arrived on a ?pkg= link whose agent changed the price.
  const [packageAdjustPerPerson, setPackageAdjustPerPerson] = useState(0);
  // Lodging city + split stay (lib/events/lodging.ts). The city follows the
  // event's default once per event id - a re-set of the same event (live
  // ticket refresh) must not wipe the customer's choice.
  const [lodgingCity, setLodgingCity] = useState<LodgingCity>("flight");
  const [hotelSegments, setHotelSegments] = useState<OrderHotel[] | null>(null);
  const [splitNights, setSplitNights] = useState<NightAssign[] | null>(null);
  const [lodgingPlanned, setLodgingPlanned] = useState(false);
  useEffect(() => {
    if (event) setLodgingCity(defaultCity(event));
    setLodgingPlanned(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  const { isOrderExpired, expiryDetails, clearExpiry } = useOrderExpiry();

  const isUS = event?.location?.country_code === "US";
  // Ticket-only event: the stepper is "כרטיסים → סיום" (indexes 0/1 ↔ steps 1/4).
  const ticketOnly = !!event && isTicketOnlyEvent(event);

  const handleStepperClick = (index: number) => {
    // Edit-from-summary is a focused task - no wandering the flow mid-edit.
    // An agent-locked package is not the customer's to rearrange either.
    if (returnToSummary || packageLocked) return;
    if (ticketOnly) {
      if (index === 0 && step > 1) setStep(1);
      return;
    }
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
        currentStep={ticketOnly ? (step === 4 ? 2 : 1) : step}
        onStepperClick={handleStepperClick}
        steps={
          ticketOnly
            ? ["כרטיסים", "סיום"]
            : isUS
              ? ["כרטיסים", "טיסה", "סיום"]
              : undefined
        }
        // Hidden on the summary AND during edit-from-summary - an edit is a
        // focused single-step task, not a walk through the flow.
        hideSteps={step === 4 || returnToSummary}
      />
      <OrderContext.Provider
        value={{
          eventTicket,
          setEventTicket,
          setStep,
          step,
          setEvent,
          personLink,
          setPersonLink,
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
          skippedHotelPricePerGuest,
          setSkippedHotelPricePerGuest,
          skipFlight,
          setSkipFlight,
          flightSkipped,
          setFlightSkipped,
          returnToSummary,
          setReturnToSummary,
          packageLocked,
          setPackageLocked,
          packageAdjustPerPerson,
          setPackageAdjustPerPerson,
          lodgingCity,
          setLodgingCity,
          hotelSegments,
          setHotelSegments,
          splitNights,
          setSplitNights,
          lodgingPlanned,
          setLodgingPlanned,
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
