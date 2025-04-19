"use client";

import { ReactNode } from "react";
import { orderStage } from "../app/hooks/Affiliate";
import { Event } from "@/lib/app.types";
import { trackEvent } from "@/lib/mixpanel";

export default function EventButton({
  event,
  children,
}: {
  event: Event;
  children: ReactNode;
}) {
  return (
    <div
      onClick={() => {
        orderStage("EVENT_SELECTED", {
          data: {
            event: event.name,
            eventDate: event.date,
            eventLocation: event.location.name,
          },
        });
        trackEvent("eventSelected", {
          eventId: event.id,
          eventName: event.name,
          eventDate: event.date,
          eventLocation: event.location.name,
          eventPrice:
            event.base_flight_price +
            event.base_hotel_price +
            Math.min(...event.tickets_and_rates.map((ticket) => ticket.price)) +
            Number(process.env.NEXT_PUBLIC_MARKUP || "150"),
        });
      }}
    >
      {children}
    </div>
  );
}
