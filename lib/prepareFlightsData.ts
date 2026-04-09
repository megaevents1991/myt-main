import { Flight } from "./app.types";
import { parseDuration } from "./parseDuration";

export const prepareFlightsData = (flights: Flight[]) => {
  const airlines: string[] = Array.from(
    new Set(flights.map((flight: Flight) => flight.airline))
  );
  const durations = flights.map((flight: Flight) =>
    parseDuration(flight.duration)
  );
  const prices = flights.map((flight: Flight) => flight.price);

  const maxDuration = Math.max(...durations);
  const minDuration = Math.min(...durations);

  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);

  return {
    airlines,
    maxDuration,
    minDuration,
    maxPrice,
    minPrice,
  };
};
