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
        trackEvent("eventSelected", {
          eventId: event.id,
          eventName: event.name,
          eventDate: event.date,
          eventLocation: event.location.name,
          eventStatus: event.tags,
          eventPrice:
            event.base_flight_price +
            event.base_hotel_price +
            (event.tickets_and_rates?.length > 0 
              ? Math.min(...event.tickets_and_rates.map((ticket) => ticket.price))
              : 0) +
            Number(process.env.NEXT_PUBLIC_MARKUP || "150"),
        });
        if (event.tags === "Sold") {
          return;
        }
        orderStage("EVENT_SELECTED", {
          data: {
            event: event.name,
            eventDate: event.date,
            eventLocation: event.location.name,
          },
        });
      }}
    >
      {children}
    </div>
  );
}
