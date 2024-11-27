import { NextResponse } from "next/server";
import { events } from "@/lib/events-data";
import Amadeus from "amadeus";
import { FlightSearchOptions } from "@/lib/app.types";

process.env.AMADEUS_CLIENT_ID = "306M5ysI3BdNXNuruBjACYZTo8lOb3WC";
process.env.AMADEUS_CLIENT_SECRET = "qnUSdtaUuMeWspSV";

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
  const eventId = searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json(
      { error: "Event ID is required" },
      { status: 400 }
    );
  }

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
      keyword: event.citi,
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
      max: 10,
      nonStop,
    });

    // Transform Amadeus response to match our flight data structure
    const flights = response.result.data.map(
      ({ id, validatingAirlineCodes, price, itineraries }) => {
        const toDeparture = itineraries[0].segments[0];
        const toArrival = itineraries[0].segments.at(-1);

        const fromDeparture = itineraries[1].segments[0];
        const fromArrival = itineraries[1].segments.at(-1);

        return {
          id,
          price: parseFloat(price.total),
          duration: itineraries[0].duration,
          stops:
            itineraries[0].segments.length + itineraries[1].segments.length - 2,
          airline: validatingAirlineCodes[0],
          departureTime: toDeparture.departure.at,
          departureAirport: toDeparture.departure.iataCode,
          arrivalAirport: toArrival?.arrival.iataCode,
          arrivalTime: toArrival?.arrival.at || 0,
          returnDepartureTime: fromDeparture.departure.at,
          returnArrivalTime: fromArrival?.arrival.at || 0,
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
