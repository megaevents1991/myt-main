"use client";

import { Suspense, useContext, useState, useEffect } from "react";
import { OrderForm } from "./OrderForm";
import { Event } from "@/lib/app.types";
import { DatesProvider } from "@mantine/dates";
import "dayjs/locale/he";
import { OrderContext } from "../app.context";
import MegaEventsSection from "@/components/ui/aboutUsMega";

export default function OrderPage() {
  const { event } = useContext(OrderContext);
  const [showAboutSection, setShowAboutSection] = useState(false);

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
        {event && <OrderForm event={event as Event} />}
      </DatesProvider>

      {showAboutSection && (
        <div className="content-wrapper">
          <MegaEventsSection />
        </div>
      )}
    </Suspense>
  );
}
