import { NextResponse } from "next/server";
import { getEvents } from "../eventsData";

export async function GET(request: Request) {
  try {
    // Extract the 'id' parameter from the request URL, if present
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    const { events } = await getEvents(id ? parseInt(id) : undefined);

    if (!events.length) throw "failed to fetch events";

    return NextResponse.json({ events });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("failed to fetch events:", error);
    return NextResponse.json(
      { error: "failed to fetch events" },
      { status: 500 }
    );
  }
}