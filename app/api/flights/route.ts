import { NextResponse } from "next/server";
import { events, flights } from "@/lib/events-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json(
      { error: "Event ID is required" },
      { status: 400 }
    );
  }

  const event = events.find((e) => e.id === eventId);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // In a real application, you would filter flights based on the event's location and date
  // For this example, we'll return all flights
  return NextResponse.json(flights);
}
