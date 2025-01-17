import { NextResponse } from "next/server";
import { getEvents } from "../eventsData";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json(
      { error: "Event ID is required" },
      { status: 400 }
    );
  }

  const { events } = await getEvents();

  const event = events.find((e) => e.id === +eventId);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const tickets = [
    { type: "standard", price: event.tickets_and_rates[0].price },
    { type: "vip", price: event.tickets_and_rates[1].price },
  ];

  return NextResponse.json(tickets);
}
