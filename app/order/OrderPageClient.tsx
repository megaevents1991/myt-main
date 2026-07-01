"use client";

import { Suspense, useContext, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Event } from "@/lib/app.types";
import { DatesProvider } from "@mantine/dates";
import "dayjs/locale/he";
import { OrderContext } from "../app.context";
// Code-split heavy components
const OrderForm = dynamic(() => import("./OrderForm").then(m => m.OrderForm), {
  // Keep SSR to preserve SSG/ISR HTML for SEO-critical content
  ssr: true,
  loading: () => (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-main mx-auto mb-4"></div>
        <p className="text-lg">Loading form...</p>
      </div>
    </div>
  ),
});

const MegaEventsSection = dynamic(() => import("@/components/ui/aboutUsMega"), {
  // This is supplemental content; avoid server render to keep above-the-fold smaller
  ssr: false,
});

interface OrderPageClientProps {
  initialEvent?: Event;
  eventId?: string;
  artistSlug?: string;
}

export default function OrderPageClient({ initialEvent, eventId, artistSlug }: OrderPageClientProps) {
  const { event, setEvent, setArtistSlug, step } = useContext(OrderContext);
  const [showAboutSection, setShowAboutSection] = useState(false);

  // Push the server-resolved artist slug into context so the header + summary
  // photos can link to the artist page.
  useEffect(() => {
    setArtistSlug(artistSlug);
  }, [artistSlug, setArtistSlug]);

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

  // Delay rendering of MegaEventsSection until after main content.
  // Show it ONLY on the OrderReview summary step (step 4); hide on all others.
  useEffect(() => {
    if (event && step === 4) {
      const timer = setTimeout(() => {
        setShowAboutSection(true);
      }, 200); // Adjust delay as needed

      return () => clearTimeout(timer);
    } else {
      // Hide the section on every step except OrderReview (step 4)
      setShowAboutSection(false);
    }
  }, [event, step]);

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
