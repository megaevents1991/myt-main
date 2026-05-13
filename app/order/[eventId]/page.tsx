import { getCachedEvents } from "@/lib/eventsData";
import OrderPageClient from "../OrderPageClient";
import { Event } from "@/lib/app.types";
import { Metadata } from "next";
import { OrderErrorBoundary } from "../OrderErrorBoundary";
import EventNotFoundNotice from "@/components/EventNotFoundNotice";
import { hasAvailableTickets } from "@/lib/utils";
import Link from "next/link";
import { getServerHomeHref } from "@/lib/homeHref";

export const revalidate = 3600; // 1 hour
export const dynamicParams = true; // Allow rendering pages for new eventIds on-demand

export async function generateStaticParams() {
  try {
    const { events } = await getCachedEvents();
    
    // Filter out events that have NO available tickets
    const eventsWithAvailableTickets = events.filter((event) => {
      const hasTickets = hasAvailableTickets(event);
      
      if (!hasTickets) {
        console.log(`[SSG] Skipping event ${event.id} (${event.name}) - no available tickets`);
      }
      
      return hasTickets;
    });
    
    console.log(`[SSG] Generating static pages for ${eventsWithAvailableTickets.length}/${events.length} events with available tickets`);
    
    return eventsWithAvailableTickets.map((event) => ({
      eventId: event.id.toString(),
    }));
  } catch (error) {
    console.error("Failed to generate static params for order pages:", error);
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  
  try {
    const { events } = await getCachedEvents();
    const event = events.find((e) => e.id === parseInt(eventId));
    
    if (!event) {
      return {
        title: "Event Not Found - Mega Events",
        description: "The requested event could not be found.",
      };
    }

    return {
      title: `${event.name} - Order Tickets | Mega Events`,
      description: `Order tickets for ${event.name}. Get your flight, hotel, and event tickets in one package. Professional service with full warranty.`,
      keywords: [
        event.name,
        "tickets",
        "order",
        "flights",
        "hotels",
        "events",
        "mega events",
        event.location.name,
        event.date,
      ],
      openGraph: {
        title: `${event.name} - Order Tickets`,
        description: `Order tickets for ${event.name} with flights and hotels included.`,
        url: `https://www.mega-events.co.il/order/${eventId}`,
        siteName: "Mega Events",
        images: event.card_image_url ? [
          {
            url: event.card_image_url,
            width: 800,
            height: 600,
            alt: event.name,
          },
        ] : [],
      },
      alternates: {
        canonical: `https://www.mega-events.co.il/order/${eventId}`,
      },
    };
  } catch (error) {
    console.error("Error generating metadata for order page:", error);
    return {
      title: "Order Event Tickets - Mega Events",
      description: "Order your event tickets with flights and hotels included.",
    };
  }
}

export default async function OrderPageWithId({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  if (!eventId) {
    return <EventNotFoundNotice />;
  }

  // Fetch the event data server-side
  let event: Event | undefined;
  try {
    const { events } = await getCachedEvents();
    event = events.find((e) => e.id === parseInt(eventId));
  } catch (error) {
    console.error("Error fetching event:", error);
    return <EventNotFoundNotice eventId={eventId} />;
  }

  if (!event) {
    return <EventNotFoundNotice eventId={eventId} />;
  }

  // Check if event has any available tickets
  if (!hasAvailableTickets(event)) {
    console.warn(`[OrderPage] Event ${eventId} (${event.name}) has no available tickets`);
    const homeHref = await getServerHomeHref();
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-2xl text-center">
          <h1 className="text-3xl font-bold mb-4 text-red-600">
            כרטיסים אזלו
          </h1>
          <p className="text-xl mb-4">
            מצטערים, כל הכרטיסים לאירוע <strong>{event.name}</strong> אזלו או אינם זמינים למכירה כרגע.
          </p>
          <p className="text-lg text-gray-600 mb-6">
            אנא בדקו אירועים אחרים או צרו קשר עם שירות הלקוחות לקבלת מידע נוסף.
          </p>
          <Link
            href={homeHref}
            className="inline-block bg-main text-white px-6 py-3 rounded-lg font-bold hover:opacity-90 transition-opacity"
          >
            חזרה לדף הבית
          </Link>
        </div>
      </div>
    );
  }

  return (
    <OrderErrorBoundary>
      <OrderPageClient initialEvent={event} eventId={eventId} />
    </OrderErrorBoundary>
  );
}
