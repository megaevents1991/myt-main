"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { OrderContext } from "../app.context";
import { getTotalPersons } from "@/lib/price.utils";
import {
  priceOutsidePackBoundaries,
  shortenAirlineName,
} from "./order-review.utils";
import { superTrack } from "@/lib/mixpanel";
import { FALLBACK_TRAVEL_RATE } from "@/lib/exchangeRate.constants";
import {
  getComponentMarkups,
  getEventAdditionalMarkup,
  getTicketOnlyMarkup,
  getTotalMarkup,
  hasComponentMarkups,
  isTicketOnlyOverride,
} from "@/lib/events/price";

export function useOrderVars() {
  const {
    flight: selectedFlight,
    hotel: selectedHotel,
    eventTicket,
    event,
    numberOfEventTickets,
    currentMinTicketPrice,
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
      // Composed pricing: the hotel-skip fee is the event's own
      // skip_hotel_markup, charged in calculateBaseTotal — no env fee here.
      if (hasComponentMarkups(event)) return 0;
      // Legacy: when skipping hotel, add profit. Tunable via env vars.
      const HOTEL_SKIP_FLIGHT_THRESHOLD = 550;
      const hotelSkipMarkupLow =
        Number(process.env.NEXT_PUBLIC_HOTEL_SKIP_MARKUP_LOW) || 100;
      const hotelSkipMarkupHigh =
        Number(process.env.NEXT_PUBLIC_HOTEL_SKIP_MARKUP_HIGH) || 150;
      return event.base_flight_price < HOTEL_SKIP_FLIGHT_THRESHOLD
        ? hotelSkipMarkupLow
        : hotelSkipMarkupHigh;
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
  const dbMinTicketPrice = useMemo(() => {
    if (!event || !event.tickets_and_rates || event.tickets_and_rates.length === 0) {
      return 0;
    }
    const available = event.tickets_and_rates.filter((t) => t?.available !== false);
    if (available.length === 0) return 0;
    return Math.min(...available.map((ticket) => ticket.price));
  }, [event]);

  const minTicketPrice = currentMinTicketPrice || dbMinTicketPrice;

  /* Main variables to calculate price additions */
  const eventTicketPriceAddition = (eventTicket.price || 0) - minTicketPrice;

  const markup = useMemo(() => (event ? getTotalMarkup(event) : 0), [event]);

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
    // Ticket-only override: the recommended total is just ticket + the
    // override markup, matching the real charge (no bases/markups).
    if (isTicketOnlyOverride(event, flightSkipped, skipHotel)) {
      return Math.ceil(minTicketPrice + (getTicketOnlyMarkup(event) ?? 0));
    }
    // When customer skips flight, exclude base flight price from the
    // strikethrough/recommended total so the price reflects "no flight" mode.
    const flightComponent = flightSkipped ? 0 : event.base_flight_price;
    // Composed pricing mirrors the real charge: flight markup swaps for the
    // skip-flight fee when the flight is skipped. Legacy keeps the flat markup.
    const recommendedMarkup = hasComponentMarkups(event)
      ? (() => {
          const m = getComponentMarkups(event);
          return (
            m.ticket +
            (flightSkipped ? m.skipFlight : m.flight) +
            m.hotel +
            getEventAdditionalMarkup(event)
          );
        })()
      : markup;
    return Math.ceil(
      flightComponent + event.base_hotel_price + minTicketPrice + recommendedMarkup
    );
  }, [event, minTicketPrice, markup, flightSkipped, skipHotel]);

  const recommendedPriceAllPax = packRecommendedPrice * numberOfPersons;

  const calculateBaseTotal = useCallback(() => {
    if (!eventTicket || !event || (!selectedFlight && !flightSkipped)) {
      return 0;
    }

    // ── Ticket-only override (wins over everything) ────────────────────────
    // Customer skipped BOTH flight and hotel and the event has a ticket-only
    // markup set → price is exactly ticket cost + that markup. No global
    // markup, no additional, no skip fees, no component markups.
    if (isTicketOnlyOverride(event, flightSkipped, skipHotel)) {
      const ticketOnly = getTicketOnlyMarkup(event) ?? 0;
      return Math.ceil(
        ((eventTicket.price || 0) + ticketOnly) * numberOfEventTickets,
      );
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

    // ── Composed pricing (any markup_* set in the backoffice) ──────────────
    // Per ticket: ticket markup always; flight/hotel markup when included,
    // their skip fee when skipped. Costs (bases + upgrade deltas) unchanged.
    if (hasComponentMarkups(event)) {
      const m = getComponentMarkups(event);
      const perTicketMarkup =
        m.ticket +
        getEventAdditionalMarkup(event) +
        (flightSkipped ? m.skipFlight : m.flight) +
        (skipHotel ? m.skipHotel : m.hotel);
      return Math.ceil(
        ((eventTicket.price || 0) + perTicketMarkup) * numberOfEventTickets +
          flightComponent +
          hotelComponent
      );
    }
    // ── Legacy pricing (no component markups) — unchanged ──────────────────

    // When skipping flight, add admin-set per-ticket markup to keep margin
    const skipFlightMarkupValue = Math.max(0, Number(event.skip_flight_markup ?? 0));
    const skipFlightMarkup = flightSkipped
      ? skipFlightMarkupValue * numberOfEventTickets
      : 0;

    // If event is skip-flight enabled, client skipped flight, and a skip-flight
    // markup was applied, suppress the hotel-skip markup to avoid double margin.
    const skipFlightMarkupAlreadyApplied =
      event.skip_flight === true && flightSkipped && skipFlightMarkupValue > 0;

    const hotelSkipAddition =
      skipHotel && !skipFlightMarkupAlreadyApplied
        ? hotelPriceAddition * numberOfEventTickets
        : 0;

    return Math.ceil(
      ((eventTicket.price || 0) + markup) * numberOfEventTickets +
        flightComponent +
        hotelComponent +
        skipFlightMarkup +
        hotelSkipAddition
    );
  }, [
    eventTicket,
    event,
    selectedFlight,
    flightSkipped,
    skipHotel,
    hotelPriceAddition,
    totalGuests,
    markup,
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
    // Two attempts against our own API before touching any fallback — an
    // /api/events-info blip should never decide the customer's exchange rate.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch("/api/events-info");
        if (!response.ok) {
          throw new Error("Failed to fetch exchange rate from server");
        }
        const data = await response.json();
        const travelRate = Number(data.travelRate);
        if (!Number.isFinite(travelRate) || travelRate <= 0) {
          throw new Error("Invalid travelRate from server");
        }
        return {
          ils: Math.ceil(USDprice * travelRate),
          travelRate,
        };
      } catch (error) {
        console.error(
          `Exchange rate fetch failed (attempt ${attempt}/2):`,
          error,
        );
      }
    }
    // Same last-resort rate the server-side service falls back to — the old
    // ad-hoc 3.7 here sat ABOVE the service's own validity ceiling (3.65).
    return {
      ils: Math.ceil(USDprice * FALLBACK_TRAVEL_RATE),
      travelRate: FALLBACK_TRAVEL_RATE,
    };
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
      // Corrupt mytData must not take down the whole order flow on every visit.
      let parsedAffiliateData;
      try {
        parsedAffiliateData = JSON.parse(affiliateData);
      } catch (error) {
        console.error("Corrupt mytData in localStorage:", error);
        return;
      }
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
