import { NextResponse } from "next/server";

import { getCachedEvents } from "@/lib/eventsData";
import { getAllArtists } from "@/lib/artists";

// Feeds the global header search modal (GlobalSearch): events for the package
// search + artists for the "all shows of <artist>" link. ISR-cached like the
// rest of the event data — only refetched on revalidate, not per request.
export const revalidate = 3600;

export async function GET() {
  try {
    const [{ events }, artists] = await Promise.all([
      getCachedEvents(),
      getAllArtists().catch(() => []),
    ]);
    return NextResponse.json({ events, artists });
  } catch (error) {
    console.error("search-events route failed:", error);
    return NextResponse.json({ events: [], artists: [] });
  }
}
