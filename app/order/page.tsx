import { redirect } from "next/navigation";

// Redirect old query-param URLs to new route-param URLs
export default async function OrderPageRedirect({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string }>;
}) {
  const { eventId } = await searchParams;
  
  // Always redirect to home if no eventId, or to SSG route if eventId exists
  redirect(eventId ? `/order/${eventId}` : "/");
}
