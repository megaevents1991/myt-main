"use client";

import { Suspense, useContext, useState, useEffect } from "react";
import { OrderForm } from "./OrderForm";
import { Event } from "@/lib/app.types";
import { DatesProvider } from "@mantine/dates";
import "dayjs/locale/he";
import { OrderContext } from "../app.context";
import MegaEventsSection from "@/components/ui/aboutUsMega";

interface OrderPageClientProps {
  initialEvent?: Event;
  eventId?: string;
}

export default function OrderPageClient({ initialEvent, eventId }: OrderPageClientProps) {
  const { event, setEvent } = useContext(OrderContext);
  const [showAboutSection, setShowAboutSection] = useState(false);

  // Set the event from props when component mounts, or fetch it if we have eventId but no event
  useEffect(() => {
    if (initialEvent && !event) {
      setEvent(initialEvent);
    } else if (eventId && !event && !initialEvent) {
      // Fallback to client-side fetching if server-side failed
      const fetchData = async () => {
        try {
          const response = await fetch(`/api/events?id=${eventId}`);
          const { events }: { events: Event[] } = await response.json();
          const fetchedEvent = events.find((e) => e.id === parseInt(eventId));
          if (fetchedEvent) {
            setEvent(fetchedEvent);
          }
        } catch (error) {
          console.error("Error fetching event:", error);
        }
      };
      fetchData();
    }
  }, [initialEvent, eventId, event, setEvent]); // More stable order

  // Delay rendering of MegaEventsSection until after main content
  useEffect(() => {
    if (event) {
      const timer = setTimeout(() => {
        setShowAboutSection(true);
      }, 200); // Adjust delay as needed

      return () => clearTimeout(timer);
    }
  }, [event]);

  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <DatesProvider
        settings={{
          locale: "he",
          firstDayOfWeek: 0,
          weekendDays: [6],
          timezone: "Israel",
        }}
      >
        {(() => {
          const currentEvent = event || initialEvent;
          return currentEvent && currentEvent.tickets_and_rates?.length > 0 ? (
            <OrderForm event={currentEvent} />
          ) : (
            <div className="min-h-[60vh] flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-main mx-auto mb-4"></div>
                <p className="text-lg">Loading event data...</p>
              </div>
            </div>
          );
        })()}
      </DatesProvider>

      {showAboutSection && (
        <div className="content-wrapper">
          <MegaEventsSection />
        </div>
      )}
    </Suspense>
  );
}
