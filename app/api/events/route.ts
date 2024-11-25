/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { events } from "@/lib/events-data";

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
