import { Event, Flight } from "./app.types";

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

  return [
    checkInDate,
    new Date(flight?.inbound?.departureTime ?? event.def_date_return),
  ];
};
