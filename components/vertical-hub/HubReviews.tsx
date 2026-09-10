import { GoogleReviews } from "@/components/GoogleReviews";
import { getGoogleReviews } from "@/lib/googleReviews";

/**
 * "לקוחות משתפים" on the vertical hubs - the same Google-reviews carousel as
 * the homepage. Server component: fetches the mirrored reviews itself (the
 * hub pages are ISR, so this runs per revalidation).
 */
export async function HubReviews() {
  const data = await getGoogleReviews();
  return <GoogleReviews data={data} />;
}
