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
    luggage: string[];
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
    const returnDepartureTime = getTimeValue(
      new Date(flight.inbound.departureTime)
    );

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
        return returnDepartureTime >= start && returnDepartureTime <= end;
      });

    const matchesAirline = airline.includes(flight.airline);
    const matchesStops =
      flight.stops < 2 && options.numOfStops.includes(flight.stops.toString());
    const matchesFlightDuration =
      parseDuration(flight.duration) / 60 <= flightDuration;

    const matchesMaxPrice = flight.price <= options.maxPrice;

    let matchesLuggage = false;

    if (options.luggage.length === 2) {
      //Return all options except those with backpack only
      matchesLuggage =
        flight.outbound.checkBagsIncluded || flight.outbound.cabinBagsIncluded;
    } else if (options.luggage.length === 0) {
      //Return only backpack options
      matchesLuggage =
        !flight.outbound.checkBagsIncluded &&
        !flight.outbound.cabinBagsIncluded;
    } else if (options.luggage.includes("withCheckedBags")) {
      matchesLuggage = flight.outbound.checkBagsIncluded;
    } else if (options.luggage.includes("withCabinBags")) {
      matchesLuggage =
        flight.outbound.cabinBagsIncluded && !flight.outbound.checkBagsIncluded;
    }

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
