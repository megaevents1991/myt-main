import { Event, Flight } from "./app.types";

// Earliest searchable travel date: tomorrow (00:00 local). Same-day and past
// searches break both vendors - Amadeus rejects past departure dates outright
// (search 500s), and Ratehawk returns only non-refundable or zero rates - so
// stale event defaults (def_date_depart <= today) must never reach a search
// request, and the date pickers must not offer such dates.
export const getMinTravelDate = (): Date => {
  const min = new Date();
  min.setHours(0, 0, 0, 0);
  min.setDate(min.getDate() + 1);
  return min;
};

// The longest one leg (outbound or inbound) can take from takeoff to landing,
// a stopover included. A landing is trusted for the hotel's check-in only
// inside this window after its takeoff. An offline flight saved in the
// backoffice with its landing in the wrong month (20/07 for 20/05, found
// 2026-10-12) opened the hotel step on a check-in two months AFTER the
// check-out - the flight card prints the landing's hour alone, so nothing on
// the way there showed it. The backoffice refuses such a leg now
// (lib/flight-leg-times.ts, same constant); this side stays safe on its own.
export const MAX_LEG_HOURS = 48;

const validDate = (value?: string): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * A leg's landing time, when it is one the itinerary can actually have: on or
 * after the takeoff and within MAX_LEG_HOURS of it. Anything else - a date
 * typed in the wrong month, the "0" an Amadeus offer with no segments leaves -
 * is null, and the caller reads the takeoff instead. With no takeoff to
 * measure against the landing is taken as it is.
 */
export const trustedArrival = (
  departureTime?: string,
  arrivalTime?: string
): Date | null => {
  const arrival = validDate(arrivalTime);
  if (!arrival) return null;
  const departure = validDate(departureTime);
  if (!departure) return arrival;
  const hours = (arrival.getTime() - departure.getTime()) / 3_600_000;
  return hours >= 0 && hours <= MAX_LEG_HOURS ? arrival : null;
};

export const getDefaultDateRange = (
  event: Event,
  flight?: Flight
): [Date, Date] => {
  const departureTime = validDate(flight?.outbound?.departureTime);
  const arrivalTime = trustedArrival(
    flight?.outbound?.departureTime,
    flight?.outbound?.arrivalTime
  );

  let checkInDate = new Date(event.def_date_depart);

  if (arrivalTime) {
    const hours = arrivalTime.getHours();
    if (hours < 8) {
      // If arrival is before 8 AM, set check-in to previous day
      checkInDate = new Date(arrivalTime);
      checkInDate.setDate(checkInDate.getDate() - 1);
    } else {
      // If arrival is 8 AM or later, use the same day
      checkInDate = new Date(arrivalTime);
    }
  } else if (departureTime) {
    // The landing cannot be trusted (trustedArrival): the customer checks in
    // on the day the flight leaves - what the rule above says of every flight
    // that lands before 08:00 the next morning.
    checkInDate = new Date(departureTime);
  }

  // Checkout = return flight's departure calendar date. Guest takes the last
  // night and checks out the morning of the flight.
  const returnDepartureTime = validDate(flight?.inbound?.departureTime);

  let checkOutDate = returnDepartureTime
    ? new Date(returnDepartureTime)
    : new Date(event.def_date_return);

  // No real flight dates - the range comes from the event's stored defaults,
  // which go stale as the event approaches (def_date_depart passes "today").
  // Clamp the check-in to the min travel date and keep the intended trip
  // length. Flight-derived dates are left alone: they reflect a bookable
  // itinerary the customer actually chose.
  const fromFlight = !!(arrivalTime || departureTime);
  if (!fromFlight && checkInDate < getMinTravelDate()) {
    const defaultNights = Math.round(
      (new Date(event.def_date_return).getTime() -
        new Date(event.def_date_depart).getTime()) /
        (24 * 60 * 60 * 1000)
    );
    const nights = defaultNights >= 1 ? defaultNights : 1;

    checkInDate = getMinTravelDate();
    if (!returnDepartureTime && checkOutDate <= checkInDate) {
      checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + nights);
    }
  }

  return [checkInDate, checkOutDate];
};
