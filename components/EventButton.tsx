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
          eventPrice: event.usual_price,
        });
      }}
    >
      {children}
    </div>
  );
}
