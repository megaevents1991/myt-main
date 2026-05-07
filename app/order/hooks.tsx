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
    skipHotel,
    flightSkipped,
  } = useContext(OrderContext);

  /* Calculate total guests */
  const totalGuests = useMemo(() => {
    if (!selectedHotel) {
      return 0;
    }
    return getTotalPersons(selectedHotel.guests);
  }, [selectedHotel]);

  const hotelPriceAddition = useMemo(() => {
    if (skipHotel && event) {
      // When skipping hotel, add profit
      return event.base_flight_price < 550 ? 100 : 150;
    }
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
  }, [skipHotel, selectedHotel, event, totalGuests]);

  const airlineName = useMemo(
    () => shortenAirlineName(selectedFlight?.metadata?.name),
    [selectedFlight?.metadata?.name]
  );

  const airlineFullName = useMemo(
    () => (selectedFlight?.metadata?.name),
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

  /* Fetch lowest available ticket price (exclude tickets with available === false) */
  const minTicketPrice = useMemo(() => {
    if (!event || !event.tickets_and_rates || event.tickets_and_rates.length === 0) {
      return 0;
    }
    const available = event.tickets_and_rates.filter((t) => t?.available !== false);
    if (available.length === 0) return 0;
    return Math.min(...available.map((ticket) => ticket.price));
  }, [event]);

  /* Main variables to calculate price additions */
  const eventTicketPriceAddition = (eventTicket.price || 0) - minTicketPrice;

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
    if (!selectedFlight && !flightSkipped) {
      return 0;
    }
    if (flightSkipped) {
      return numberOfEventTickets;
    }
    return selectedFlight!.numOfTravelers > numberOfEventTickets
      ? selectedFlight!.numOfTravelers
      : numberOfEventTickets;
  }, [selectedFlight, numberOfEventTickets, flightSkipped]);

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

  const calculateBaseTotal = useCallback(() => {
    if (!eventTicket || !event || (!selectedFlight && !flightSkipped)) {
      return 0;
    }

    // Calculate hotel component based on skip status
    const hotelComponent = skipHotel
      ? 0 // When skipping, the credit is applied via hotelPriceAddition
      : (hotelPriceAddition + event.base_hotel_price) * totalGuests;

    // When flight is skipped, no flight cost is added
    const numTravelers = selectedFlight?.numOfTravelers ?? numberOfEventTickets;
    const flightComponent = flightSkipped
      ? 0
      : (flightPriceAddition + event.base_flight_price) * numTravelers;

    // When skipping flight, add admin-set per-ticket markup to keep margin
    const skipFlightMarkup = flightSkipped
      ? Math.max(0, Number(event.skip_flight_markup ?? 0)) * numberOfEventTickets
      : 0;

    return Math.ceil(
      (eventTicket.price + maup || 0) * numberOfEventTickets +
        flightComponent +
        hotelComponent +
        skipFlightMarkup +
        (skipHotel ? hotelPriceAddition * numberOfEventTickets : 0) // Apply hotel credit per person when skipping
    );
  }, [
    eventTicket,
    event,
    selectedFlight,
    flightSkipped,
    skipHotel,
    hotelPriceAddition,
    totalGuests,
    maup,
    numberOfEventTickets,
    flightPriceAddition,
  ]);

  /* Calculation of final price for the customer after discounts and such */
  const finalPurchasePriceCalc = useCallback(
    (affDiscount: number) => {
      const baseTotal = calculateBaseTotal();
      if (baseTotal <= 0) {
        return 0;
      }

      // Affiliate discount normalization:
      // - 1..10 => percentage discount from expected total price
      // - 20+   => absolute amount (legacy behavior: per-ticket)
      // - 11..19 (or any other positive value) => treat as absolute per-ticket for backward compatibility
      if (affDiscount >= 1 && affDiscount <= 10) {
        const percentageDiscount = (baseTotal * affDiscount) / 100;
        return Math.max(0, Math.ceil(baseTotal - percentageDiscount));
      }

      const absoluteDiscountTotal = Math.max(0, affDiscount || 0) * numberOfEventTickets;
      return Math.max(0, Math.ceil(baseTotal - absoluteDiscountTotal));
    },
    [
      numberOfEventTickets,
      calculateBaseTotal,
    ]
  );

  const getAffiliateDiscountTotalUsd = useCallback(
    (affDiscount: number) => {
      const baseTotal = calculateBaseTotal();
      if (baseTotal <= 0) return 0;
      const finalTotal = finalPurchasePriceCalc(affDiscount);
      return Math.max(0, baseTotal - finalTotal);
    },
    [calculateBaseTotal, finalPurchasePriceCalc]
  );

  const getAffiliateDiscountPerTicketUsd = useCallback(
    (affDiscount: number) => {
      if (!numberOfEventTickets) return 0;
      return getAffiliateDiscountTotalUsd(affDiscount) / numberOfEventTickets;
    },
    [getAffiliateDiscountTotalUsd, numberOfEventTickets]
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
    airlineFullName,
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
    getAffiliateDiscountTotalUsd,
    getAffiliateDiscountPerTicketUsd,
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
    // expose setter to allow contextual promos (e.g., inactivity special offer)
    setAffDiscount,
  };
}
