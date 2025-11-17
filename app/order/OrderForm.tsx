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
    numberOfEventTickets,
    planeTickets,
    selectedPlaneTicketsFilters,
    selectedHotelFilters,
    paymentMethod,
    skipHotel,
    setSkipHotel,
    setHotel,
  } = useContext(OrderContext);

  useHandleExistingOrder();

  const { affDiscount, affId } = useFetchAffiliate(); // @TODO: should be removed and called once in ticket selection
  const {
    numberOfPersons,
    finalPurchasePriceCalc,
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

  const buttonDisabled =
    (!eventTicket.id && step === 1) || // Disable if no ticket selected on step 1
    (!flight?.id && step === 2) || 
    (!hotel?.id && !skipHotel && step === 3); // Allow progression if hotel is skipped

  const airline = shortenAirlineName(flight?.metadata?.name);

  const ticketCategory = eventTicket.category;

  const minTicketPrice =
    event.tickets_and_rates?.length > 0
      ? Math.min(...event.tickets_and_rates
          .filter(ticket => ticket.available !== false)
          .map((ticket) => ticket.price)) : 0;

  const ticketRelativePrice = (eventTicket.price || 0) - minTicketPrice;

  const basePrice = Math.ceil(
    event.base_flight_price +
      event.base_hotel_price +
      minTicketPrice +
      Number(process.env.NEXT_PUBLIC_MARKUP || "150")
  ).toLocaleString("en-US");

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
      } else if (prev === 2) {
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
      } else if (prev === 3) {
        // Handle both hotel selection AND skip
        if (skipHotel) {
          setSkipHotel(true);
          setHotel(undefined);
        }
        
        // Use skipHotel flag to determine if hotel data should be included
        const isHotelSkipped = skipHotel || !hotel;
        
        // Common logic for step 3 completion (flight pricing, tracking, etc.)
        fetch(`/api/flights/pricing`, {
          method: "POST",
          body: JSON.stringify({
            flightOffer: flight?.offer,
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
          affiliateDiscount: affDiscount * numberOfEventTickets,
          affiliateId: affId,
          eventTags: event.tags,
        });
      }
      return prev + 1;
    });

  const handleSkipHotel = () => {
    nextStep(true);
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
                  {/* Button Section - Split on step 3 (hotel selection) */}
                  {step === 3 ? (
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
                      aria-label={buttonText[step]}
                    >
                      {buttonText[step]}
                    </button>
                  )}

                  {/* Order Summary Section */}
                  <div className="flex flex-col-reverse w-[60%] lg:w-[70%] lg:flex-row lg:justify-end text-secondary text-md">
                    {step > 2 && (
                      <div className="flex justify-between lg:justify-start items-center w-full lg:w-auto -mb-1">
                        <span className="text-left lg:ml-2">
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
                        <span className="text-left lg:ml-2">
                          {ticketRelativePrice > 0
                            ? formatPrice(ticketRelativePrice)
                            : "(כלול במחיר)"}
                        </span>
                        <div className="flex items-center justify-end">
                          <span className="text-right mr-2 lg:ml-2">
                            <span className="lg:hidden">{shortenTicketCategory(ticketCategory)}</span>
                            <span className="hidden lg:inline">{ticketCategory}</span>
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
                            {event.name}
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
