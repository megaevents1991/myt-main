/**
 * The `flights` table is shared by the companies of the platform. Every row
 * carries `company_id`; rows of this site belong to Mega Events. A group block
 * of another company (a tours company holds hundreds) must never be sold,
 * counted or decremented from here.
 *
 * This site reaches a flight by an id that arrives from the order payload or
 * from a saved package, so the id itself proves nothing. The check below is
 * applied to the row that was read.
 *
 * Deliberately a check on the ROW and not a `.eq("company_id", ...)` filter:
 * a filter on a column that does not exist yet fails the whole query, and this
 * code may be deployed before the migration that adds the column. A row with
 * no `company_id` (the column is not there yet) is a Mega Events row - before
 * companies existed every flight was.
 */
export const MEGA_EVENTS_COMPANY_ID = "a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f601";

export function isMegaEventsFlight(row: unknown): boolean {
  if (!row || typeof row !== "object") return false;
  const companyId = (row as { company_id?: string | null }).company_id;
  return companyId == null || companyId === MEGA_EVENTS_COMPANY_ID;
}
