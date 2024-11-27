import { Flight, TimeRange } from "./app.types";
import { SortOptions, flightSort } from "./flightSort";
import { parseDuration } from "./parseDuration";

export const applyFiltersAndSorting = (
  flights: Flight[],
  options: {
    airline: string[];
    directOnly: boolean;
    sortOption: SortOptions;
    outboundRange: TimeRange;
    inboundRange: TimeRange;
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

  const getTimeValue = (date: Date) => date.getHours() * 60 + date.getMinutes();

  const filteredFlights = flights.filter((flight) => {
    const departureTime = getTimeValue(new Date(flight.departureTime));
    const arrivalTime = getTimeValue(new Date(flight.arrivalTime));

    const outboundStart =
      outboundRange[0].hours * 60 + outboundRange[0].minutes;
    const outboundEnd = outboundRange[1].hours * 60 + outboundRange[1].minutes;

    const matchesOutboundRange =
      departureTime >= outboundStart && arrivalTime <= outboundEnd;

    const returnDepartureTime = getTimeValue(new Date(flight.departureTime));
    const returnArrivalTime = getTimeValue(new Date(flight.arrivalTime));

    const inboundStart = inboundRange[0].hours * 60 + inboundRange[0].minutes;
    const inboundEnd = inboundRange[1].hours * 60 + inboundRange[1].minutes;

    const matchesInboundRange =
      returnDepartureTime >= inboundStart && returnArrivalTime <= inboundEnd;

    const matchesAirline = !airline.length
      ? true
      : airline.includes(flight.airline);
    const matchesDirectOnly = directOnly ? flight.stops === 0 : true;
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
