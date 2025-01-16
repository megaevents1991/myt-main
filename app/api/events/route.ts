import { NextResponse } from "next/server";
import { getEvents } from "../eventsData";

export async function GET() {
  try {
    const events = await getEvents();

    if (!events.length) throw "failed to fetch events";

    return NextResponse.json({ events });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Failed to track affiliate event:", error);
    return NextResponse.json(
      { error: "Failed to track affiliate event" },
      { status: 500 }
    );
  }
}


/* 
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const event = events.find((e) => e.id === id);
    if (event) {
      return NextResponse.json(event);
    } else {
      return new NextResponse("Event not found", { status: 404 });
    }
  }

  return NextResponse.json(events);
}
*/
