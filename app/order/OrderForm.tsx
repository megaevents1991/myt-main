"use client";

import { useContext, useEffect } from "react";
import { TicketSelection } from "./TicketSelection";
import { FlightSelection } from "./FlightSelection";
import { HotelSelection } from "./HotelSelection";
import OrderReview from "./OrderReview";
import { OrderContinueBar, type ContinueSlot } from "./OrderContinueBar";
import { Event, Flight } from "@/lib/app.types";
import { OrderContext } from "../app.context";
import { orderStage } from "../hooks/Affiliate";
import { ContactUs } from "@/components/ui/ContactUs";
import { trackEvent } from "@/lib/mixpanel";
import { useFetchAffiliate, useOrderVars } from "./hooks";
import { useHandleExistingOrder } from "../hooks/useHandleExistingOrder";
import { shortenAirlineName } from "./order-review.utils";
import { HotelFetchContext } from "../hooks/HotelFetch.provider";
import { getDefaultDateRange } from "@/lib/getDefaultDateRange";
import { getRoomParams } from "@/lib/getRoomParams";
import { getTotalMarkup } from "@/lib/events/price";

const shortenTicketCategory = (category: string): string => {
  // Return text up to the first comma if comma exists
  const commaIndex = category.indexOf(",");
  if (commaIndex !== -1) {
    return category.substring(0, commaIndex);
  }
  
  // Add more cases here in the future
  
  return category;
};

