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
    selectedEvents,
    selectedEventTickets,
    activeTicketEventIndex,
    numberOfEventTickets,
    skipHotel,
    forceSkipHotel,
  } = useContext(OrderContext);

  const effectiveEvents = useMemo(() => {
    if (selectedEvents && selectedEvents.length > 0) return selectedEvents;
    return event ? [event] : [];
  }, [selectedEvents, event]);

  const activeEvent = effectiveEvents[activeTicketEventIndex] || event;

  /* Calculate total guests */
  const totalGuests = useMemo(() => {
    if (!selectedHotel) {
      return 0;
    }
    return getTotalPersons(selectedHotel.guests);
  }, [selectedHotel]);

  const hotelPriceAddition = useMemo(() => {
    if (forceSkipHotel) {
      // Mondial bundle: hotel is not part of the product; no credit/profit logic.
      return 0;
    }
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
  }, [forceSkipHotel, skipHotel, selectedHotel, event, totalGuests]);

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

  const minTicketPriceForEvent = useCallback((evt?: typeof event) => {
    if (!evt || !evt.tickets_and_rates || evt.tickets_and_rates.length === 0) return 0;
    const available = evt.tickets_and_rates.filter((t) => t?.available !== false);
    if (available.length === 0) return 0;
    return Math.min(...available.map((t) => t.price));
  }, []);

  const minTicketPriceTotalPerPerson = useMemo(() => {
    return effectiveEvents.reduce((sum, evt) => sum + minTicketPriceForEvent(evt), 0);
  }, [effectiveEvents, minTicketPriceForEvent]);

  // Keep this metric aligned with the currently active event (used by analytics in-step)
  const eventTicketPriceAddition = useMemo(() => {
    return (eventTicket.price || 0) - minTicketPriceForEvent(activeEvent);
  }, [eventTicket.price, activeEvent, minTicketPriceForEvent]);

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
      event.base_flight_price +
        (forceSkipHotel ? 0 : event.base_hotel_price) +
        minTicketPriceTotalPerPerson +
        maup
    );
  }, [event, minTicketPriceTotalPerPerson, maup, forceSkipHotel]);

  const recommendedPriceAllPax = packRecommendedPrice * numberOfPersons;

  const calculateBaseTotal = useCallback(() => {
    if (!event || !selectedFlight) {
      return 0;
    }

    const ticketTotal = effectiveEvents.reduce((sum, evt) => {
      const selected = selectedEventTickets?.[evt.id];
      const fallbackSingle =
        effectiveEvents.length === 1 ? (eventTicket?.price || 0) : 0;
      const pricePerTicket = selected?.price ?? fallbackSingle;
      return sum + pricePerTicket * numberOfEventTickets;
    }, 0);

    // Calculate hotel component based on skip status
    const hotelComponent = skipHotel
      ? 0 // When skipping, the credit is applied via hotelPriceAddition
      : (hotelPriceAddition + event.base_hotel_price) * totalGuests;

    return Math.ceil(
      ticketTotal + maup * numberOfEventTickets +
        (flightPriceAddition + event.base_flight_price) *
          selectedFlight.numOfTravelers +
        hotelComponent +
        (skipHotel ? hotelPriceAddition * numberOfEventTickets : 0) // Apply hotel credit per person when skipping
    );
  }, [
    event,
    selectedFlight,
    effectiveEvents,
    selectedEventTickets,
    eventTicket,
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
