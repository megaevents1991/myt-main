import { NextResponse } from "next/server";
import { getEvents } from "@/lib/eventsData";

export async function GET(request: Request) {
  const startTime = Date.now();
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const userAgent = request.headers.get('user-agent') || 'Unknown';
  const ip = request.headers.get('x-forwarded-for') || 
           request.headers.get('x-real-ip') || 
           'Unknown';

  try {
    console.log(`[Events API] Starting request - ID: ${id}, IP: ${ip}, UserAgent: ${userAgent}`);
    
    const { events } = await getEvents(id ? parseInt(id) : undefined);
    const responseTime = Date.now() - startTime;

    if (!events.length) {
      const error = `No events found - ID: ${id}, Query took: ${responseTime}ms`;
      console.error(`[Events API] ${error}`);
      
      // Log additional context for debugging
      console.error(`[Events API] Context - IP: ${ip}, UserAgent: ${userAgent}, Timestamp: ${new Date().toISOString()}`);
      
      return NextResponse.json(
        { 
          error: "failed to fetch events",
          context: {
            requestId: `req_${Date.now()}`,
            timestamp: new Date().toISOString(),
            searchId: id
          }
        },
        { status: 404 }
      );
    }

    console.log(`[Events API] Success - Returned ${events.length} events in ${responseTime}ms`);
    return NextResponse.json({ events });
    
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const errorDetails = {
      message: error?.message || error,
      stack: error?.stack,
      name: error?.name,
      searchId: id,
      ip,
      userAgent,
      responseTime,
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now()}`
    };

    console.error("[Events API] Failed to fetch events:", errorDetails);

    return NextResponse.json(
      { 
        error: "failed to fetch events",
        context: {
          requestId: errorDetails.requestId,
          timestamp: errorDetails.timestamp
        }
      },
      { status: 500 }
    );
  }
}