export const OrderForm = ({ event }: { event: Event }) => {
  const {
    step,
    setStep,
    setFlight,
    flight,
    hotel,
    eventTicket,
    numberOfEventTickets,
    currentMinTicketPrice,
    planeTickets,
    selectedPlaneTicketsFilters,
    selectedHotelFilters,
    paymentMethod,
    skipHotel,
    setSkipHotel,
    setHotel,
    skipFlight,
    setSkipFlight,
    flightSkipped,
    setFlightSkipped,
  } = useContext(OrderContext);

  useHandleExistingOrder();

  const { affDiscount, affId } = useFetchAffiliate(); // @TODO: should be removed and called once in ticket selection
  const {
    numberOfPersons,
    finalPurchasePriceCalc,
    getAffiliateDiscountTotalUsd,
    recommendedPriceAllPax,
    eventTicketPriceAddition,
    flightPriceAddition,
    numOfNights,
    isCorrespondingToFlight,
    airlineName,
    hotelPriceAddition,
    totalGuests,
  } = useOrderVars();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const isUS = event?.location?.country_code === "US";

  // Preload hotels as soon as the order flow starts so they're ready
  // by the time the customer reaches step 3 (especially after skip flight).
  useEffect(() => {
    if (isUS) return;
    if (!event?.id) return;
    if (hotelsData?.data?.data?.hotels) return;
    getHotels(
      {
        dateRange: getDefaultDateRange(event, undefined),
        guests: getRoomParams(planeTickets.adults || numberOfEventTickets || 1),
        location: event.location,
        eventId: event.id,
      },
      { immediate: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  useEffect(() => {
    // US events are sold without hotel; if we ever land on step 3, skip to review.
    if (isUS && step === 3) {
      setSkipHotel(true);
      setHotel(undefined);
      setStep(4);
    }
  }, [isUS, step, setHotel, setSkipHotel, setStep]);

  useEffect(() => {
    // Initialize skipFlight from event setting when event loads.
    if (event?.skip_flight) setSkipFlight(true);
  }, [event?.skip_flight, setSkipFlight]);

  const buttonDisabled =
    (!eventTicket.id && step === 1) || // Disable if no ticket selected on step 1
    (!flight?.id && step === 2) || 
    (!hotel?.id && !skipHotel && step === 3); // Allow progression if hotel is skipped

  const airline = shortenAirlineName(flight?.metadata?.name);

  const ticketCategory = eventTicket.category;

  const availableTickets = (event.tickets_and_rates || []).filter(
    (ticket) => ticket.available !== false
  );

  const dbMinTicketPrice =
    availableTickets.length > 0
      ? Math.min(...availableTickets.map((ticket) => ticket.price))
      : 0;

  const minTicketPrice = currentMinTicketPrice || dbMinTicketPrice;

  const ticketRelativePrice = (eventTicket.price || 0) - minTicketPrice;

  const basePriceNum = Math.ceil(
    event.base_flight_price +
      event.base_hotel_price +
      minTicketPrice +
      getTotalMarkup(event)
  );

  const flightDelta = Math.ceil(
    (flight?.price || 0) / planeTickets.adults - event.base_flight_price
  );

  const nextStep = (skipHotel = false) =>
    setStep((prev) => {
      if (prev === 1) {
        orderStage("TICKET_SELECTED", {
          data: {
            event: event.name,
            ticketsType: eventTicket.category,
            numOfTicket: numberOfEventTickets,
          },
        });
        const ticket = event.tickets_and_rates.find(
          (ticket) => ticket.id === eventTicket.id
        )!;
        trackEvent("ticketSelected", {
          ticketName: ticket.category,
          ticketDescription: ticket.description,
          numOfTickets: numberOfEventTickets,
          addionalPricePerTicket: eventTicketPriceAddition,
        });
      } else if (prev === 2 && !flightSkipped) {
        orderStage("FLIGHT_SELECTED", {
          data: { flight: flight?.id },
        });
        if (flight) {
          trackEvent("flightSelected", {
            selectedAirline: airlineName,
            numOfPeople: numberOfPersons,
            outboundDate: flight.outbound.departureTime,
            inboundDate: flight.inbound.departureTime,
            isDefaultDates:
              new Date(event.def_date_depart).toDateString() ===
                new Date(flight.outbound.departureTime).toDateString() &&
              new Date(event.def_date_return).toDateString() ===
                new Date(flight.inbound.departureTime).toDateString(),
            flightStops: flight.outbound.stops.length - 1,
            includedCheckedBags: flight.outbound.checkBagsIncluded,
            includedCabinBags: flight.outbound.cabinBagsIncluded,
            selectedFilters: selectedPlaneTicketsFilters,
            flightAddionalPrice: flightPriceAddition,
          });
        }

        if (isUS) {
          setSkipHotel(true);
          setHotel(undefined);

          orderStage("HOTEL_SELECTED", {
            data: { hotel: null },
          });
          trackEvent("hotelSelected", {
            hotelId: null,
            hotelName: null,
            checkInDate: null,
            checkOutDate: null,
            numOfNights: null,
            numOfRooms: null,
            numOfPeople: null,
            isCorrespondingToFlight: null,
            hotelInformation: null,
            hotelAddionalPrice: null,
            selectedFilters: null,
            skipped: true,
          });

          return prev + 2;
        }
      } else if (prev === 3) {
        // Handle both hotel selection AND skip
        if (skipHotel) {
          setSkipHotel(true);
          setHotel(undefined);
        }
        
        // Use skipHotel flag to determine if hotel data should be included
        const isHotelSkipped = skipHotel || !hotel;
        
        if (!flightSkipped) {
          fetch(`/api/flights/pricing`, {
            method: "POST",
            body: JSON.stringify({
              flightOffer: flight?.offer,
              virtual: flight?.virtualOfferType || false,
            }),
          }).then((res) => {
            if (res.ok) {
              res.json().then((data) => {
                setFlight((prev = {} as Flight) => ({
                  ...prev,
                  penalties: data?.penalties,
                  bags: data?.bags,
                }));
              });
            }
          });
        }
        orderStage("HOTEL_SELECTED", {
          data: { hotel: isHotelSkipped ? null : hotel?.id || null },
        });
        // Centralized hotel tracking - handles both selected and skipped
        trackEvent("hotelSelected", {
          hotelId: isHotelSkipped ? null : hotel?.id || null,
          hotelName: isHotelSkipped ? null : hotel?.name || null,
          checkInDate: isHotelSkipped ? null : hotel?.checkin || null,
          checkOutDate: isHotelSkipped ? null : hotel?.checkout || null,
          numOfNights: isHotelSkipped ? null : numOfNights,
          numOfRooms: isHotelSkipped ? null : hotel?.guests.length || null,
          numOfPeople: isHotelSkipped ? null : totalGuests,
          isCorrespondingToFlight: isHotelSkipped ? null : isCorrespondingToFlight,
          hotelInformation: isHotelSkipped ? null : hotel?.hotelInformation || null,
          hotelAddionalPrice: isHotelSkipped ? null : hotelPriceAddition,
          selectedFilters: isHotelSkipped ? null : selectedHotelFilters,
          skipped: isHotelSkipped,
        });
      } else if (prev === 4) {
        orderStage("CONFIRMED", {
          // TO DO: NOT WORKING at the MOMENT - Check with Yakov
          data: {
            confirmed: "checkout",
            eventName: event.name,
            numOfTicket: numberOfEventTickets,
          },
        });
        trackEvent("eventCheckout", {
          usrFinalPrice: finalPurchasePriceCalc(affDiscount),
          fullPackagePrice: recommendedPriceAllPax,
          paymentMethod,
          affiliateDiscount: getAffiliateDiscountTotalUsd(affDiscount),
          affiliateId: affId,
          eventTags: event.tags,
        });
      }
      return prev + 1;
    });

  const handleSkipHotel = () => {
    nextStep(true);
  };

  const { getHotels, hotelsData } = useContext(HotelFetchContext);

  const handleSkipFlight = () => {
    setFlightSkipped(true);
    setFlight(undefined);
    orderStage("FLIGHT_SELECTED", { data: { flight: null } });
    trackEvent("flightSelected", { skipped: true, numOfPeople: numberOfPersons });
    // No flight selected → fetch hotels with event default dates
    if (!isUS && !hotelsData?.data?.data?.hotels) {
      getHotels(
        {
          dateRange: getDefaultDateRange(event, undefined),
          guests: getRoomParams(planeTickets.adults || numberOfEventTickets),
          location: event.location,
          eventId: event.id,
        },
        { immediate: true }
      );
    }
    setStep((prev) => prev + 1);
  };

  /* ── Continue-bar model (steps 1–3) ─────────────────────────────────
     Slots fill as the customer picks; the last step folds into the
     summary with a short "building the package" animation. */
  const priceNote = (delta: number) =>
    delta > 0
      ? `+$${delta.toLocaleString("en-US")}`
      : delta < 0
        ? `-$${Math.abs(delta).toLocaleString("en-US")}`
        : "כלול";

  const continueSlots: ContinueSlot[] = [
    {
      icon: "ticket",
      label: "כרטיס",
      filled: !!eventTicket.id,
      value: eventTicket.id ? shortenTicketCategory(ticketCategory || "") : "",
      delta: eventTicket.id ? priceNote(ticketRelativePrice) : undefined,
    },
    {
      icon: "flight",
      label: "טיסה",
      filled: flightSkipped || !!flight?.id,
      value: flightSkipped ? "ללא טיסה" : flight?.id ? airline : "",
      delta: !flightSkipped && flight?.id ? priceNote(flightDelta) : undefined,
    },
  ];
  if (!isUS) {
    continueSlots.push({
      icon: "hotel",
      label: "מלון",
      filled: skipHotel || !!hotel?.id,
      value: skipHotel ? "ללא מלון" : hotel?.id ? hotel?.name || "מלון" : "",
      delta: !skipHotel && hotel?.id ? priceNote(hotelPriceAddition) : undefined,
    });
  }

  // Running total = base package + the same upgrade deltas shown per slot
  // (no new price math — just sums figures already derived above).
  const displayTotal =
    basePriceNum +
    (ticketRelativePrice > 0 ? ticketRelativePrice : 0) +
    // Flight/hotel deltas may be negative (pick cheaper than base) → reduce the
    // live total, mirroring the real charge in calculateBaseTotal (hooks.tsx).
    (flight?.id && !flightSkipped ? flightDelta : 0) +
    (hotel?.id && !skipHotel ? hotelPriceAddition : 0);

  const isFinalStep = isUS ? step === 2 : step === 3;
  const primaryLabel =
    step === 1
      ? "בחר והמשך לטיסה"
      : step === 2
        ? isUS
          ? "בחר והמשך לסיכום"
          : "בחר והמשך למלון"
        : "בחר והמשך לסיכום";
  const skipAction =
    step === 3
      ? { label: "לא צריך מלון", onSkip: handleSkipHotel }
      : step === 2 && skipFlight
        ? { label: "לא צריך טיסה", onSkip: handleSkipFlight }
        : undefined;

  return (
    <>
      <div className="max-w-7xl mx-auto px-2 pt-3">
        {step === 1 && <TicketSelection initialEvent={event} />}
        {step === 2 && <FlightSelection />}
        {step === 3 && <HotelSelection />}
        {step === 4 && <OrderReview />}
        {/* Floating ContactUs - separate from footer */}
        {step !== 4 && (
          <div className="fixed bottom-24 left-2 z-50 sm:hidden">
            <ContactUs inHeader={false} />
          </div>
        )}
      </div>
      {/* Sticky continue bar (steps 1–3) — full-width strip, inner card
         viewport-centered via its own `mx-auto max-w-5xl`. Lives OUTSIDE the
         max-w-7xl wrapper so `w-full` = viewport, not the centered container. */}
      {step < 4 && (
        <div className="sticky bottom-0 z-40 w-full border-t border-border bg-background/85 backdrop-blur">
          <OrderContinueBar
            slots={continueSlots}
            total={displayTotal}
            primaryLabel={primaryLabel}
            primaryDisabled={buttonDisabled}
            onPrimary={() => nextStep()}
            skip={skipAction}
            isFinalStep={isFinalStep}
          />
        </div>
      )}
    </>
  );
};
