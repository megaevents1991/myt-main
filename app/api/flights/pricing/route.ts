import { NextResponse } from "next/server";
import { amadeus } from "../amadeusClient";

export const maxDuration = 30;

export async function POST(request: Request) {
  const { flightOffer }: { flightOffer: FlightOffer } = await request.json();

  if (!amadeus) {
    return NextResponse.json(
      {
        error:
          "Amadeus client is not initialized. Check your environment variables.",
      },
      { status: 500 }
    );
  }
  try {
    const response = await amadeus.shopping.flightOffers.pricing.post({
      data: {
        type: "flight-offers-pricing",
        flightOffers: [flightOffer],
      },
      include: "detailed-fare-rules",
    });

    // proccessing the response and returning it to the client.
    
    return NextResponse.json(response);
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
