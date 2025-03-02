import { NextResponse } from "next/server";
import { getEvents } from "../eventsData";

export async function GET() {
  try {
    const { events } = await getEvents();

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