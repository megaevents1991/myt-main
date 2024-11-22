import { NextResponse } from "next/server";
import { events, hotels } from "@/lib/events-data";

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

  // In a real application, you would filter hotels based on the event's location
  // For this example, we'll return all hotels
  return NextResponse.json(hotels);
}
