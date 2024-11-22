/* eslint-disable @typescript-eslint/no-unused-vars */
import { Suspense } from "react";
import { events, Event } from "@/lib/events-data";
import OrderForm from "./OrderForm";
import Link from "next/link";
import { Music } from "lucide-react";

interface OrderPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function OrderPage({ searchParams }: OrderPageProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OrderPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function OrderPageContent({ searchParams }: OrderPageProps) {
  const params = await searchParams;
  const eventId = params.eventId as string;
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
}
