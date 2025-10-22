import { getCachedEvents } from "@/lib/eventsData";
import OrderPageClient from "../OrderPageClient";
import { Event } from "@/lib/app.types";
import { Metadata } from "next";
import { OrderErrorBoundary } from "../OrderErrorBoundary";
import EventNotFoundNotice from "@/components/EventNotFoundNotice";

export const revalidate = 3600; // 1 hour

export async function generateStaticParams() {
  try {
    const { events } = await getCachedEvents();
    
    return events.map((event) => ({
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
        url: `https://mega-events.co.il/order/${eventId}`,
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
        canonical: `https://mega-events.co.il/order/${eventId}`,
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

  return (
    <OrderErrorBoundary>
      <OrderPageClient initialEvent={event} eventId={eventId} />
    </OrderErrorBoundary>
  );
}
