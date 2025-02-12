/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { useState, useEffect, Suspense } from "react";

function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LoadingUI() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-lg text-muted-foreground">Loading confirmation...</p>
    </div>
  );
}

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);

  // Simulate loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">
          Confirming your booking...
        </p>
      </div>
    );
  }

  let bookingReference = searchParams.get("bookingReference");
  let eventName = searchParams.get("eventName");
  let eventDate = searchParams.get("eventDate");
  let eventLocation = searchParams.get("eventLocation");
  let ticketType = searchParams.get("ticketType");
  let quantity = searchParams.get("quantity");
  let airline = searchParams.get("airline");
  let flights = searchParams.get("flights");
  let dates = searchParams.get("dates");
  let hotel = searchParams.get("hotel");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex flex-col items-center">
          <div className="rounded-full bg-green-100 p-3 mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold">Booking Confirmed!</h1>
          <p className="mt-2 text-xl">Thank you for booking {eventName}.</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 text-left">
          <h2 className="text-2xl font-semibold mb-4 text-center">
            Booking Details
          </h2>
          <div className="space-y-3">
            <p>
              <strong>Booking Reference:</strong> {bookingReference}
            </p>
            <p>
              <strong>Event:</strong> {eventName}
            </p>
            <p>
              <strong>Date:</strong>{" "}
              {eventDate
                ? new Date(eventDate).toLocaleDateString("he-IL")
                : "N/A"}
            </p>
            <p>
              <strong>Location:</strong> {eventLocation}
            </p>
            <p>
              <strong>Tickets:</strong> (x{quantity}) {ticketType}
            </p>
            <p>
              <strong>Airline:</strong> {airline}
            </p>
            <p>
              <strong>Flight Numbers-</strong> {flights}
            </p>
            <p>
              <strong>Flight Schedule-</strong> {dates}
            </p>
            <p>
              <strong>Hotel:</strong> {hotel}
            </p>
          </div>
        </div>

        <div className="text-green-600 mb-6" dir="rtl">
          תודה שבחרת מגה איבנטס! ההזמנה שלך נשלחה לנציגינו ואלו יצרו עימך קשר
          תוך יום עסקים לקבלת תשלום ואישור הרכישה.
        </div>
        <div>{""}</div>

        <Link href="/" className="mt-6">
          <Button className="w-full">Return to Home</Button>
        </Link>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<LoadingUI />}>
      <ConfirmationContent />
    </Suspense>
  );
}
