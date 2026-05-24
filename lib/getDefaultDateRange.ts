import { Event, Flight } from "./app.types";

// A return flight that leaves before this hour means the guest is already gone
// that morning — checkout stays on the flight's date. A later departure needs
// the last night, so checkout moves to the day after the flight.
const RETURN_FLIGHT_EXTRA_NIGHT_CUTOFF_HOUR = 6;

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

  // Checkout follows the return flight's departure time, not just its date.
  const returnDepartureTime = flight?.inbound?.departureTime
    ? new Date(flight.inbound.departureTime)
    : null;

  let checkOutDate = new Date(event.def_date_return);

  if (returnDepartureTime) {
    checkOutDate = new Date(returnDepartureTime);
    if (
      returnDepartureTime.getHours() >= RETURN_FLIGHT_EXTRA_NIGHT_CUTOFF_HOUR
    ) {
      // Return flight leaves at/after 06:00 — the guest needs that last night,
      // so checkout is the day after the flight.
      checkOutDate.setDate(checkOutDate.getDate() + 1);
    }
    // Before 06:00 — guest left during the night; checkout stays on the flight date.
  }

  return [checkInDate, checkOutDate];
};
