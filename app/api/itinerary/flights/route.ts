import { NextResponse } from "next/server";
import type { ItineraryFlight } from "@/lib/app.types";
import {
  multiCityBody,
  offerToItineraryFlight,
  validateFlightRequest,
  type AmadeusOffer,
  type FlightLeg,
} from "@/lib/itinerary/flightOffers";
import { amadeus } from "@/app/api/flights/amadeusClient";

export const maxDuration = 30;

type AmadeusSearchResult = {
  data?: AmadeusOffer[];
  dictionaries?: { carriers?: Record<string, string> };
};

/**
 * POST /api/itinerary/flights - the flights of a multi-event trip ("Build Your Euro
 * Trip"): ONE Amadeus multi-city search whose itineraries are the legs, TLV -> first
 * stay -> ... -> TLV. Body `{ legs: { from, to, date }[], adults, nonStop? }`; answers
 * `{ flights: ItineraryFlight[] }`, cheapest first. The offer rules are the live flight
 * step's (lib/itinerary/flightOffers.ts).
 */
export async function POST(request: Request) {
  if (
    !amadeus ||
    !process.env.NEW_AMADEUS_CLIENT_ID ||
    !process.env.NEW_AMADEUS_CLIENT_SECRET
  ) {
    return NextResponse.json(
      { error: "Flight search is not configured." },
      { status: 500 },
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const invalid = validateFlightRequest(body, todayIso);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const { legs, adults, nonStop } = body as {
      legs: FlightLeg[];
      adults: number;
      nonStop?: boolean;
    };

    // Amadeus per-request client reference (ama-Client-Ref), for support tracing.
    const clientRef = `MYT-IT-${Date.now()}`;

    let result: AmadeusSearchResult;
    try {
      const response = await amadeus.shopping.flightOffersSearch.post(
        multiCityBody(legs, adults, nonStop === true),
        clientRef,
      );
      result = response.result;
    } catch (error) {
      const detail = (error as { response?: { result?: { errors?: unknown } } })?.response
        ?.result?.errors;
      console.error(
        "Itinerary flight search failed:",
        detail ? JSON.stringify(detail) : error,
      );
      return NextResponse.json({ error: "Flight search failed." }, { status: 502 });
    }

    const carriers = result?.dictionaries?.carriers ?? {};
    const flights: ItineraryFlight[] = [];
    for (const offer of result?.data ?? []) {
      // One itinerary per requested leg - anything else is not this trip.
      if (offer.itineraries?.length !== legs.length) continue;
      const flight = offerToItineraryFlight(offer, String(flights.length + 1), adults, carriers);
      if (flight) flights.push(flight);
    }
    flights.sort((a, b) => a.price - b.price);

    return NextResponse.json({ flights });
  } catch (error) {
    console.error("Itinerary flights route error:", error);
    return NextResponse.json({ error: "Failed to search flights." }, { status: 500 });
  }
}
