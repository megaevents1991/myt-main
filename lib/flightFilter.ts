import { Flight } from "./app.types";
import { SortOptions, flightSort } from "./flightSort";
import { parseDuration } from "./parseDuration";

export const applyFiltersAndSorting = (
  flights: Flight[],
  options: {
    airline: string | "all";
    directOnly: boolean;
    sortOption: SortOptions;
    outboundRange: [number, number];
    inboundRange: [number, number];
    flightDuration: number;
  }
): Flight[] => {
  const {
    airline,
    directOnly,
    sortOption,
    outboundRange,
    inboundRange,
    flightDuration,
  } = options;

  // Filter flights based on the provided options
  const filteredFlights = flights.filter((flight) => {
    const matchesAirline =
      airline === "all" ? true : flight.airline === airline;
    const matchesDirectOnly = directOnly ? flight.stops === 0 : true;
    const matchesOutboundRange =
      new Date(flight.departureTime).getHours() >= outboundRange[0] &&
      new Date(flight.arrivalTime).getHours() <= outboundRange[1];
    const matchesInboundRange =
      new Date(flight.returnDepartureTime).getHours() >= inboundRange[0] &&
      new Date(flight.returnArrivalTime).getHours() <= inboundRange[1];
    const matchesFlightDuration =
      parseDuration(flight.duration) <= flightDuration;

    return (
      matchesAirline &&
      matchesDirectOnly &&
      matchesOutboundRange &&
      matchesInboundRange &&
      matchesFlightDuration
    );
  });

  // Sort the filtered flights
  const sortedFlights = flightSort(filteredFlights, sortOption);

  return sortedFlights;
};
