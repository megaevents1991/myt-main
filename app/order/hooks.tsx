"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { OrderContext } from "../app.context";
import { getTotalPersons } from "@/lib/price.utils";
import {
  priceOutsidePackBoundaries,
  shortenAirlineName,
} from "./order-review.utils";
import { superTrack } from "@/lib/mixpanel";

export function useOrderVars() {
  const {
    flight: selectedFlight,
    hotel: selectedHotel,
    eventTicket,
    event,
    numberOfEventTickets,
  } = useContext(OrderContext);

  /* Calculate total guests */
  const totalGuests = useMemo(() => {
    if (!selectedHotel) {
      return 0;
    }
    return getTotalPersons(selectedHotel.guests);
  }, [selectedHotel]);

  const hotelPriceAddition = useMemo(() => {
    if (!selectedHotel || !event) {
      return 0;
    }
    return priceOutsidePackBoundaries(
      +selectedHotel.price,
      event.base_hotel_price,
      totalGuests
    )
      ? +selectedHotel.price / totalGuests - event.base_hotel_price
      : 0;
  }, [selectedHotel, event, totalGuests]);

  const airlineName = useMemo(
    () => shortenAirlineName(selectedFlight?.metadata?.name),
    [selectedFlight?.metadata?.name]
  );

  const flightPriceAddition = useMemo(() => {
    if (!selectedFlight || !event) {
      return 0;
    }
    return priceOutsidePackBoundaries(
      selectedFlight.price,
      event.base_flight_price,
      selectedFlight.numOfTravelers
    )
      ? selectedFlight.price / selectedFlight.numOfTravelers -
          event.base_flight_price
      : 0;
  }, [selectedFlight, event]);

  /* Fetch lowest avaiable ticket price */
  const minTicketPrice = useMemo(() => {
    if (!event) {
      return 0;
    }
    return Math.min(...event.tickets_and_rates.map((ticket) => ticket.price));
  }, [event]);

  /* Main variables to calculate price additions */
  const eventTicketPriceAddition = eventTicket.price - minTicketPrice;

  const maup = Number(process.env.NEXT_PUBLIC_MARKUP || "150");

  const isNumberOfPersonsEqual = useMemo(() => {
    if (!selectedFlight) {
      return false;
    }
    return (
      totalGuests === numberOfEventTickets &&
      totalGuests === selectedFlight.numOfTravelers
    );
  }, [totalGuests, numberOfEventTickets, selectedFlight]);

  const numberOfPersons = useMemo(() => {
    if (!selectedFlight) {
      return 0;
    }
    return selectedFlight.numOfTravelers > numberOfEventTickets
      ? selectedFlight.numOfTravelers
      : numberOfEventTickets;
  }, [selectedFlight, numberOfEventTickets]);

  /* Fetch Pack recommended price */
  const packRecommendedPrice = useMemo(() => {
    if (!event) {
      return 0;
    }
    return Math.ceil(
      event.base_flight_price + event.base_hotel_price + minTicketPrice + maup
    );
  }, [event, minTicketPrice, maup]);

  const recommendedPriceAllPax = packRecommendedPrice * numberOfPersons;

  /* Calculation of final price for the customer after discounts and such */
  const finalPurchasePriceCalc = useCallback(
    (affDiscount: number) => {
      if (!eventTicket || !event || !selectedFlight) {
        return 0;
      }
      return Math.ceil(
        (eventTicket.price + maup - affDiscount || 0) * numberOfEventTickets +
          (flightPriceAddition + event.base_flight_price) *
            selectedFlight.numOfTravelers +
          (hotelPriceAddition + event.base_hotel_price) * totalGuests
      );
    },
    [
      eventTicket,
      maup,
      numberOfEventTickets,
      selectedFlight,
      flightPriceAddition,
      event,
      hotelPriceAddition,
      totalGuests,
    ]
  );
  const finalPurchasePriceILSCalc = useCallback(async (USDprice: number) => {
    try {
      const response = await fetch("/api/events-info");
      if (!response.ok) {
        throw new Error("Failed to fetch exchange rate from server");
      }
      const data = await response.json();

      return {
        ils: Math.ceil(USDprice * data.travelRate),
        travelRate: data.travelRate,
      };
    } catch (error) {
      console.error("General error fetching exchange rate:", error);
      // Fallback to a hardcoded rate
      const fallbackRate = 3.7;
      return {
        ils: Math.ceil(USDprice * fallbackRate),
        travelRate: fallbackRate,
      };
    }
  }, []);

  const numOfNights = useMemo(() => {
    if (!selectedHotel) {
      return 0;
    }
    const checkInDate = new Date(selectedHotel.checkin);
    checkInDate.setHours(0, 0, 0, 0); // Set time to midnight
    const checkOutDate = new Date(selectedHotel.checkout);
    checkOutDate.setHours(0, 0, 0, 0); // Set time to midnight
    const timeDiff = checkOutDate.getTime() - checkInDate.getTime();
    const daysDiff = timeDiff / (1000 * 3600 * 24); // Convert milliseconds to days
    return daysDiff;
  }, [selectedHotel]);

  const isCorrespondingToFlight = useMemo(() => {
    if (!selectedHotel || !selectedFlight) {
      return false;
    }
    return (
      new Date(selectedHotel.checkin).getDate() ===
        new Date(selectedFlight.outbound?.arrivalTime).getDate() &&
      new Date(selectedHotel.checkout).getDate() ===
        new Date(selectedFlight.inbound?.departureTime).getDate()
    );
  }, [selectedHotel, selectedFlight]);

  return {
    airlineName,
    eventTicketPriceAddition,
    packRecommendedPrice,
    recommendedPriceAllPax,
    isNumberOfPersonsEqual,
    numberOfPersons,
    totalGuests,
    numOfNights,
    isCorrespondingToFlight,
    finalPurchasePriceILSCalc,
    finalPurchasePriceCalc,
    hotelPriceAddition,
    flightPriceAddition,
  };
}

export function useFetchAffiliate() {
  const [affDiscount, setAffDiscount] = useState(0);
  const [agentCommission, setAgentCommission] = useState(0);
  const [affId, setAffId] = useState<string | null>(null);
  const [affType, setAffType] = useState<"agent" | "affiliate" | null>(null);

  useEffect(() => {
    let affiliateData;
    try {
      affiliateData = localStorage.getItem("mytData");
    } catch (error) {
      console.error("localStorage access error:", error);
      // add statsig event
    }
    if (affiliateData) {
      const parsedAffiliateData = JSON.parse(affiliateData);
      if (parsedAffiliateData.affiliateId) {
        fetch(
          `/api/affiliate/checkCode?affiliateId=${parsedAffiliateData.affiliateId}`
        )
          .then((res) => res.json())
          .then((data) => {
            if (data) {
              if (data.type === "agent") {
                setAgentCommission(data.commission);
                setAffType("agent");
                superTrack({
                  isAgent: true,
                  agentId: parsedAffiliateData.affiliateId,
                });
              } else if (data.type === "affiliate") {
                setAffDiscount(data.discount);
                setAffType("affiliate");
              }
              setAffId(parsedAffiliateData.affiliateId);
            }
          })
          .catch(console.error);
      }
    }
  }, []);

  return {
    affDiscount,
    affId,
    affType,
    agentCommission,
  };
}
