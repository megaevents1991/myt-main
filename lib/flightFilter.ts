import { Flight } from "./app.types";
import { SortOptions, flightSort } from "./flightSort";
import { parseDuration } from "./parseDuration";

export const applyFiltersAndSorting = (
  flights: Flight[],
  options: {
    airline: string | "all";
    directOnly: boolean;
    sortOption: SortOptions;
    outBoundRange?: { departure: number; arrival: number };
    inBoundRange?: { departure: number; arrival: number };
    flightDuration: number;
  }
): Flight[] => {
  const {
    airline,
    directOnly,
    sortOption,
    outBoundRange = true,
    inBoundRange = true,
    flightDuration,
  } = options;

  // Filter flights based on the provided options
  const filteredFlights = flights.filter((flight) => {
    const matchesAirline =
      airline === "all" ? true : flight.airline === airline;
    const matchesDirectOnly = directOnly ? flight.stops === 0 : true;
    const matchesOutBoundRange = outBoundRange;
    // new Date(flight.departureTime).getTime() >= outBoundRange.departure &&
    // new Date(flight.arrivalTime).getDate() <= outBoundRange.arrival;
    const matchesInBoundRange = inBoundRange;
    // new Date(flight.returnDepartureTime).getTime() >=
    //   inBoundRange.departure &&
    // new Date(flight.returnArrivalTime).getTime() <= inBoundRange.arrival;
    const matchesFlightDuration =
      parseDuration(flight.duration) <= flightDuration;

    return (
      matchesAirline &&
      matchesDirectOnly &&
      matchesOutBoundRange &&
      matchesInBoundRange &&
      matchesFlightDuration
    );
  });

  // Sort the filtered flights
  const sortedFlights = flightSort(filteredFlights, sortOption);

  return sortedFlights;
};
