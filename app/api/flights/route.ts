/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from "next/server";
import { events } from "@/lib/events-data";
import Amadeus from "amadeus";

process.env.AMADEUS_CLIENT_ID = "306M5ysI3BdNXNuruBjACYZTo8lOb3WC";
process.env.AMADEUS_CLIENT_SECRET = "qnUSdtaUuMeWspSV";

// Initialize Amadeus client
const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_CLIENT_ID as string,
  clientSecret: process.env.AMADEUS_CLIENT_SECRET as string,
});

export async function GET(request: Request) {
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
    const destinationIataCode = "JFK";
    const originIataCode = "TLV";

    // Search for flights
    const response = await amadeus.shopping.flightOffersSearch.get({
      originLocationCode: originIataCode,
      destinationLocationCode: destinationIataCode,
      departureDate: event.date,
      returnDate: new Date(new Date(event.date).getTime() + 86400000)
        .toISOString()
        .split("T")[0],
      adults: "1",
      max: "10",
    });

    // Transform Amadeus response to match our flight data structure
    const flights = response.result.data.map((offer: any) => ({
      id: offer.id,
      airline: offer.validatingAirlineCodes[0],
      price: parseFloat(offer.price.total),
      departureTime: offer.itineraries[0].segments[0].departure.at,
      arrivalTime:
        offer.itineraries[0].segments[offer.itineraries[0].segments.length - 1]
          .arrival.at,
      departureAirport: offer.itineraries[0].segments[0].departure.iataCode,
      arrivalAirport:
        offer.itineraries[0].segments[offer.itineraries[0].segments.length - 1]
          .arrival.iataCode,
      stops: offer.itineraries[0].segments.length - 1,
      duration: offer.itineraries[0].duration,
      returnDepartureTime: offer.itineraries[1].segments[0].departure.at,
      returnArrivalTime:
        offer.itineraries[1].segments[offer.itineraries[1].segments.length - 1]
          .arrival.at,
    }));

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
