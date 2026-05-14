"use client";

import { ReactNode } from "react";
import { orderStage } from "../app/hooks/Affiliate";
import { Event } from "@/lib/app.types";
import { trackEvent } from "@/lib/mixpanel";
import { computePackagePrice } from "@/lib/events/price";

export default function EventButton({
  event,
  children,
}: {
  event: Event;
  children: ReactNode;
}) {
  const tickets = event.tickets_and_rates || [];
  const hasAvailableTickets = tickets.some((t) => t?.available !== false);
  const computedTags = hasAvailableTickets ? event.tags : "Sold";
  return (
    <div
      onClick={() => {
        trackEvent("eventSelected", {
          eventId: event.id,
          eventName: event.name,
          eventDate: event.date,
          eventType: event.type,
          eventLocation: event.location.name,
          eventTags: computedTags,
          eventPrice: computePackagePrice(event),
        });
        if (computedTags === "Sold") {
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
                tags: computedTags,
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
