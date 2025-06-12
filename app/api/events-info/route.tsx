import { NextResponse, NextRequest } from "next/server";
import {
  trackServerSideEvent,
  extractIpFromRequest,
  extractUserAgentFromRequest,
  type EventType,
} from "@/lib/gtmAnalytics";

// GTM server-side event tracking route
// This route handles POST requests to track events server-side using Google Tag Manager (GTM).
export async function POST(request: Request) {
  try {
    const {
      eventData,
      gtmIdnts,
      eventType = "select_item",
    }: {
      eventData: {
        id: number;
        name: string;
      };
      gtmIdnts?: string;
      eventType?: EventType;
    } = await request.json();

    const ip = extractIpFromRequest(request);
    const userAgent = extractUserAgentFromRequest(request);

    const success = await trackServerSideEvent({
      eventData,
      eventType,
      gtmIdnts,
      userAgent,
      ip,
    });

    if (!success) {
      return NextResponse.json(
        { error: "Analytics tracking failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in analytics tracking:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// This route fetches the current USD to ILS exchange rate from an external API
// and returns it in a JSON response. If the API call fails, it returns a fallback rate.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest) {
  try {
    const response = await fetch(
      "https://api.twelvedata.com/exchange_rate?symbol=USD/ILS&apikey=43c9bbfbf1cb4a1990c01a1a6d9ddf2f"
    );

    if (!response.ok) {
      throw new Error("Failed to fetch exchange rate from API");
    }

    const data = await response.json();

    if (data && data.rate) {
      const USD_ILS_Rate = Math.ceil(data.rate * 100) / 100;
      const exchangeRateTravel = Math.ceil(USD_ILS_Rate * 1.015 * 100) / 100; // Adding 1.5% for travel expenses

      return NextResponse.json({
        success: true,
        travelRate: exchangeRateTravel,
      });
    } else {
      throw new Error("Invalid exchange rate data");
    }
  } catch (error) {
    console.error("Error fetching exchange rate:", error);

    // Return fallback rate
    const fallbackRate = 3.7;
    return NextResponse.json({
      success: false,
      travelRate: fallbackRate,
    });
  }
}
