/**
 * "Build Your Euro Trip" - the flights step's filters (Alon 12.11: "חסר לי פילטרים בחלק של הטיסות").
 * The regular flight step's own filter rule (`applyFiltersAndSorting`, lib/flightFilter.ts) over the
 * trip's round trip: airlines, stops, bags, departure / return hours, the price and the duration.
 * Pure: no I/O, no clock.
 *
 * Nothing is filtered until the customer touches a filter (`null`): the step opens on the whole
 * list, as before - the regular rule drops every flight with two stops, which a trip to Manchester
 * may need.
 */
import type { FlightSearchCriteria, ItineraryFlight, TimeRange } from "@/lib/app.types";
import { applyFiltersAndSorting } from "@/lib/flightFilter";
import { prepareFlightsData } from "@/lib/prepareFlightsData";

export type TripFlightFilter = {
  airline: string[];
  numOfStops: string[];
  luggage: string[];
  departureRanges: TimeRange[];
  arrivalRanges: TimeRange[];
  /** The party's price, USD (`Flight.price`). */
  maxPrice: number;
  /** Hours. */
  flightDuration: number;
};

/** What the list's own flights allow: every airline, any bag, up to the dearest and the longest. */
export function openFilter(flights: ItineraryFlight[]): TripFlightFilter | null {
  if (!flights.length) return null;
  const meta = prepareFlightsData(flights);
  return {
    airline: meta.airlines,
    numOfStops: ["0", "1"],
    luggage: ["withCheckedBags", "withCabinBags"],
    departureRanges: [],
    arrivalRanges: [],
    maxPrice: Math.ceil(meta.maxPrice),
    flightDuration: Math.ceil(meta.maxDuration / 60),
  };
}

/** Where the sliders start: the cheapest party price and the shortest flight, in hours. */
export function filterFloor(flights: ItineraryFlight[]): { minPrice: number; minHours: number } {
  if (!flights.length) return { minPrice: 0, minHours: 0 };
  const meta = prepareFlightsData(flights);
  return { minPrice: meta.minPrice, minHours: Math.ceil(meta.minDuration / 60) };
}

/** `filter` with one of the filters' answers applied. */
export function withCriteria(filter: TripFlightFilter, c: FlightSearchCriteria): TripFlightFilter {
  return { ...filter, [c.type]: c.value };
}

/**
 * The flights that pass, in the list's own order (the step sorts them by its tab after). `null` =
 * no filter touched: every flight.
 */
export function filterTripFlights(flights: ItineraryFlight[], filter: TripFlightFilter | null): ItineraryFlight[] {
  if (!filter) return flights;
  const keep = new Set(applyFiltersAndSorting(flights, { ...filter, sortOption: "price_asc" }).map((f) => f.id));
  return flights.filter((f) => keep.has(f.id));
}

/** The airlines in the list, each once, for the filter's checkboxes. */
export function filterAirlines(flights: ItineraryFlight[]): { value: string; label: string }[] {
  return Array.from(new Map(flights.map((f) => [f.airline, { value: f.airline, label: f.metadata.name }])).values());
}
