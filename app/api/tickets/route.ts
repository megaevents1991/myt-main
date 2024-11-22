import { NextResponse } from "next/server";
import { events } from "@/lib/events-data";

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

  const tickets = [
    { type: "standard", price: event.price },
    { type: "vip", price: event.price * 2 },
  ];

  return NextResponse.json(tickets);
}
