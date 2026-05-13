import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCachedEvents } from "@/lib/eventsData";
import {
  getMondial2026OrderUrl,
  isMondial2026Host,
  isMondial2026Event,
} from "@/lib/mondial2026Redirect";

// Redirect old query-param URLs to new route-param URLs
export default async function OrderPageRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const { eventId, ...otherParams } = params;
  const requestHeaders = await headers();
  const isAlreadyOnMondial2026 = isMondial2026Host(requestHeaders.get("host"));
  
  // If no eventId, redirect to home
  if (!eventId || Array.isArray(eventId)) {
    redirect("/");
  }

  let shouldRedirectToMondial2026 = false;

  try {
    const { events } = await getCachedEvents();
    const event = events.find((item) => item.id === parseInt(eventId));
    shouldRedirectToMondial2026 = isMondial2026Event(event);
  } catch (error) {
    console.error("Error checking Mondial 2026 order redirect:", error);
  }

  if (!isAlreadyOnMondial2026 && shouldRedirectToMondial2026) {
    redirect(getMondial2026OrderUrl(eventId, otherParams));
  }

  // Build query string from remaining parameters
  const queryString = Object.entries(otherParams)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        // Handle array parameters (e.g., ?tags=music&tags=sports)
        return value.map(v => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`).join('&');
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`;
    })
    .join('&');

  // Redirect to SSG route with preserved parameters
  const newUrl = `/order/${eventId}${queryString ? `?${queryString}` : ''}`;
  redirect(newUrl);
}
