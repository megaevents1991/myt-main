import type { Event } from "@/lib/app.types";

/**
 * Is this event one the tour uploader built that staff have not approved yet
 * (`events.is_hidden`, written by the backoffice)? Such an event does not exist
 * for a customer: `isListedEvent` keeps it off every listing, the Meta feed
 * skips it, and confirm-order refuses an order for it even when the id was
 * typed into the URL by hand. Absent / false = open, so a row from before the
 * column existed behaves as it always did.
 */
export const isHiddenForCheckout = (event: Pick<Event, "is_hidden">): boolean =>
  event.is_hidden === true;
