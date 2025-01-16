"use client";

import { Suspense, useEffect, useState } from "react";
import { OrderForm } from "./OrderForm";
import { Event } from "@/lib/app.types";
import { useSearchParams } from "next/navigation";
import { DatesProvider } from "@mantine/dates";
import "dayjs/locale/he";

export default function OrderPage() {
  const [events, setEvents] = useState<Event[]>([]);
  
  const eventId = useSearchParams().get("eventId") as string;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/events');
        const data = await response.json();
        setEvents(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching cards:', error);
        // Better user error (via the client).
      }
    };

    fetchData();
  }, []);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DatesProvider
        settings={{
          locale: "he",
          firstDayOfWeek: 0,
          weekendDays: [6],
          timezone: "UTC",
        }}
      >
        <OrderForm event={events.find((e) => e.id === eventId) as Event} />
      </DatesProvider>
    </Suspense>
  );
}
