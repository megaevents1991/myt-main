import { NextResponse } from "next/server";
import {
  FlightSearchOptions,
  FlightSegment,
  Event,
  Flight,
} from "@/lib/app.types";
import { getAirlineByIata } from "aircodes";
import { amadeus } from "../amadeusClient";
import { getEvents } from "@/lib/eventsData";
import dayjs from "dayjs";
import { supabase } from "@/lib/supabase";
import { serialize } from 'tinyduration';
import { 
  trackServerSideEvent, 
  extractIpFromRequest, 
  extractUserAgentFromRequest 
} from "@/lib/gtmAnalytics";

export const maxDuration = 30;
const currencyCode = "USD";
const MAX_STOP_DURATION_HOURS = 4;
const MAX_STOPS = 1; // Maximum allowed stops per journey

const PTfunction = (duration: string): string => {
  const parts = duration.split(":").map(Number);
  const hours = parts[0];
  const minutes = parts[1];

  const durationObject = {
    hours: hours,
    minutes: minutes,
  };
  return serialize(durationObject);
};

const transformDbFlightToFlight = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dbFlight: any,
  id: number,
  num_of_travelers: number
): Flight => {
  if (
    dbFlight.initial_quantity - dbFlight.consumed_quantity <
    num_of_travelers
  ) {
    return {} as Flight;
  }
  return {
    offer: {} as Flight["offer"],
    id: (id + 1).toString(),
    numOfTravelers: num_of_travelers,
    price: parseFloat(dbFlight.price) * num_of_travelers,
    duration: PTfunction(dbFlight.duration),
    stops: dbFlight.stops,
    airline: dbFlight.airline_code,
    outbound: {
      stops: [
        {
          iataCode: dbFlight.outbound_arrival_airport,
          duration: null,
        },
      ],
      departureTime: dbFlight.outbound_departure_time,
      departureAirport: dbFlight.outbound_departure_airport,
      arrivalAirport: dbFlight.outbound_arrival_airport,
      arrivalTime: dbFlight.outbound_arrival_time,
      duration: PTfunction(dbFlight.outbound_duration),
      checkBagsIncluded: dbFlight.outbound_check_bags_included,
      cabinBagsIncluded: dbFlight.outbound_cabin_bags_included,
      flightNumber: dbFlight.outbound_flight_number,
    },
    inbound: {
      stops: [
        {
          iataCode: dbFlight.inbound_arrival_airport,
          duration: null,
        },
      ],
      departureTime: dbFlight.inbound_departure_time,
      departureAirport: dbFlight.inbound_departure_airport,
      arrivalAirport: dbFlight.inbound_arrival_airport,
      arrivalTime: dbFlight.inbound_arrival_time,
      duration: PTfunction(dbFlight.inbound_duration),
      checkBagsIncluded: dbFlight.inbound_check_bags_included,
      cabinBagsIncluded: dbFlight.inbound_cabin_bags_included,
      flightNumber: dbFlight.inbound_flight_number,
    },
    metadata: {
      iata: dbFlight.metadata_iata,
      country: dbFlight.metadata_country,
      name: dbFlight.metadata_name,
      logo: dbFlight.metadata_logo,
    },
  };
};

const getOfflineFlightsFromDB = async (
  destination: string,
  depart_date: string,
  return_date: string,
  indexShift: number,
  num_of_travelers: number
): Promise<Flight[]> => {
  try {
    const { data: flights, error } = await supabase
      .from("flights")
      .select("*")
      .eq("outbound_arrival_airport", destination)
      .gte("outbound_departure_time", `${depart_date}T00:00:00`)
      .lt("outbound_departure_time", `${depart_date}T23:59:59`)
      .gte("inbound_departure_time", `${return_date}T00:00:00`)
      .lt("inbound_departure_time", `${return_date}T23:59:59`);

    if (error) throw error;

    // Transform DB records to Flight objects
    return flights
      ? flights.map((flight, index) =>
          transformDbFlightToFlight(
            flight,
            index + indexShift,
            num_of_travelers
          )
        )
      : ([] as Flight[]);
  } catch (error) {
    console.error("DB flights static data retrieval error:", error);
    return [] as Flight[];
  }
};

