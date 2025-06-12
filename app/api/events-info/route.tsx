import { NextResponse } from "next/server";
import {
  trackServerSideEvent,
  extractIpFromRequest,
  extractUserAgentFromRequest,
  type EventType,
} from "@/lib/gtmAnalytics";

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
