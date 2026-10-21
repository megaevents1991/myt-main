/**
 * "Build Your Euro Trip" holds are several `reservations` rows sharing one `itinerary_group`. A
 * grouped row is never a single-event order, so the customer's "find my order" lookup
 * (`/api/find-order` <- `useHandleExistingOrder`) must not hand it to the single-event checkout.
 *
 * Pure: the route reads the column in its OWN small query, apart from its explicit select, because
 * the column may not exist yet (the migration is applied separately) and putting it in the main
 * select would 404 every held order until then. An unreadable column (`error` set - the
 * "column does not exist" case before the migration) means "no group": the route carries on
 * exactly as it did.
 */
export function blocksSingleOrderResume(groupRead: {
  data?: { itinerary_group?: string | null } | null;
  error?: unknown;
}): boolean {
  if (groupRead.error) return false;
  return Boolean(groupRead.data?.itinerary_group);
}
