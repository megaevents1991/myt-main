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
import { AnimatedPrice } from "@/components/ui/AnimatedPrice";

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
    selectedPlaneTicketsFilters,
    selectedHotelFilters,
    paymentMethod,
    planeTickets,
    numOfGuests,
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
    totalHotelGuests,
  } = useOrderVars();

  const finalPurchasePrice = finalPurchasePriceCalc(affDiscount, {
    attendents: step === 1 ? numberOfEventTickets : undefined,
    travelers: step === 2 ? planeTickets.adults + planeTickets.children: undefined,
    guests: step === 3 ? numOfGuests : undefined,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const buttonDisabled =
    (!flight?.id && step === 2) || (!hotel?.id && step === 3);

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
            numOfPeople: totalHotelGuests,
            isCorrespondingToFlight,
            hotelInformation: hotel.hotelInformation,
            hotelAddionalPrice: hotelPriceAddition,
            selectedFilters: selectedHotelFilters,
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
          paymentMethod,
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
          <ContactUs inHeader={false} />
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
                  <div className="text-lg font-semibold text-gray-900 flex flex-row-reverse items-center">
                    <span className="text-sm text-gray-700 ml-2">סה"כ מחיר לאדם</span>
                    <AnimatedPrice value={`$${Math.ceil(
                        finalPurchasePrice / numberOfPersons
                      ).toLocaleString("en-US")}`} />
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
