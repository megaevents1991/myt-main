"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { defaultCity, LodgingCity, NightAssign } from "@/lib/events/lodging";
import { ownedByLink, type OrderResume } from "@/lib/order/draft";
import {
  clearStoredOrder,
  readOrderDraft,
  writeOrderDraft,
} from "@/lib/order/draftStorage";
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

  // ── Order draft (lib/order/draft.ts): a refresh keeps the order ────────────
  // The pick the customer was in the middle of on steps 1-2, for that step only.
  const [orderResume, setOrderResume] = useState<OrderResume | null>(null);
  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(null);
  // Saving starts only after the stored draft was looked at - earlier it would
  // overwrite it with the empty order every page opens on.
  const [draftOn, setDraftOn] = useState(false);
  const draftClosedRef = useRef(false);

  // When the event lands: bring back the order this tab was holding for it, or
  // start from the event's default lodging city. An effect, never an initial
  // state - the first render must match the server's step-1 HTML. It runs after
  // the ticket step's own auto-select (child effects first), so the restored
  // ticket is the one that stays.
  useEffect(() => {
    if (!event) return;
    // ?orderId / ?pkg bring their own order from the server: nothing is
    // restored over them and nothing of theirs is recorded.
    const owned = ownedByLink(window.location.search);
    const saved = owned ? null : readOrderDraft(event);
    if (!saved) {
      setLodgingCity(defaultCity(event));
      setDraftOn(!owned);
      return;
    }
    setNumberOfEventTickets(saved.numberOfEventTickets);
    setPlaneTickets(saved.planeTickets);
    setCurrentMinTicketPrice(saved.currentMinTicketPrice);
    setEventTicket(saved.eventTicket ?? ({} as OrderTicket));
    setFlight(saved.flight ?? undefined);
    setFlightSkipped(saved.flightSkipped);
    setHotel(saved.hotel ?? undefined);
    setSkipHotel(saved.skipHotel);
    setSkippedHotelPricePerGuest(saved.skippedHotelPricePerGuest);
    setLodgingCity(saved.lodgingCity);
    setHotelSegments(saved.hotelSegments);
    setSplitNights(saved.splitNights);
    setReturnToSummary(saved.returnToSummary);
    setStep(saved.step);
    setOrderResume(saved.resume);
    setDraftRestoredAt(Date.now());
    setDraftOn(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  // The hint belongs to the step the customer was on - moving on drops it.
  useEffect(() => {
    if (orderResume && orderResume.step !== step) setOrderResume(null);
  }, [step, orderResume]);

  useEffect(() => {
    if (!draftOn || !event || draftClosedRef.current) return;
    writeOrderDraft(event.id, {
      step,
      returnToSummary,
      numberOfEventTickets,
      planeTickets,
      currentMinTicketPrice,
      eventTicket: eventTicket.id ? eventTicket : null,
      // The flight step clears the flight while it searches - a second refresh
      // in those seconds must still know which flight the customer had.
      flight: flight ?? (orderResume?.step === 2 ? orderResume.flight : null),
      flightSkipped,
      hotel: hotel ?? null,
      skipHotel,
      skippedHotelPricePerGuest,
      lodgingCity,
      hotelSegments,
      splitNights,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftOn,
    event?.id,
    step,
    returnToSummary,
    numberOfEventTickets,
    planeTickets,
    currentMinTicketPrice,
    eventTicket,
    flight,
    flightSkipped,
    hotel,
    skipHotel,
    skippedHotelPricePerGuest,
    lodgingCity,
    hotelSegments,
    splitNights,
    orderResume,
  ]);

  // The order went through: forget the draft and the typed form, and stop saving.
  const closeOrderDraft = useCallback(() => {
    draftClosedRef.current = true;
    if (event) clearStoredOrder(event.id);
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
          orderResume,
          draftRestoredAt,
          closeOrderDraft,
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
