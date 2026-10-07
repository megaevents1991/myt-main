import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/events/catalogParts";

/**
 * What a customer's visit makes stale when it wrote fresher ticket prices to ONE event
 * (app/api/tixstock/tickets): that event's order page, always; and the listings - the
 * catalog, and the category pages, which read their events themselves - only when the
 * cheapest ticket moved, because that is the only ticket price a card shows
 * (`cheapestAvailableTicketPrice`, lib/events/price.ts).
 *
 * Until 2026-10-07 the same write dropped the `events` tag. The root layout carries that
 * tag (the menu), so every page of the site was re-rendered on its next view - 340 times a
 * day: 61% of the order-page views and half of the category-page views were re-renders
 * (0.4 s and 1.3 s, against 0.06 s and 0.1 s from the cache).
 *
 * A customer route never drops `events`. That is the backoffice's switch (/api/revalidate).
 */
export function invalidateAfterLivePriceSync(
  eventId: number,
  cardPriceMoved: boolean,
): void {
  revalidatePath(`/order/${eventId}`);
  if (!cardPriceMoved) return;
  revalidateTag(CATALOG_TAG);
  revalidatePath("/c", "layout");
}
