/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, Ticket } from "lucide-react";

function ConfirmationContent() {
  const searchParams = useSearchParams();

  const eventId = searchParams.get("eventId") || "";
  const ticketType = searchParams.get("ticketType") || "";
  const quantity = searchParams.get("quantity") || "0";
  const flight = searchParams.get("flight") || "";
  const hotel = searchParams.get("hotel") || "";
  const checkInDate = searchParams.get("checkInDate") || "";
  const checkOutDate = searchParams.get("checkOutDate") || "";
  const bookingReference = searchParams.get("bookingReference") || "";
  const eventName = searchParams.get("eventName") || "";
  const eventDate = searchParams.get("eventDate") || "";
  const eventLocation = searchParams.get("eventLocation") || "";

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
          <p className="text-xl mb-8">Thank you for booking {eventName}.</p>
          <div className="bg-gray-100 p-6 rounded-lg mb-8">
            <h2 className="text-2xl font-semibold mb-4">Booking Details</h2>
            <p>
              <strong>Booking Reference:</strong> {bookingReference}
            </p>
            <p>
              <strong>Event:</strong> {eventName}
            </p>
            <p>
              <strong>Date:</strong> {eventDate}
            </p>
            <p>
              <strong>Location:</strong> {eventLocation}
            </p>
            <p>
              <strong>Tickets:</strong> {ticketType} (x{quantity})
            </p>
            <p>
              <strong>Flight:</strong> {flight}
            </p>
            <p>
              <strong>Hotel:</strong> {hotel}
            </p>
            <p>
              <strong>Check-in:</strong> {checkInDate}
            </p>
            <p>
              <strong>Check-out:</strong> {checkOutDate}
            </p>
          </div>
          <p className="text-green-500 mb-8">
            Your booking is confirmed. Our team will contact you shortly with
            further details.
          </p>
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

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfirmationContent />
    </Suspense>
  );
}
