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

const buttonText: Record<number, string> = {
  1: "לבחירת טיסה",
  2: "לבחירת מלון",
  3: "לסיכום הזמנה",
  4: "שלח הזמנה",
} as const;

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
  } = useContext(OrderContext);


  const { affDiscount, affId } = useFetchAffiliate();
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

  function shortenAirlineName(name: string | undefined) {
    if (!name) {
      return "";
    }

    const words = name.split(/\s+/); // Split by spaces
    let shortName = "";
    let charCount = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // If it's the first word and longer than 6 chars, return it directly
      if (i === 0 && word.length > 6) {
        return word;
      }

      if (charCount + word.length > 6) {
        if (word.length >= 10) {
          return shortName.trim(); // Stop if the word is very long (10+ chars)
        } else {
          return (shortName + " " + word[0] + ".").trim(); // Add first letter of next word + "."
        }
      }

      shortName += (shortName ? " " : "") + word;
      charCount += word.length;
    }

    return shortName.trim();
  }

  const buttonDisabled =
    (!flight?.id && step === 2) || (!hotel?.id && step === 3);

  const airline = shortenAirlineName(flight?.metadata?.name);

  const ticketCategory = eventTicket.category;

  const minTicketPrice = Math.min(
    ...event.tickets_and_rates.map((ticket) => ticket.price)
  );

  const ticketRelativePrice = eventTicket.price - minTicketPrice;

  const basePrice = Math.ceil(
    event.base_flight_price +
      event.base_hotel_price +
      minTicketPrice +
      Number(process.env.NEXT_PUBLIC_MARKUP || "150")
  ).toLocaleString("en-US");

  const nextStep = () =>
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
          ticketAdditionalPrice: eventTicketPriceAddition,
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
            isDefaultDate: event.def_date_depart === flight.outbound.departureTime && event.def_date_return === flight.inbound.departureTime,
            flightStops: flight.outbound.stops.length,
            selectedFilters: selectedPlaneTicketsFilters,
            flightAddionalPrice: flightPriceAddition,
            includedCheckedBags: flight.bags,
          });
        }
      } else if (prev === 3) {
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
          data: { hotel: hotel?.id },
        });
        if (hotel) {
          trackEvent("hotelSelected", {
            hotelId: hotel.id,
            hotelName: hotel.name,
            checkInDate: hotel.checkin,
            checkOutDate: hotel.checkout,
            numOfNights,
            numOfRooms: hotel.guests.length,
            numOfPeople: totalGuests,
            isCorrespondingToFlight,
            hotelInformation: hotel.hotelInformation,
            hotelAddionalPrice: hotelPriceAddition,
          });
        }
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
          fullPacagePrice: recommendedPriceAllPax,
          paymentMethod: "", // @TODO: Add payment method
          affiliateDiscount: affDiscount * numberOfEventTickets,
          affiliateId: affId,
        });
      }
      return prev + 1;
    });

  return (
    <div className="max-w-7xl mx-auto px-2 pt-3">
      {step === 1 && <TicketSelection />}
      {step === 2 && <FlightSelection />}
      {step === 3 && <HotelSelection />}
      {step === 4 && <OrderReview />}

      {/* Sticky Footer */}
      <div className="flex w-full flex-col items-center bottom-0 sticky z-0">
        <div className="bottom-20 left-4 z-50 flex sm:hidden w-full">
          <ContactUs />
        </div>
        <div className="mt-4 w-screen bg-gray-200">
          <div className="w-full">
            {step < 4 && (
              <div className="flex flex-col lg:flex-row p-2 m-auto max-w-7xl justify-between items-center gap-2">
                <div className="flex flex-row-reverse lg:flex-row w-full justify-between items-center">
                  {/* Button Section */}
                  <button
                    disabled={buttonDisabled}
                    onClick={nextStep}
                    className={cn(
                      "bg-main text-white tracking-wide rounded-lg p-2 font-bold",
                      "w-[40%] lg:w-[30%] ml-4 lg:ml-0",
                      buttonDisabled && "opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {buttonText[step]}
                  </button>

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
                            {ticketCategory}
                          </span>
                          <Image
                            alt="ticket icon"
                            src={`/ticket.svg`}
                            width={16}
                            height={16}
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
