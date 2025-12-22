import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { getEventOrderIds, getPrimaryEventOrderInfo } from "@/lib/eventOrderInfo";

export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      );
    }

    // Extract event ID from the referrer URL path parameter
    const referrer = request.headers.get("referer");
    let eventIdFromPath: string | null = null;
    
    if (referrer) {
      // Match /order/[eventId] pattern in the referrer URL
      const orderPathMatch = referrer.match(/\/order\/(\d+)/);
      if (orderPathMatch) {
        eventIdFromPath = orderPathMatch[1];
      }
    }

    const { data: reservations } = await supabase
      .from("reservations")
      .select(
        "event_order_info, hotel_order_info, flight_order_info, main_contact_email, main_contact_first_name, main_contact_last_name, main_contact_phone_number, more_pax_info, created_at"
      )
      .eq("id", orderId)
      .limit(1)
      .single();

    if (!reservations) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Validate that the event ID matches the order's event ID if provided
    if (eventIdFromPath && reservations.event_order_info) {
      const ids = getEventOrderIds(reservations.event_order_info);
      if (ids.length > 0 && !ids.map(String).includes(eventIdFromPath)) {
        return NextResponse.json(
          {
            error: "This order does not belong to the specified event.",
            orderEventIds: ids,
            requestedEventId: eventIdFromPath,
          },
          { status: 403 }
        );
      }
    }

    // Validate that the request is being made within 24 hours of order creation
    // Using UTC to avoid timezone issues
    const orderCreatedAt = new Date(reservations.created_at);
    const now = new Date();
    const twentyFiveHours = 25 * 60 * 60 * 1000; // 25 hours in milliseconds
    const timeDifference = now.getTime() - orderCreatedAt.getTime();

    if (timeDifference > twentyFiveHours) {
      const primary = reservations.event_order_info
        ? getPrimaryEventOrderInfo(reservations.event_order_info)
        : undefined;
      return NextResponse.json(
        { 
          error: "Order access expired.",
          orderCreatedAt: orderCreatedAt.toISOString(),
          currentTime: now.toISOString(),
          hoursElapsed: Math.round(timeDifference / (60 * 60 * 1000) * 100) / 100,
          eventName: primary?.name // Include event name in error response
        },
        { status: 403 }
      );
    }

    // Remove created_at from the response as it's not needed by the client
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { created_at, ...orderData } = reservations;
    
    return NextResponse.json(orderData);
  } catch (Error) {
    console.error("Error processing order request:", Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
