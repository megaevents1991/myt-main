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

  // Validate the flightOffer object for offline Flights
  if (!flightOffer || Object.keys(flightOffer).length === 0) {
    const penalties = `PE.PENALTIES 
CANCELLATIONS 
45 DAYS OR MORE BEFORE DEPARTURE CHARGE USD 100.00 FOR CANCELLATIONS PER TICKET.
44-30 DAYS BEFORE DEPARTURE CHARGE USD 250.00 FOR CANCELLATIONS PER TICKET.
LESS THAN 30 DAYS BEFORE DEPARTURE NON-REFUNDABLE. 
CHANGES 
BEFORE DEPARTURE CHARGE USD 120.00 FOR REISSUE/REVALIDATION. NOTE - WHEN THE FIRST FLIGHT COUPON IS BEING CHANGED NEW FARE WILL BE RECALCULATED USING FARES AND IATA RATE OF EXCHANGE IN EFFECT ON THE DATE OF REISSUE. 
AFTER DEPARTURE CHARGE USD 120.00 FOR REISSUE/REVALIDATION. CHARGE USD 200.00 FOR NO-SHOW. NOTE - BEFORE EXPIRY OF FLIGHT COUPON. UPGRADE TO ANY HIGHER FARE PERMITTED IN WHICH CASE CHANGE OF RESERVATION FEE OF USD 120.00 WILL ALSO APPLY. ------------------------------------------------ THE AP THE SECURITY AND INSURANCE SURCHARGE WHICH IS COLLECTED IN THE TFC AREA OF THE TICKET IS NOT REFUNDABLE. UNLESS THE TICKETS FARE IS FULLY REFUNDABLE `;
    return NextResponse.json({ bags: 65, penalties });
  } else if (flightOffer.validatingAirlineCodes[0] === 'LY') {
    const penalties = `PE.PENALTIES 
CANCELLATIONS
ACCORDING TO ISRAELI CONSUMER PROTECTION LAW.
FOR MORE INFORMATION PLEASE VISIT WWW.ELAL.COM/HEB/LEGAL/TICKET-CANCELLATION.`;
    return NextResponse.json({ bags: 65, penalties });
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
