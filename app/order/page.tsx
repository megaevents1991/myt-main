"use client";

import { Suspense } from "react";
import { events } from "@/lib/events-data";
import { OrderForm } from "./OrderForm";
import { Event } from "@/lib/app.types";
import { useSearchParams } from "next/navigation";
import { DatesProvider } from "@mantine/dates";
import "dayjs/locale/he";

export default function OrderPage() {
  const eventId = useSearchParams().get("eventId") as string;

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
        <main className="flex-1">
          <OrderForm event={events.find((e) => e.id === eventId) as Event} />
        </main>
      </DatesProvider>
    </Suspense>
  );
}
