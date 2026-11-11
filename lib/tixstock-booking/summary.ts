// What the order summary adds for a TixStock SANDBOX test event (`is_test` + `tixstock_booking`), and the attendees
// it sends with the pay click. Pure; `app/order/OrderReview.tsx` reads it behind `isSandboxBookingEvent(event)` and
// a real event's summary gets `{ kind: "none" }` - nothing of it changes.
// Test: lib/__tests__/tixstockSummary.test.ts.
import type { OrderTicket } from "@/lib/app.types";
import { attendeeIssues, isSandboxBookingEvent, type AttendeeInput, type EventFlags } from "./rules";

export type SandboxSummaryState =
  | { kind: "none" }
  /** A sandbox event whose ticket carries no listing (an order draft from before the step, a stale tab). */
  | { kind: "pick_again" }
  | { kind: "ready"; listingId: string; italian: boolean; singleSeats: boolean };

/**
 * `none` for every real event. On a sandbox event the pay click holds ONE listing - the one the ticket step's card
 * showed - so a ticket without it cannot be paid for: `pick_again` sends the customer back to the ticket step.
 */
export function sandboxSummaryState(
  event: EventFlags | null | undefined,
  ticket: OrderTicket | null | undefined,
): SandboxSummaryState {
  if (!isSandboxBookingEvent(event)) return { kind: "none" };
  const listingId = (ticket?.tixstock?.listingId ?? "").trim();
  if (!ticket?.tixstock || listingId === "") return { kind: "pick_again" };
  return { kind: "ready", listingId, italian: ticket.tixstock.italian === true, singleSeats: ticket.tixstock.singleSeats === true };
}

const clean = (v: string | undefined): string | undefined => {
  const text = (v ?? "").trim();
  return text === "" ? undefined : text;
};

/**
 * One attendee per traveller of the summary's form, names trimmed. The identity details TixStock asks for at an
 * Italian venue (passport, nationality, date of birth, gender, place of birth) are kept only for an Italian event -
 * on any other event they are never sent, whatever the form's state holds.
 */
export function attendeesForRequest(
  passengers: Array<{ firstName?: string; lastName?: string }>,
  extra: Array<Partial<AttendeeInput> | undefined>,
  italian: boolean,
): AttendeeInput[] {
  return passengers.map((p, i) => {
    const attendee: AttendeeInput = { first_name: (p.firstName ?? "").trim(), last_name: (p.lastName ?? "").trim() };
    if (!italian) return attendee;
    const more = extra[i];
    const passport = clean(more?.passport);
    const nationality = clean(more?.nationality)?.toUpperCase();
    const dob = clean(more?.dob);
    const birthPlace = clean(more?.birth_place);
    if (passport) attendee.passport = passport;
    if (nationality) attendee.nationality = nationality;
    if (dob) attendee.dob = dob;
    if (more?.gender === "M" || more?.gender === "F") attendee.gender = more.gender;
    if (birthPlace) attendee.birth_place = birthPlace;
    return attendee;
  });
}

/**
 * May the pay button open? Every traveller of an Italian event needs every identity detail (`attendeeIssues`, the
 * same rule `confirm-order` checks). Names are the summary's own fields with its own validation, so a name never
 * holds the button from here - and on a non-Italian event nothing does.
 */
export function attendeesReady(attendees: AttendeeInput[], italian: boolean): boolean {
  if (!italian) return true;
  return attendees.every((a) => attendeeIssues(a, true).every((issue) => issue === "name"));
}
