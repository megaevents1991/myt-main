/**
 * "Build Your Euro Trip" - "רוצים שנציע את הטיול שלכם גם לאחרים?" (Dor, 24.10.2026). Pure: no I/O.
 *
 * On the summary a customer who built a trip may offer it to others and give it a name. The offer
 * rides on the trip's hold (POST /api/itinerary/confirm, field `suggest`) and is written AFTER the
 * hold's rows, as one `itinerary_route_requests` row (backoffice migration 20261024084720) - best
 * effort, like the emails: it never refuses or fails a hold. A `suggest` the server cannot read is
 * simply no suggestion. Staff turn a request into a staff trip (`itinerary_routes`) at
 * /events/trips/requests in the backoffice.
 */
import type { TravellersInput } from "./travellers";
import { isMissingSettingsTable } from "./settings";

/** The name field's cap on the summary and on the server (the table allows 80, the staff title's cap). */
export const SUGGEST_TITLE_MAX = 60;

export type TripSuggestion = { title: string | null };

/** C0 / C1 controls, zero-width marks and bidi embeddings / overrides / isolates. */
const INVISIBLE_RE = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁩﻿]/g;

/**
 * A customer's trip name as it is stored: whitespace runs folded to one space, invisible characters
 * dropped, trimmed, at most `SUGGEST_TITLE_MAX` characters (by code point - an emoji is never cut in
 * half). Anything that is not a string is "".
 */
export function cleanSuggestTitle(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const folded = raw.replace(/\s+/g, " ").replace(INVISIBLE_RE, "").trim();
  return Array.from(folded).slice(0, SUGGEST_TITLE_MAX).join("").trim();
}

/** The request's `suggest`: an object = the customer opted in (its title optional); anything else = no. */
export function parseSuggestion(raw: unknown): TripSuggestion | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const title = cleanSuggestTitle((raw as { title?: unknown }).title);
  return { title: title || null };
}

/** The `itinerary_route_requests` insert (the columns the site writes; status / handling are staff's). */
export type SuggestionRow = {
  title: string | null;
  event_ids: number[];
  itinerary_group: string;
  reservation_id: number | null;
  pax: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
};

/**
 * The row for a held trip, or null when the customer did not opt in. `routeIds` = the trip's events in
 * trip order (the server's re-read route), `rowIds` = the hold's reservations ids (the first one is
 * the link staff open). The contact is the hold's main contact, trimmed - what its rows hold.
 */
export function suggestionRow(
  sub: { group: string; pax: number; travellers: TravellersInput; suggest: TripSuggestion | null },
  routeIds: number[],
  rowIds: number[],
): SuggestionRow | null {
  if (!sub.suggest) return null;
  const { firstName, lastName, email, phone } = sub.travellers.contact;
  return {
    title: sub.suggest.title,
    event_ids: routeIds,
    itinerary_group: sub.group,
    reservation_id: rowIds[0] ?? null,
    pax: sub.pax,
    contact_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
    contact_email: email.trim(),
    contact_phone: phone.trim(),
  };
}

/** The table is not there yet (the backoffice migration not applied): skip the write, quietly. */
export const isMissingRequestsTable = (e: unknown): boolean => isMissingSettingsTable(e);
