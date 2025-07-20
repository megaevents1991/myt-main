import { redirect } from "next/navigation";

// Redirect old query-param URLs to new route-param URLs
export default async function OrderPageRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const { eventId, ...otherParams } = params;
  
  // If no eventId, redirect to home
  if (!eventId || Array.isArray(eventId)) {
    redirect("/");
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
