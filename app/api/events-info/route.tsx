import { NextResponse, NextRequest } from "next/server";
import {
  trackServerSideEvent,
  extractIpFromRequest,
  extractUserAgentFromRequest,
  type EventType,
} from "@/lib/gtmAnalytics";
import { exchangeRateService } from "@/lib/exchangeRateService";
// Import ticket update service to ensure it's initialized on server startup
import "@/lib/ticketUpdateService";

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

// This route returns the current USD to ILS exchange rate from our cached service
// The rate is updated hourly in the background with retry logic and fallback

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest) {
  try {
    const rateInfo = exchangeRateService.getRateInfo();
    
    return NextResponse.json({
      success: true,
      travelRate: rateInfo.travelRate,
      lastUpdated: rateInfo.lastUpdated,
      source: rateInfo.source
    });
  } catch (error) {
    console.error("Error getting exchange rate:", error);

    // Return fallback rate if service fails
    const fallbackRate = 3.7;
    return NextResponse.json({
      success: false,
      travelRate: fallbackRate,
      source: 'fallback'
    });
  }
}
