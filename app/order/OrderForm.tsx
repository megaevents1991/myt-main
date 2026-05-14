"use client";

import { useContext, useEffect } from "react";
import { TicketSelection } from "./TicketSelection";
import { FlightSelection } from "./FlightSelection";
import { HotelSelection } from "./HotelSelection";
import OrderReview from "./OrderReview";
import { Event, Flight } from "@/lib/app.types";
import { OrderContext } from "../app.context";
import { orderStage } from "../hooks/Affiliate";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/price.utils";
import Image from "next/image";
import { ContactUs } from "@/components/ui/ContactUs";
import { trackEvent } from "@/lib/mixpanel";
import { useFetchAffiliate, useOrderVars } from "./hooks";
import { useHandleExistingOrder } from "../hooks/useHandleExistingOrder";
import { shortenAirlineName } from "./order-review.utils";
import { MONDIAL_2026_MAIN_TITLE, parseMondial2026EventName } from "@/lib/mondial2026Title";
import { HotelFetchContext } from "../hooks/HotelFetch.provider";
import { getDefaultDateRange } from "@/lib/getDefaultDateRange";
import { getRoomParams } from "@/lib/getRoomParams";
import { getTotalMarkupForEvents } from "@/lib/events/price";

const buttonText: Record<number, string> = {
  1: "לבחירת טיסה",
  2: "לבחירת מלון",
  3: "לסיכום הזמנה",
  4: "שלח הזמנה",
} as const;

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
    selectedEvents,
    activeTicketEventIndex,
    setActiveTicketEventIndex,
    selectedEventTickets,
    setSelectedEventTickets,
    numberOfEventTickets,
    planeTickets,
    selectedPlaneTicketsFilters,
    selectedHotelFilters,
    paymentMethod,
    skipHotel,
    setSkipHotel,
    forceSkipHotel,
    setForceSkipHotel,
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
  const isNoHotelFlow = isUS || forceSkipHotel;

  const mondialParsed = parseMondial2026EventName(event?.name);
  const isMondial2026 = mondialParsed.isMondial2026;
  const hasBundleEvents = !!(selectedEvents && selectedEvents.length > 1);
  const hideMobileAdditionalPrice = isMondial2026 && hasBundleEvents;
  const isTicketStepNotLastBundledEvent =
    step === 1 &&
    isMondial2026 &&
    hasBundleEvents &&
    activeTicketEventIndex < (selectedEvents?.length || 0) - 1;

  // When all selected events allow ticket-only AND user is at the flight step,
  // the primary CTA on step 1 shouldn't promise a flight selection next.
  const willEnterTicketOnly = skipFlight && flightSkipped;
  const primaryCtaLabel =
    step === 1 && isMondial2026
      ? (isTicketStepNotLastBundledEvent
          ? "לאירוע הבא"
          : skipFlight
            ? "המשך"
            : "בחר טיסה")
      : step === 2 && (isNoHotelFlow || willEnterTicketOnly)
        ? "לסיכום הזמנה"
        : buttonText[step];

  // Preload hotels as soon as the order flow starts so they're ready
  // by the time the customer reaches step 3 (especially after skip flight).
  useEffect(() => {
    if (isUS) return;
    if (!event?.id) return;
    if (hotelsData?.data?.data?.hotels) return;
    getHotels({
      dateRange: getDefaultDateRange(event, undefined),
      guests: getRoomParams(planeTickets.adults || numberOfEventTickets || 1),
      location: event.location,
      eventId: event.id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  useEffect(() => {
    // US events are sold without hotel; if we ever land on step 3, skip to review.
    if (isNoHotelFlow && step === 3) {
      setSkipHotel(true);
      setHotel(undefined);
      if (forceSkipHotel) setForceSkipHotel(true);
      setStep(4);
    }
  }, [isNoHotelFlow, step, setHotel, setSkipHotel, setStep, forceSkipHotel, setForceSkipHotel]);

  useEffect(() => {
    // Initialize skipFlight from event setting when event loads.
    if (event?.skip_flight) setSkipFlight(true);
  }, [event?.skip_flight, setSkipFlight]);

  const buttonDisabled =
    (!eventTicket.id && step === 1) || // Disable if no ticket selected on step 1
    (!flight?.id && !flightSkipped && step === 2) || // Allow progression if flight is skipped
    (!hotel?.id && !skipHotel && step === 3); // Allow progression if hotel is skipped

  const airline = shortenAirlineName(flight?.metadata?.name);

  const effectiveEvents: Event[] =
    selectedEvents && selectedEvents.length > 0 ? selectedEvents : [event];

  const minTicketPriceForEvent = (evt: Event): number => {
    const rates = (evt.tickets_and_rates || []).filter((t) => t?.available !== false);
    if (rates.length === 0) return 0;
    return Math.min(...rates.map((t) => t.price));
  };

  const ticketSummary = (() => {
    const isBundle = effectiveEvents.length > 1;
    const categories = effectiveEvents
      .map((evt) => {
        const selected = selectedEventTickets?.[evt.id];
        const category = selected?.category || (isBundle ? "" : eventTicket.category);
        return category;
      })
      .filter((c) => typeof c === "string" && c.length > 0);

    // Sticky footer shows PER-PERSON deltas (flight delta is per-person),
    // so ticket delta must also be per-person.
    const relativeSum = effectiveEvents.reduce((sum, evt) => {
      const min = minTicketPriceForEvent(evt);
      const selected = selectedEventTickets?.[evt.id];
      const price = selected?.price ?? (isBundle ? min : (eventTicket.price || 0));
      return sum + (price - min);
    }, 0);

    return {
      relativeSum,
      categoriesFull: categories.join(", "),
      categoriesShort: categories.map(shortenTicketCategory).join(", "),
    };
  })();

  const basePrice = (() => {
    const markup = getTotalMarkupForEvents(effectiveEvents);
    const isBundle = effectiveEvents.length > 1;

    if (isBundle) {
      const maxBaseFlightPrice = flightSkipped
        ? 0
        : Math.max(
            0,
            ...effectiveEvents.map((evt) => evt.base_flight_price || 0)
          );
      const sumMinTicketPrices = effectiveEvents.reduce(
        (sum, evt) => sum + minTicketPriceForEvent(evt),
        0
      );

      return Math.ceil(maxBaseFlightPrice + sumMinTicketPrices + markup).toLocaleString(
        "en-US"
      );
    }

    // Keep legacy base price logic here (single-event baseline)
    return Math.ceil(
      (flightSkipped ? 0 : event.base_flight_price) +
        event.base_hotel_price +
        minTicketPriceForEvent(event) +
        markup
    ).toLocaleString("en-US");
  })();

  const nextStep = (skipHotel = false, skipFlightArg = false) =>
    setStep((prev) => {
      // Effective skip-flight: either persisted state OR an immediate override
      // (used by handleSkipFlight, where context state hasn't propagated yet).
      const effectiveFlightSkipped = flightSkipped || skipFlightArg;
      if (prev === 1) {
        const currentTicketEvent =
          selectedEvents && selectedEvents.length > 0
            ? selectedEvents[activeTicketEventIndex]
            : event;

        // Persist per-event ticket selection (for multi-event bundles)
        if (currentTicketEvent?.id) {
          setSelectedEventTickets((prevTickets) => ({
            ...prevTickets,
            [currentTicketEvent.id]: {
              ...eventTicket,
              quantity: numberOfEventTickets,
            },
          }));
        }

        orderStage("TICKET_SELECTED", {
          data: {
            event: currentTicketEvent.name,
            ticketsType: eventTicket.category,
            numOfTicket: numberOfEventTickets,
          },
        });
        const ticket = currentTicketEvent.tickets_and_rates.find(
          (ticket) => ticket.id === eventTicket.id
        )!;
        trackEvent("ticketSelected", {
          ticketName: ticket.category,
          ticketDescription: ticket.description,
          numOfTickets: numberOfEventTickets,
          addionalPricePerTicket: eventTicketPriceAddition,
        });

        // Multi-event bundle: stay on step 1 until all events have ticket selections
        if (selectedEvents && selectedEvents.length > 1) {
          const nextIndex = activeTicketEventIndex + 1;
          if (nextIndex < selectedEvents.length) {
            setActiveTicketEventIndex(nextIndex);
            return prev; // keep step = 1
          }
        }
      } else if (prev === 2) {
        orderStage("FLIGHT_SELECTED", {
          data: { flight: effectiveFlightSkipped ? null : flight?.id },
        });
        if (effectiveFlightSkipped) {
          trackEvent("flightSelected", {
            skipped: true,
            numOfPeople: numberOfPersons,
          });
        } else if (flight) {
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

        if (isNoHotelFlow) {
          setSkipHotel(true);
          setHotel(undefined);
          if (forceSkipHotel) setForceSkipHotel(true);

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
        
        // Common logic for step 3 completion (flight pricing, tracking, etc.)
        if (!flightSkipped && flight?.offer) {
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
    // No flight selected → fetch hotels with event default dates
    if (!isUS && !hotelsData?.data?.data?.hotels) {
      getHotels({
        dateRange: getDefaultDateRange(event, undefined),
        guests: getRoomParams(planeTickets.adults || numberOfEventTickets),
        location: event.location,
        eventId: event.id,
      });
    }
    // Pass skipFlightArg so step-2 logic (tracking, isNoHotelFlow handling) fires with the new value
    // instead of depending on state propagation.
    nextStep(false, true);
  };

  return (
    <div className="max-w-7xl mx-auto px-2 pt-3">
      {step === 1 && <TicketSelection />}
      {step === 2 && <FlightSelection />}
      {step === 3 && <HotelSelection />}
      {step === 4 && <OrderReview />}
      {/* Floating ContactUs - separate from footer */}
      {step !== 4 && (
        <div className="fixed bottom-24 left-2 z-50 sm:hidden">
          <ContactUs inHeader={false} />
        </div>
      )}
      {/* Sticky Footer */}
      <div className="flex w-full flex-col items-center bottom-0 sticky z-40">
        <div className="mt-4 w-screen bg-gray-200">
          <div className="w-full">
            {step < 4 && (
              <div className="flex flex-col lg:flex-row p-2 m-auto max-w-7xl justify-between items-center gap-2">
                <div className="flex flex-row-reverse lg:flex-row w-full justify-between items-center">
                  {/* Button Section - Split on step 3 (hotel selection) and on step 2 when skip-flight is allowed */}
                  {step === 2 && skipFlight && !flightSkipped ? (
                    <div className="w-[40%] lg:w-[30%] ml-4 lg:ml-0 flex flex-col lg:flex-row gap-2">
                      <button
                        disabled={buttonDisabled}
                        onClick={() => nextStep()}
                        className={cn(
                          "bg-main text-white tracking-wide rounded-lg p-2 font-bold flex-[3]",
                          buttonDisabled && "opacity-50 disabled:cursor-not-allowed"
                        )}
                        type="button"
                        aria-label={primaryCtaLabel}
                      >
                        {primaryCtaLabel}
                      </button>
                      <button
                        onClick={handleSkipFlight}
                        className="border-2 border-main text-main tracking-wide rounded-lg p-2 font-bold flex-[2] hover:bg-main/5 transition-colors text-sm lg:text-base"
                        type="button"
                        aria-label="המשך ללא טיסה"
                      >
                        ללא טיסה
                      </button>
                    </div>
                  ) : step === 3 ? (
                    // Hotel Selection Step: Show split buttons (desktop) or stacked (mobile)
                    <div className="w-[40%] lg:w-[30%] ml-4 lg:ml-0 flex flex-col lg:flex-row gap-2">
                      <button
                        disabled={buttonDisabled}
                        onClick={() => nextStep()}
                        className={cn(
                          "bg-main text-white tracking-wide rounded-lg p-2 font-bold flex-[3]",
                          buttonDisabled && "opacity-50 disabled:cursor-not-allowed"
                        )}
                        type="button"
                        aria-label="בחר והמשך לסיכום"
                        >
                        <span className="min-[400px]:inline hidden">בחר והמשך לסיכום</span>
                        <span className="min-[400px]:hidden">בחר והמשך</span>
                      </button>
                      <button
                        onClick={handleSkipHotel}
                        className="border-2 border-main text-main tracking-wide rounded-lg p-2 font-bold flex-[2] hover:bg-main/5 transition-colors text-sm lg:text-base"
                        type="button"
                        aria-label="המשך ללא מלון"
                      >
                        לא צריך מלון
                      </button>
                    </div>
                  ) : step === 2 && skipFlight ? (
                    // Flight Selection Step with skip enabled: Show split buttons
                    <div className="w-[40%] lg:w-[30%] ml-4 lg:ml-0 flex flex-col lg:flex-row gap-2">
                      <button
                        disabled={buttonDisabled}
                        onClick={() => nextStep()}
                        className={cn(
                          "bg-main text-white tracking-wide rounded-lg p-2 font-bold flex-[3]",
                          buttonDisabled && "opacity-50 disabled:cursor-not-allowed"
                        )}
                        type="button"
                        aria-label="בחר והמשך לבחירת מלון"
                      >
                        <span className="min-[400px]:inline hidden">בחר והמשך לבחירת מלון</span>
                        <span className="min-[400px]:hidden">בחר והמשך</span>
                      </button>
                      <button
                        onClick={handleSkipFlight}
                        className="border-2 border-main text-main tracking-wide rounded-lg p-2 font-bold flex-[2] hover:bg-main/5 transition-colors text-sm lg:text-base"
                        type="button"
                        aria-label="המשך ללא טיסה"
                      >
                        לא צריך טיסה
                      </button>
                    </div>
                  ) : (
                    // Other steps: Show single button
                    <button
                      disabled={buttonDisabled}
                      onClick={() => nextStep()}
                      className={cn(
                        "bg-main text-white tracking-wide rounded-lg p-2 font-bold",
                        "w-[40%] lg:w-[30%] ml-4 lg:ml-0",
                        buttonDisabled && "opacity-50 disabled:cursor-not-allowed"
                      )}
                      type="button"
                      aria-label={primaryCtaLabel}
                    >
                      {primaryCtaLabel}
                    </button>
                  )}

                  {/* Order Summary Section */}
                  <div className="flex flex-col-reverse w-[60%] lg:w-[70%] lg:flex-row lg:justify-end text-secondary text-md">
                    {step > 2 && !flightSkipped && (
                      <div className="flex justify-between lg:justify-start items-center w-full lg:w-auto -mb-1">
                        <span
                          className={cn(
                            "text-left lg:ml-2",
                            hideMobileAdditionalPrice && "hidden lg:inline"
                          )}
                        >
                          {formatPrice(
                            Math.ceil(
                              (flight?.price || 0) / planeTickets.adults -
                                event.base_flight_price
                            )
                          )}
                        </span>
                        <div className="flex items-center justify-end">
                          <span className="text-right mr-2 lg:ml-2">
                            {airline}
                          </span>
                          <Image
                            alt="plane icon"
                            src={`/plane.svg`}
                            width={16}
                            height={16}
                            unoptimized
                          />
                        </div>
                        <span className="hidden lg:inline ml-2">|</span>
                      </div>
                    )}
                    {step > 1 && (
                      <div className="flex justify-between lg:justify-start items-center w-full lg:w-auto -mb-1">
                        <span
                          className={cn(
                            "text-left lg:ml-2",
                            hideMobileAdditionalPrice && "hidden lg:inline"
                          )}
                        >
                          {ticketSummary.relativeSum > 0
                            ? formatPrice(ticketSummary.relativeSum)
                            : "(כלול במחיר)"}
                        </span>
                        <div className="flex items-center justify-end">
                          <span className="text-right mr-2 lg:ml-2">
                            <span className="lg:hidden">
                              {hideMobileAdditionalPrice
                                ? ticketSummary.categoriesFull
                                : ticketSummary.categoriesShort}
                            </span>
                            <span className="hidden lg:inline">{ticketSummary.categoriesFull}</span>
                          </span>
                          <Image
                            alt="ticket icon"
                            src={`/ticket.svg`}
                            width={16}
                            height={16}
                            unoptimized
                          />
                        </div>
                        <span className="hidden lg:inline ml-2">|</span>
                      </div>
                    )}
                    {step > -1 && (
                      <div className="flex justify-between lg:justify-start items-center w-full lg:w-auto">
                        <span className="text-left lg:ml-2 font-bold tracking-wide">
                          ${basePrice}
                        </span>
                        <div className="flex items-center justify-end lg:ml-2">
                          <span className="text-right font-bold">
                            {isMondial2026 ? MONDIAL_2026_MAIN_TITLE : event.name}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