export async function POST(request: Request) {
  if (!amadeus) {
    return NextResponse.json(
      {
        error:
          "Amadeus client is not initialized. Check your environment variables.",
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const eventId = parseInt(searchParams.get("eventId") || "", 10);

  if (!eventId) {
    return NextResponse.json(
      { error: "Event ID is required" },
      { status: 400 }
    );
  }

  const { events }: { events: Event[] } = await getEvents();

  const event = events.find((e) => e.id === eventId);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const {
      returnDate: returnDateFromUi,
      departureDate: departureDateFromUi,
      originLocationCode = "TLV",
      adults,
      nonStop,
      gtmIdnts,
    }: FlightSearchOptions = await request.json();

  // Track flight search analytics
  try {
    const ip = extractIpFromRequest(request);
    const userAgent = extractUserAgentFromRequest(request);
    
    await trackServerSideEvent({
      eventData: {
        id: event.id,
        name: event.name,
        value: 1500,
        currency: "USD",
        category: event.type || "music_event",
        brand: "Mega Events"
      },
      eventType: "add_to_cart",
      gtmIdnts,
      userAgent,
      ip,
    });
  } catch (analyticsError) {
    // Don't fail the main request if analytics fails
    console.warn("Analytics tracking failed for flight search:", analyticsError);
  }

  try {
    const departureDate = dayjs(departureDateFromUi).format("YYYY-MM-DD");
    const returnDate = dayjs(returnDateFromUi).format("YYYY-MM-DD");

    const response = await amadeus.shopping.flightOffersSearch.get({
      originLocationCode,
      destinationLocationCode: event.location.city_iata,
      departureDate,
      returnDate,
      adults: adults || 1,
      max: 250,
      nonStop,
      currencyCode,
    });

    const flights = await getOfflineFlightsFromDB(
      event.location.city_iata,
      departureDate,
      returnDate,
      0,
      adults || 1
    );

    // Transform Amadeus response to match our flight data structure
    const moreFlights: Flight[] = response.result.data.reduce(
      (acc, offer, index) => {
        const adjustedIndex = index + flights.length + 1; // Adjust index to avoid conflicts with offline flights
        const { validatingAirlineCodes, price, itineraries, travelerPricings } =
          offer;
        const airlineByIata = getAirlineByIata(validatingAirlineCodes[0]);

        if (!airlineByIata.logo) {
          return acc;
        }

        // Filter flights with too many stops (early check)
        const outboundStops = itineraries[0].segments.length - 1;
        const inboundStops = itineraries[1].segments.length - 1;

        if (outboundStops > MAX_STOPS || inboundStops > MAX_STOPS) {
          return acc; // Skip flights with too many stops
        }

        const toDeparture = itineraries[0].segments[0];
        const toArrival = itineraries[0].segments.at(-1);
        const fromDeparture = itineraries[1].segments[0];
        const fromArrival = itineraries[1].segments.at(-1);

        // Calculate stops and durations early
        const toStops = itineraries[0].segments.map((segment, i) => ({
          iataCode: segment.arrival.iataCode,
          duration: Math.ceil(
            (new Date(
              itineraries[0].segments?.[i + 1]?.departure?.at
            ).getTime() -
              new Date(segment.arrival.at).getTime()) /
              1000 /
              60 /
              60
          ),
        }));

        const fromStops = itineraries[1].segments.map((segment, i) => ({
          iataCode: segment.arrival.iataCode,
          duration: Math.ceil(
            (new Date(
              itineraries[1].segments?.[i + 1]?.departure?.at
            ).getTime() -
              new Date(segment.arrival.at).getTime()) /
              1000 /
              60 /
              60
          ),
        }));

        const hasLongLayover =
          toStops.some((stop) => stop.duration > MAX_STOP_DURATION_HOURS) ||
          fromStops.some((stop) => stop.duration > MAX_STOP_DURATION_HOURS);

        // Skip flights with layovers longer than threshold
        if (hasLongLayover) {
          return acc;
        }

        const fromCheckBagsIncluded = itineraries[0].segments.every((segment) =>
          travelerPricings[0].fareDetailsBySegment.some(
            (fare) =>
              fare.segmentId === segment.id &&
              fare.includedCheckedBags?.quantity
          )
        );
        const fromCabinBagsIncluded = itineraries[0].segments.every(
          (segment) => {
            return travelerPricings[0].fareDetailsBySegment.some((fare) => {
              return (
                fare.segmentId === segment.id &&
                fare.includedCabinBags?.quantity
              );
            });
          }
        );

        const toCheckBagsIncluded = itineraries[1].segments.every((segment) => {
          return travelerPricings[0].fareDetailsBySegment.some((fare) => {
            return (
              fare.segmentId === segment.id &&
              fare.includedCheckedBags?.quantity
            );
          });
        });

        const toCabinBagsIncluded = itineraries[1].segments.every((segment) => {
          return travelerPricings[0].fareDetailsBySegment.some((fare) => {
            return (
              fare.segmentId === segment.id && fare.includedCabinBags?.quantity
            );
          });
        });

        if (
          fromCabinBagsIncluded !== toCabinBagsIncluded ||
          fromCheckBagsIncluded !== toCheckBagsIncluded
        ) {
          return acc; // Skip flights with inconsistent baggage policies
        }

        const outbound: FlightSegment = {
          stops: toStops,
          departureTime: toDeparture.departure.at,
          departureAirport: toDeparture.departure.iataCode,
          arrivalAirport: toArrival?.arrival.iataCode || "",
          arrivalTime: toArrival?.arrival.at || "0",
          duration: itineraries[0].duration,
          checkBagsIncluded: fromCheckBagsIncluded,
          cabinBagsIncluded: fromCabinBagsIncluded,
          flightNumber:
            validatingAirlineCodes[0] + itineraries[0].segments[0].number,
        };

        const inbound: FlightSegment = {
          departureTime: fromDeparture.departure.at,
          departureAirport: fromDeparture.departure.iataCode,
          arrivalAirport: fromArrival?.arrival.iataCode || "",
          arrivalTime: fromArrival?.arrival.at || "0",
          stops: fromStops,
          duration: itineraries[1].duration,
          checkBagsIncluded: toCheckBagsIncluded,
          cabinBagsIncluded: toCabinBagsIncluded,
          flightNumber:
            validatingAirlineCodes[0] + itineraries[1].segments[0].number,
        };

        acc.push({
          offer,
          id: adjustedIndex.toString(),
          numOfTravelers: travelerPricings.length,
          price: parseFloat(price.grandTotal),
          duration: itineraries[0].duration,
          stops: itineraries[0].segments.length - 1,
          airline: validatingAirlineCodes[0],
          outbound,
          inbound,
          metadata: {
            ...airlineByIata,
            name: response.result.dictionaries.carriers[
              validatingAirlineCodes[0]
            ],
          },
        });

        // Special Handling: Check and update logo for LUFTHANSA
        const currentFlight = acc[acc.length - 1];
        if (currentFlight.metadata.name === "LUFTHANSA") {
          currentFlight.metadata.logo =
            "https://www.avcodes.co.uk/images/logos/DLH.png";
        }

        return acc;
      },
      [] as Flight[]
    );

    const debug = {
      departureDate: departureDateFromUi,
      returnDate: returnDateFromUi,
    };

    flights.push(...moreFlights);

    return NextResponse.json({ flights, debug });
  } catch (error) {
    console.error("Error fetching flights:", error);
    return NextResponse.json(
      {
        error:
          "Failed to fetch flight data. Please check the server logs for more information.",
      },
      { status: 500 }
    );
  }
}
