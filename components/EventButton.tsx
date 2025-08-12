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
          eventType: event.type,
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
        const gtmIdnts =
          document.cookie
            .split("; ")
            .find((row) => row.startsWith("gtmIdnts="))
            ?.split("=")[1] || "";
          // Send event data to the server
          fetch("/api/events-info", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              eventData: {
                id: event.id,
                name: event.name,
                date: event.date,
                category: event.type,
                location: event.location.name,
                tags: event.tags
              },
              gtmIdnts,
              eventType: "select_item",
            }),
          }).catch((error) => {
            console.error("Analytics tracking failed:", error);
          });
      }}
    >
      {children}
    </div>
  );
}
