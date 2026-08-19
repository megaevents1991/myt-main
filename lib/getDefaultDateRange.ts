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

export const getDefaultDateRange = (
  event: Event,
  flight?: Flight
): [Date, Date] => {
  const arrivalTime = flight?.outbound?.arrivalTime
    ? new Date(flight.outbound.arrivalTime)
    : null;

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
  }

  // Checkout = return flight's departure calendar date. Guest takes the last
  // night and checks out the morning of the flight.
  const returnDepartureTime = flight?.inbound?.departureTime
    ? new Date(flight.inbound.departureTime)
    : null;

  let checkOutDate = returnDepartureTime
    ? new Date(returnDepartureTime)
    : new Date(event.def_date_return);

  // No real flight dates - the range comes from the event's stored defaults,
  // which go stale as the event approaches (def_date_depart passes "today").
  // Clamp the check-in to the min travel date and keep the intended trip
  // length. Flight-derived dates are left alone: they reflect a bookable
  // itinerary the customer actually chose.
  if (!arrivalTime && checkInDate < getMinTravelDate()) {
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
