"use client";

import { Suspense, useEffect, useState } from "react";
import { events } from "@/lib/events-data";
import { OrderForm } from "./OrderForm";
import Link from "next/link";
import { Music } from "lucide-react";
import { Flight, Hotel, Event } from "@/lib/app.types";
import { OrderContext } from "../context";
import { useSearchParams } from "next/navigation";
import { DatesProvider } from "@mantine/dates";
import "dayjs/locale/he";

export default function OrderPage() {
  const [flight, setFlight] = useState<Flight | undefined>({} as Flight);
  const [event, setEvent] = useState<Event | undefined>({} as Event);
  const [hotel, setHotel] = useState<Hotel | undefined>({} as Hotel);
  const eventId = useSearchParams().get("eventId") as string;

  useEffect(() => {
    setEvent(() => events.find((e) => e.id === eventId));
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
        <OrderContext.Provider
          value={{ setEvent, setFlight, setHotel, event, flight, hotel }}
        >
          <OrderPageContent eventId={eventId} />
        </OrderContext.Provider>
      </DatesProvider>
    </Suspense>
  );
}

const OrderPageContent = ({ eventId }: { eventId?: string }) => {
  const event = events.find((e) => e.id === eventId);

  if (!event) {
    return <div>Event not found</div>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-white px-4 lg:px-6 h-16 flex items-center justify-between shadow-sm">
        <Link className="flex items-center justify-center" href="/">
          <Music className="h-6 w-6" />
          <span className="ml-2 text-lg font-bold">MYT Events</span>
        </Link>
        <nav className="hidden md:flex gap-4 sm:gap-6">
          <Link
            className="text-sm font-medium hover:underline underline-offset-4"
            href="#"
          >
            Events
          </Link>
          <Link
            className="text-sm font-medium hover:underline underline-offset-4"
            href="#"
          >
            About
          </Link>
          <Link
            className="text-sm font-medium hover:underline underline-offset-4"
            href="#"
          >
            Contact
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <OrderForm event={event} />
      </main>

      <footer className="bg-white py-6 px-4 md:px-6 border-t">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
          <p className="text-xs text-gray-500 mb-4 sm:mb-0">
            © 2023 MYT Events. All rights reserved.
          </p>
          <nav className="flex gap-4 sm:gap-6">
            <Link
              className="text-xs hover:underline underline-offset-4"
              href="#"
            >
              Terms of Service
            </Link>
            <Link
              className="text-xs hover:underline underline-offset-4"
              href="#"
            >
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};
