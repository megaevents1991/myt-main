"use client";

import { Suspense, useContext, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Event } from "@/lib/app.types";
import { DatesProvider } from "@mantine/dates";
import "dayjs/locale/he";
import { OrderContext, PersonLink } from "../app.context";
import type { OrderPartnerSession } from "@/lib/partner-auth/session";
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

interface OrderPageClientProps {
  initialEvent?: Event;
  eventId?: string;
  personLink?: PersonLink;
}

export default function OrderPageClient({
  initialEvent,
  eventId,
  personLink,
}: OrderPageClientProps) {
  const { event, setEvent, setPersonLink } = useContext(OrderContext);
  const [partnerSession, setPartnerSession] =
    useState<OrderPartnerSession | null>(null);

  // The partner session is asked for AFTER hydration (same bridge the header
  // badge uses) instead of read from the cookie in the server page - a cookie
  // read there forces every order page dynamic and kills ISR. Null for every
  // anonymous visitor; partner actions re-verify the cookie server-side.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/partner-session")
      .then((res) => res.json())
      .then(
        (data: {
          connected?: boolean;
          role?: OrderPartnerSession["role"];
          name?: string | null;
          code?: string;
        }) => {
          if (cancelled || !data.connected || !data.role || !data.code) return;
          setPartnerSession({
            role: data.role,
            partner_code: data.code,
            display_name: data.name ?? null,
          });
        },
      )
      .catch(() => {
        // Not connected / network hiccup - the visitor stays a plain customer.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Push the server-resolved artist/team link into context so the header +
  // summary photos can link to the person page.
  useEffect(() => {
    setPersonLink(personLink);
  }, [personLink, setPersonLink]);

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
            <OrderForm event={currentEvent} partnerSession={partnerSession} />
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
    </Suspense>
  );
}
