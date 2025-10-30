import { Event, Flight } from "./app.types";
import { parseLocalDate, parseLocalDateTime, getLocalHour } from "./dateUtils";

export const getDefaultDateRange = (
  event: Event,
  flight?: Flight
): [Date, Date] => {
  // Parse flight arrival time as local time at destination (Israel)
  // Flight times are always in local airport time, not user's timezone
  const arrivalTime = flight?.outbound?.arrivalTime
    ? parseLocalDateTime(flight.outbound.arrivalTime)
    : null;

  let checkInDate = parseLocalDate(event.def_date_depart);

  if (arrivalTime && flight?.outbound?.arrivalTime) {
    // Get the hour from the ISO string directly (represents Israel local time)
    const hours = getLocalHour(flight.outbound.arrivalTime);
    
    if (hours < 8) {
      // If arrival is before 8 AM Israel time, set check-in to previous day
      checkInDate = new Date(arrivalTime);
      checkInDate.setDate(checkInDate.getDate() - 1);
    } else {
      // If arrival is 8 AM or later Israel time, use the same day
      checkInDate = new Date(arrivalTime);
    }
  }

  return [
    checkInDate,
    flight?.inbound?.departureTime 
      ? parseLocalDateTime(flight.inbound.departureTime)
      : parseLocalDate(event.def_date_return),
  ];
};
