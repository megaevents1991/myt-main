"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Ticket, Check } from "lucide-react";
import { Event } from "@/lib/events-data";

export default function ConfirmationPage() {
  const [event, setEvent] = useState<Event | null>(null);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const searchParams = useSearchParams();

  const eventId = searchParams.get("eventId");
  const tickets = searchParams.get("tickets");
  const flight = searchParams.get("flight");
  const hotel = searchParams.get("hotel");

  useEffect(() => {
    if (eventId) {
      fetch(`/api/events?id=${eventId}`)
        .then((res) => res.json())
        .then((data) => setEvent(data))
        .catch((error) => console.error("Failed to fetch event:", error));
    }

    // Simulate sending an email to the agent
    fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: "alonsamnon@gmail.com",
        subject: "New Event Booking",
        text: `New booking for event ${eventId}. Tickets: ${tickets}, Flight: ${flight}, Hotel: ${hotel}`,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setIsEmailSent(true);
        }
      })
      .catch((error) => console.error("Error:", error));
  }, [eventId, tickets, flight, hotel]);

  if (!event) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center justify-between border-b">
        <Link className="flex items-center justify-center" href="/">
          <Ticket className="h-6 w-6 mr-2" />
          <span className="text-lg font-bold">MYT Events</span>
        </Link>
      </header>
      <main className="flex-1 py-12 px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-4">Booking Confirmed!</h1>
          <p className="text-xl mb-8">Thank you for booking {event.name}.</p>
          <div className="bg-gray-100 p-6 rounded-lg mb-8">
            <h2 className="text-2xl font-semibold mb-4">Booking Details</h2>
            <p>
              <strong>Event:</strong> {event.name}
            </p>
            <p>
              <strong>Date:</strong> {event.date}
            </p>
            <p>
              <strong>Location:</strong> {event.location}
            </p>
            <p>
              <strong>Tickets:</strong> {tickets}
            </p>
            <p>
              <strong>Flight:</strong> {flight}
            </p>
            <p>
              <strong>Hotel:</strong> {hotel}
            </p>
          </div>
          {isEmailSent && (
            <p className="text-green-500 mb-8">
              An email has been sent to our agent with your booking details.
            </p>
          )}
          <Link href="/">
            <Button>Return to Home</Button>
          </Link>
        </div>
      </main>
      <footer className="py-6 w-full px-4 md:px-6 border-t">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 sm:mb-0">
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
}
