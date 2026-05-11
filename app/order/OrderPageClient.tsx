"use client";

import { Suspense, useContext, useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { Event } from "@/lib/app.types";
import { DatesProvider } from "@mantine/dates";
import "dayjs/locale/he";
import { OrderContext } from "../app.context";
import { useSearchParams } from "next/navigation";
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
}

export default function OrderPageClient({ initialEvent, eventId }: OrderPageClientProps) {
  const {
    event,
    setEvent,
    step,
    setSelectedEvents,
    setActiveTicketEventIndex,
    setForceSkipHotel,
    setSkipHotel,
    setHotel,
    setSkipFlight,
    setFlightSkipped,
  } = useContext(OrderContext);
  const [showAboutSection, setShowAboutSection] = useState(false);
  const searchParams = useSearchParams();

  const bundleEventIds = useMemo(() => {
    const raw = searchParams.get("bundleEventIds");
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => Number.isFinite(n))
      .slice(0, 3);
  }, [searchParams]);

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

  // Mondial multi-event bundle initialization (client-side)
  useEffect(() => {
    const initBundle = async () => {
      // Reset choice flag on (re)init; keep capability flag set per event(s) below.
      setFlightSkipped(false);

      if (!bundleEventIds || bundleEventIds.length <= 1) {
        // Normal single-event flow
        if (initialEvent) {
          setSelectedEvents([initialEvent]);
          setActiveTicketEventIndex(0);
          setSkipFlight(initialEvent.skip_flight === true);
        }
        return;
      }

      // Force no-hotel for bundles
      setForceSkipHotel(true);
      setSkipHotel(true);
      setHotel(undefined);

      try {
        const response = await fetch(`/api/events?ids=${bundleEventIds.join(",")}`);
        const data: { events: Event[] } = await response.json();

        const byId = new Map<number, Event>();
        (data.events || []).forEach((e) => byId.set(e.id, e));
        if (initialEvent) byId.set(initialEvent.id, initialEvent);

        const ordered = bundleEventIds
          .map((id) => byId.get(id))
          .filter((e): e is Event => Boolean(e));

        if (ordered.length > 0) {
          setSelectedEvents(ordered);
          setActiveTicketEventIndex(0);
          setEvent(ordered[0]);
          // Bundle-level capability: enable skip-flight only when EVERY event opts in.
          setSkipFlight(ordered.every((e) => e.skip_flight === true));
        }
      } catch (error) {
        console.error("Error initializing multi-event bundle:", error);
      }
    };

    initBundle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleEventIds.join(","), initialEvent]);

  // Delay rendering of MegaEventsSection until after main content
  // Don't show MegaEventsSection on OrderReview step (step 4)
  useEffect(() => {
    if (event && step !== 4) {
      const timer = setTimeout(() => {
        setShowAboutSection(true);
      }, 200); // Adjust delay as needed

      return () => clearTimeout(timer);
    } else {
      // Hide the section when on step 4 (OrderReview)
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
