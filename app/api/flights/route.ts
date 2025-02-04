import { NextResponse } from "next/server";
import { getEvents } from "../eventsData";
import Amadeus from "amadeus";
import {
  FlightSearchOptions,
  FlightSegment,
  Event,
  Flight,
} from "@/lib/app.types";
import { getAirlineByIata } from "aircodes";

// Initialize Amadeus client
const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_CLIENT_ID as string,
  clientSecret: process.env.AMADEUS_CLIENT_SECRET as string,
});

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

  try {
    const {
      returnDate: returnDateFromUi,
      departureDate: departureDateFromUi,
      originLocationCode = "TLV",
      adults,
      destinationLocationCode,
      nonStop,
    }: FlightSearchOptions = await request.json();

    // Get airports for the city
    const locations = await amadeus.referenceData.locations.get({
      keyword: event.location.city_iata,
      subType: "AIRPORT",
    });

    const iataCodes = locations.data.map(({ iataCode }) => iataCode);

    const departureDate = new Date(
      departureDateFromUi || new Date(event.date).getTime() - 2 * 8.64e7
    )
      .toISOString()
      .split("T")[0];

    const returnDate = new Date(
      returnDateFromUi || new Date(event.date).getTime() + 8.64e7
    )
      .toISOString()
      .split("T")[0];

    const response = await amadeus.shopping.flightOffersSearch.get({
      originLocationCode,
      destinationLocationCode: destinationLocationCode || iataCodes[0],
      departureDate,
      returnDate,
      adults: adults || 1,
      max: 100,
      nonStop,
    });

    // Transform Amadeus response to match our flight data structure
    const flights: Flight[] = response.result.data.map(
      ({
        id,
        validatingAirlineCodes,
        price,
        itineraries,
        travelerPricings,
      }) => {
        const toDeparture = itineraries[0].segments[0];
        const toArrival = itineraries[0].segments.at(-1);

        const fromDeparture = itineraries[1].segments[0];
        const fromArrival = itineraries[1].segments.at(-1);

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

        const fromCheckBagsIncluded = itineraries[0].segments.every(
          (segment) => {
            return travelerPricings[0].fareDetailsBySegment.some((fare) => {
              return (
                fare.segmentId === segment.id &&
                fare.includedCheckedBags?.quantity
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

        const outbound: FlightSegment = {
          stops: toStops,
          departureTime: toDeparture.departure.at,
          departureAirport: toDeparture.departure.iataCode,
          arrivalAirport: toArrival?.arrival.iataCode || "",
          arrivalTime: toArrival?.arrival.at || "0",
          duration: itineraries[0].duration,
          checkBagsIncluded: fromCheckBagsIncluded,
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
          flightNumber:
            validatingAirlineCodes[0] + itineraries[1].segments[0].number,
        };

        return {
          id,
          numOfTravelers: travelerPricings.length,
          price: parseFloat(price.total),
          duration: itineraries[0].duration,
          stops: itineraries[0].segments.length - 1,
          airline: validatingAirlineCodes[0],
          outbound,
          inbound,
          metadata: {
            ...getAirlineByIata(validatingAirlineCodes[0]),
            name: response.result.dictionaries.carriers[
              validatingAirlineCodes[0]
            ],
          },
        };
      }
    );

    return NextResponse.json(flights);
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
