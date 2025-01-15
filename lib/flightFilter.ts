import { Flight, TimeRange } from "./app.types";
import { SortOptions, flightSort } from "./flightSort";
import { parseDuration } from "./parseDuration";

export const applyFiltersAndSorting = (
  flights: Flight[],
  options: {
    airline: string[];
    sortOption: SortOptions;
    departureRanges: TimeRange[] | [];
    arrivalRanges: TimeRange[] | [];
    flightDuration: number;
    maxPrice: number;
    numOfStops: string[];
    withLuggageOnly: boolean;
  }
): Flight[] => {
  const {
    airline,
    sortOption,
    departureRanges,
    arrivalRanges,
    flightDuration,
  } = options;

  const getTimeValue = (date: Date) => date.getHours() * 60 + date.getMinutes();

  const filteredFlights = flights.filter((flight) => {
    const departureTime = getTimeValue(new Date(flight.outbound.departureTime));
    const arrivalTime = getTimeValue(new Date(flight.outbound.arrivalTime));

    const departureRangesToDateTime: [number, number][] = departureRanges.map(
      (range) => {
        return [
          range[0].hours * 60 + range[0].minutes,
          range[1].hours * 60 + range[1].minutes,
        ];
      }
    );

    const matchesDepartureRange =
      !departureRangesToDateTime.length ||
      departureRangesToDateTime.some(([start, end]) => {
        return departureTime >= start && departureTime <= end;
      });

    const arrivalRangesToDateTime: [number, number][] = arrivalRanges.map(
      (range) => {
        return [
          range[0].hours * 60 + range[0].minutes,
          range[1].hours * 60 + range[1].minutes,
        ];
      }
    );

    const matchesArrivalRange =
      !arrivalRangesToDateTime.length ||
      arrivalRangesToDateTime.some(([start, end]) => {
        return arrivalTime >= start && arrivalTime <= end;
      });

    const matchesAirline = !airline.length
      ? true
      : airline.includes(flight.airline);
    const matchesStops =
      !options.numOfStops.length ||
      options.numOfStops.includes(flight.stops.toString());
    const matchesFlightDuration =
      parseDuration(flight.duration) / 60 <= flightDuration;

    const matchesMaxPrice = flight.price <= options.maxPrice;

    const matchesLuggage =
      !options.withLuggageOnly || flight.outbound.checkBagsIncluded;

    return (
      matchesAirline &&
      matchesStops &&
      matchesDepartureRange &&
      matchesArrivalRange &&
      matchesFlightDuration &&
      matchesMaxPrice &&
      matchesLuggage
    );
  });

  // Sort the filtered flights
  const sortedFlights = flightSort(filteredFlights, sortOption);

  return sortedFlights;
};
