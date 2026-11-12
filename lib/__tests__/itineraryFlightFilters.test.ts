import { describe, expect, it } from "vitest";
import type { FlightSegment, ItineraryFlight } from "../app.types";
import { filterAirlines, filterFloor, filterTripFlights, openFilter, withCriteria } from "../itinerary/flightFilters";

const seg = (dep: string, over: Partial<FlightSegment> = {}): FlightSegment => ({
  departureTime: dep,
  arrivalTime: dep,
  departureAirport: "TLV",
  arrivalAirport: "LHR",
  stops: [{ iataCode: "LHR", duration: null }],
  duration: "PT5H",
  checkBagsIncluded: true,
  cabinBagsIncluded: true,
  ...over,
});

const flight = (id: string, price: number, airline: string, out: FlightSegment, stops = 0): ItineraryFlight =>
  ({
    id,
    price,
    airline,
    legs: [out, seg("2027-05-16T20:00:00")],
    outbound: out,
    inbound: seg("2027-05-16T20:00:00"),
    trainLegs: [],
    stops,
    duration: out.duration,
    metadata: { iata: airline, name: `${airline} air`, logo: "", country: "" },
  }) as unknown as ItineraryFlight;

const elal = flight("a", 1200, "LY", seg("2027-05-11T06:00:00"));
const ba = flight("b", 900, "BA", seg("2027-05-11T14:00:00", { checkBagsIncluded: false }));
const twoStops = flight("c", 700, "TK", seg("2027-05-11T22:00:00", { duration: "PT14H" }), 2);
const list = [elal, ba, twoStops];

describe("trip flight filters (Alon 12.11: the regular step's filters on the round trip)", () => {
  it("filters nothing until a filter is touched - a flight with two stops stays", () => {
    expect(filterTripFlights(list, null)).toEqual(list);
  });

  it("opens on the list's own limits: every airline, any bag, the dearest, the longest", () => {
    expect(openFilter(list)).toEqual({
      airline: ["LY", "BA", "TK"],
      numOfStops: ["0", "1"],
      luggage: ["withCheckedBags", "withCabinBags"],
      departureRanges: [],
      arrivalRanges: [],
      maxPrice: 1200,
      flightDuration: 14,
    });
    expect(openFilter([])).toBeNull();
    expect(filterFloor(list)).toEqual({ minPrice: 700, minHours: 5 });
  });

  it("an airline, a price cap and checked bags narrow the list, in the list's order", () => {
    const open = openFilter(list)!;
    expect(filterTripFlights(list, withCriteria(open, { type: "airline", value: ["BA"] })).map((f) => f.id)).toEqual(["b"]);
    expect(filterTripFlights(list, withCriteria(open, { type: "maxPrice", value: 1000 })).map((f) => f.id)).toEqual(["b"]);
    expect(filterTripFlights(list, withCriteria(open, { type: "luggage", value: ["withCheckedBags"] })).map((f) => f.id)).toEqual(["a"]);
  });

  it("names each airline once", () => {
    expect(filterAirlines([elal, ba, flight("d", 1000, "LY", seg("2027-05-11T09:00:00"))])).toEqual([
      { value: "LY", label: "LY air" },
      { value: "BA", label: "BA air" },
    ]);
  });
});
