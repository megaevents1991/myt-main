import { NextResponse } from "next/server";
import {
  isAmadeusRateLimited,
  isAmadeusSystemError,
  itineraryFlightsFromOffers,
  multiCityBody,
  validateFlightRequest,
  type AmadeusOffer,
} from "@/lib/itinerary/flightOffers";
import { itineraryOn } from "@/lib/itinerary/settings";
import { getItinerarySettings } from "@/lib/itinerary/settings.server";
import { amadeus } from "@/app/api/flights/amadeusClient";

export const maxDuration = 30;

/** One retry, not the live route's three: a search takes ~8 s and `maxDuration` is 30. */
const SYSTEM_ERROR_RETRY_DELAY_MS = 1000;

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
 *
 * 404 while the feature is switched off (the pages', actions' and confirm's own switch - no
 * supplier call is spent then), 400 bad body, 429 `{ busy: true }` when Amadeus throttles us
 * (retry later), 502 any other failure of the search call (Amadeus error or the network on the
 * way), 500 anything else.
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

  // Never throws (a failed settings read = the defaults = off in production).
  if (!itineraryOn(await getItinerarySettings(), process.env.VERCEL_ENV)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const check = validateFlightRequest(body, todayIso);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    const { legs, adults, nonStop } = check.request;

    // Amadeus per-request client reference (ama-Client-Ref), for support tracing.
    const clientRef = `MYT-IT-${Date.now()}`;
    const search = () =>
      amadeus.shopping.flightOffersSearch.post(multiCityBody(legs, adults, nonStop), clientRef);

    let result: AmadeusSearchResult;
    try {
      let response;
      try {
        response = await search();
      } catch (error) {
        if (!isAmadeusSystemError(error)) throw error;
        // Amadeus' transient "SYSTEM ERROR HAS OCCURRED": once more, then give up.
        console.warn(
          `Itinerary flight search: Amadeus system error, retrying in ${SYSTEM_ERROR_RETRY_DELAY_MS}ms.`,
        );
        await new Promise((resolve) => setTimeout(resolve, SYSTEM_ERROR_RETRY_DELAY_MS));
        response = await search();
      }
      result = response.result;
    } catch (error) {
      const detail = (error as { response?: { result?: { errors?: unknown } } })?.response
        ?.result?.errors;
      console.error(
        "Itinerary flight search failed:",
        detail ? JSON.stringify(detail) : error,
      );
      if (isAmadeusRateLimited(error)) {
        return NextResponse.json(
          { busy: true, error: "Flight search is busy, try again in a moment." },
          { status: 429 },
        );
      }
      return NextResponse.json({ error: "Flight search failed." }, { status: 502 });
    }

    const { flights, failed, firstError } = itineraryFlightsFromOffers(
      result?.data ?? [],
      legs.length,
      adults,
      result?.dictionaries?.carriers ?? {},
    );
    if (failed > 0) {
      // One line per search, not per offer: a bad batch must not flood the log.
      console.error(
        `Itinerary flight search: ${failed} offer(s) skipped, first error:`,
        firstError,
      );
    }

    return NextResponse.json({ flights });
  } catch (error) {
    console.error("Itinerary flights route error:", error);
    return NextResponse.json({ error: "Failed to search flights." }, { status: 500 });
  }
}
