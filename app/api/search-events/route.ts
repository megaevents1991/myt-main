import { NextResponse } from "next/server";

import { getCachedEvents } from "@/lib/eventsData";

// Feeds the global header search modal (GlobalSearch). ISR-cached like the rest
// of the event data — only refetched on revalidate, not per request.
export const revalidate = 3600;

export async function GET() {
  try {
    const { events } = await getCachedEvents();
    return NextResponse.json({ events });
  } catch (error) {
    console.error("search-events route failed:", error);
    return NextResponse.json({ events: [] });
  }
}
