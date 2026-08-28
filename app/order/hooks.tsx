"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { OrderContext } from "../app.context";
import { HotelFetchContext } from "../hooks/HotelFetch.provider";
import { getTotalPersons } from "@/lib/price.utils";
import {
  getAddedBagsTotalUsd,
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
    skippedHotelPricePerGuest,
    flightSkipped,
  } = useContext(OrderContext);
  const { hotelsData } = useContext(HotelFetchContext);

  // Cheapest available hotel in the CURRENT search, per guest - the market
  // reference for the hotel-skip fee when no specific hotel was removed
  // (package links, quotes, skipping before a pick). Null until the search
  // (preloaded on order start) resolves - the fee then applies as before.
  const cheapestMarketHotelPerGuest = useMemo(() => {
    const hotels = hotelsData?.data?.data?.hotels;
    const guests = getTotalPersons(hotelsData?.data?.debug?.request?.guests);
    if (!hotels?.length || !guests) return null;
    let min = Infinity;
    for (const h of hotels) {
      const amount = Number(
        h?.rates?.[0]?.payment_options?.payment_types?.[0]?.show_amount,
      );
      if (Number.isFinite(amount) && amount > 0) {
        min = Math.min(min, amount / guests);
      }
    }
    return Number.isFinite(min) ? min : null;
  }, [hotelsData]);

  // The skip-fee reference (Dor 23-24.8): the hotel actually removed when we
  // know it, otherwise the cheapest hotel on the market. A reference at or
  // under the fee waives it; otherwise it caps the fee.
  const hotelSkipRefPerGuest =
    skippedHotelPricePerGuest ?? cheapestMarketHotelPerGuest;

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
      // skip_hotel_markup, charged in calculateBaseTotal - no env fee here.
      if (hasComponentMarkups(event)) return 0;
      // Legacy: when skipping hotel, add profit. Tunable via env vars.
      const HOTEL_SKIP_FLIGHT_THRESHOLD = 550;
      const hotelSkipMarkupLow =
        Number(process.env.NEXT_PUBLIC_HOTEL_SKIP_MARKUP_LOW) || 100;
      const hotelSkipMarkupHigh =
        Number(process.env.NEXT_PUBLIC_HOTEL_SKIP_MARKUP_HIGH) || 150;
      const fee =
        event.base_flight_price < HOTEL_SKIP_FLIGHT_THRESHOLD
          ? hotelSkipMarkupLow
          : hotelSkipMarkupHigh;
      // Skip-fee rule (Dor 23.8): the fee exists to recover hotel-base
      // margin. A "cheap hotel" - real per-guest cost at or under the fee -
      // has no margin to recover: no fee, so removing it actually lowers the
      // total (the removed Populus at $97.5/guest used to cost +$5 to drop).
      // The reference is the removed hotel when known, else the market's
      // cheapest (Dor 24.8) - and it caps the fee either way.
      if (hotelSkipRefPerGuest != null) {
        if (hotelSkipRefPerGuest <= fee) return 0;
        return Math.min(fee, hotelSkipRefPerGuest);
      }
      return fee;
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
  }, [skipHotel, hotelSkipRefPerGuest, selectedHotel, event, totalGuests]);

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

    // Paid baggage upsell ("הוסף מזוודה"/"הוסף טרולי") chosen on the
    // summary - a single flat addition to the package total, same treatment
    // as any other over-base pick (flightPriceAddition/hotelPriceAddition
    // below), so it flows through affiliate/coupon %, ILS conversion and the
    // agent-commission base exactly like the rest of the total does. Gated
    // on !flightSkipped so a stale added_bags on a since-skipped flight can
    // never leak into the total.
    const addedBagsUsd = flightSkipped
      ? 0
      : getAddedBagsTotalUsd(selectedFlight?.added_bags);

    // ── Ticket-only override (wins over everything) ────────────────────────
    // Customer skipped BOTH flight and hotel and the event has a ticket-only
    // markup set → price is exactly ticket cost + that markup. No global
    // markup, no additional, no skip fees, no component markups.
    if (isTicketOnlyOverride(event, flightSkipped, skipHotel)) {
      const ticketOnly = getTicketOnlyMarkup(event) ?? 0;
      return Math.ceil(
        ((eventTicket.price || 0) + ticketOnly) * numberOfEventTickets +
          addedBagsUsd,
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
      // Same skip-fee rule as the legacy branch (Dor 23.8): a reference
      // hotel (the removed one, else the market's cheapest) at or under the
      // fee waives it; otherwise it caps it.
      const skipHotelFee =
        hotelSkipRefPerGuest != null
          ? hotelSkipRefPerGuest <= m.skipHotel
            ? 0
            : Math.min(m.skipHotel, hotelSkipRefPerGuest)
          : m.skipHotel;
      const perTicketMarkup =
        m.ticket +
        getEventAdditionalMarkup(event) +
        (flightSkipped ? m.skipFlight : m.flight) +
        (skipHotel ? skipHotelFee : m.hotel);
      return Math.ceil(
        ((eventTicket.price || 0) + perTicketMarkup) * numberOfEventTickets +
          flightComponent +
          hotelComponent +
          addedBagsUsd
      );
    }
    // ── Legacy pricing (no component markups) - unchanged ──────────────────

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
        hotelSkipAddition +
        addedBagsUsd
    );
  }, [
    eventTicket,
    event,
    selectedFlight,
    flightSkipped,
    skipHotel,
    hotelSkipRefPerGuest,
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
    // Two attempts against our own API before touching any fallback - an
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
    // Same last-resort rate the server-side service falls back to - the old
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

/**
 * @param sessionPartnerCode A cookie-verified partner session's tracking code
 * (order flow passes the AGENT's own code). When present it takes PRECEDENCE
 * over localStorage/URL - a signed-in agent acts as himself even on a bare
 * URL or on someone else's tagged link (V2 spec 2026-08-27), which also keeps
 * the server-side settlement check (session code === attribution code) green.
 */
export function useFetchAffiliate(sessionPartnerCode?: string | null) {
  const [affDiscount, setAffDiscount] = useState(0);
  const [agentCommission, setAgentCommission] = useState(0);
  // Percent vs fixed-per-ticket - commission math must not assume percent
  // (a fixed $20/ticket agent was shown 20% everywhere).
  const [agentCommissionType, setAgentCommissionType] = useState<
    "percent_of_sale" | "fixed_per_ticket"
  >("fixed_per_ticket");
  const [affId, setAffId] = useState<string | null>(null);
  const [affType, setAffType] = useState<"agent" | "affiliate" | null>(null);
  const [voucherPaymentAllowed, setVoucherPaymentAllowed] = useState(false);
  const [voucherBalanceUsd, setVoucherBalanceUsd] = useState(0);
  const [partnerLogoUrl, setPartnerLogoUrl] = useState<string | null>(null);
  const [partnerDisplayName, setPartnerDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let affiliateData;
    try {
      affiliateData = localStorage.getItem("mytData");
    } catch (error) {
      console.error("localStorage access error:", error);
      // add statsig event
    }
    // Corrupt mytData must not take down the whole order flow on every visit.
    let parsedAffiliateData: { affiliateId?: string | null } = {};
    if (affiliateData) {
      try {
        parsedAffiliateData = JSON.parse(affiliateData);
      } catch (error) {
        console.error("Corrupt mytData in localStorage:", error);
      }
    }
    // First visit through a partner link: the tracker writes mytData in a
    // deferred effect, so on this very first mount localStorage can still be
    // empty - read the code straight off the URL then (same params the
    // tracker itself consumes), or agent mode never shows without a refresh.
    const urlAffiliateId =
      new URLSearchParams(window.location.search).get("utm_source") ||
      new URLSearchParams(window.location.search).get("aff");
    const affiliateId =
      sessionPartnerCode || parsedAffiliateData.affiliateId || urlAffiliateId;
    if (affiliateId) {
      fetch(`/api/affiliate/checkCode?affiliateId=${affiliateId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            setPartnerLogoUrl(data.partnerLogoUrl ?? null);
            setPartnerDisplayName(data.partnerDisplayName ?? null);
            if (data.type === "agent") {
              setAgentCommission(data.commission);
              setAgentCommissionType(
                data.commissionType === "percent_of_sale"
                  ? "percent_of_sale"
                  : "fixed_per_ticket"
              );
              setAffType("agent");
              setVoucherPaymentAllowed(data.voucherPaymentAllowed === true);
              setVoucherBalanceUsd(Number(data.voucherBalanceUsd) || 0);
              superTrack({
                isAgent: true,
                agentId: affiliateId,
              });
            } else if (data.type === "affiliate") {
              setAffDiscount(data.discount);
              setAffType("affiliate");
            }
            setAffId(affiliateId);
          }
        })
        .catch(console.error);
    }
    // sessionPartnerCode is a server-passed prop - stable per page load, but
    // included so a late-arriving value still triggers the fetch.
  }, [sessionPartnerCode]);

  return {
    affDiscount,
    affId,
    affType,
    agentCommission,
    agentCommissionType,
    voucherPaymentAllowed,
    voucherBalanceUsd,
    partnerLogoUrl,
    partnerDisplayName,
    // expose setter to allow contextual promos (e.g., inactivity special offer)
    setAffDiscount,
  };
}
