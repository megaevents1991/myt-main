import { NextResponse } from "next/server";
import { amadeus } from "../amadeusClient";

export const maxDuration = 30;

type BaggageItem = {
  quantity: number;
  name: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  bookableByItinerary: boolean;
  segmentIds: string[];
  travelerIds: string[];
};

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
    const response = await amadeus.shopping.flightOffers.pricing.post(
      {
        data: {
          type: "flight-offers-pricing",
          flightOffers: [flightOffer],
        },
      },
      { include: ["bags", "detailed-fare-rules"] }
    );

    // processing the response and returning it to the client.

    const data = JSON.parse(response.body);

    const penalties = data.included?.["detailed-fare-rules"]?.[
      "1"
    ]?.fareNotes?.descriptions?.find(
      (desc: Record<string, unknown>) => desc.descriptionType === "PENALTIES"
    )?.text;

    if (!data.included?.["detailed-fare-rules"]?.["1"]) {
      console.warn("No detailed fare rules found in the response.", {
        itineraries: flightOffer.itineraries,
        data: data.included?.["detailed-fare-rules"],
      });
    }

    const bagCostString = (
      Object.values(data?.included["bags"] ?? {}) as BaggageItem[]
    ).find((item) => item.quantity === 1 && item.name === "CHECKED_BAG")?.price
      ?.amount;
    let bags = parseInt(bagCostString || "0");
    if (bags) {
      bags = bags + 5;
    } // TODO: convert euro to USD

    return NextResponse.json({ bags, penalties });
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
