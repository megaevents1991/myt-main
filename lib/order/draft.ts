/**
 * Order draft - a refresh must not send the customer back to step 1.
 *
 * The whole order lives in React state (app/order/layout.tsx), so F5 - or a phone
 * dropping a background tab - used to wipe the ticket, the flight, the hotel and the
 * typed passenger details. The layout now mirrors that state into sessionStorage
 * (this browser tab only) and reads it back when the page loads again.
 *
 * Every rule is here, pure (no window, no React) - lib/__tests__/orderDraft.test.ts.
 * The storage calls are in ./draftStorage.ts.
 *
 * What a draft is NOT: a price promise. confirm-order re-checks the ticket, the
 * stock and the total on the server exactly as before; a restored order is the same
 * in-memory order the tab held a moment ago, nothing more.
 */
import type { Event, Flight, OrderHotel, OrderTicket } from "@/lib/app.types";
import {
  defaultCity,
  hasEventCity,
  LODGING_CITIES,
  type LodgingCity,
  type NightAssign,
} from "@/lib/events/lodging";
import { isTicketOnlyEvent } from "@/lib/events/price";

/** Bump when the stored shape changes - an older draft is then ignored, never migrated. */
export const ORDER_DRAFT_VERSION = 1;
/** A draft older than this is dropped (measured from its last save, so an active order keeps living). */
export const ORDER_DRAFT_TTL_MS = 30 * 60 * 1000;
export const MAX_ORDER_TICKETS = 9;

const DRAFT_PREFIX = "myt:order-draft:";
const FORM_PREFIX = "myt:order-form:";
export const orderDraftKey = (eventId: number | string) => `${DRAFT_PREFIX}${eventId}`;
export const orderFormKey = (eventId: number | string) => `${FORM_PREFIX}${eventId}`;
export const isOrderStorageKey = (key: string) =>
  key.startsWith(DRAFT_PREFIX) || key.startsWith(FORM_PREFIX);

/** What the layout holds that a refresh should bring back. */
export type OrderDraftState = {
  step: number;
  returnToSummary: boolean;
  numberOfEventTickets: number;
  planeTickets: { adults: number; children: number };
  currentMinTicketPrice: number;
  eventTicket: OrderTicket | null;
  flight: Flight | null;
  flightSkipped: boolean;
  hotel: OrderHotel | null;
  skipHotel: boolean;
  skippedHotelPricePerGuest: number | null;
  lodgingCity: LodgingCity;
  hotelSegments: OrderHotel[] | null;
  splitNights: NightAssign[] | null;
};

export type OrderDraft = OrderDraftState & {
  v: number;
  eventId: number;
  savedAt: number;
};

/**
 * The pick the customer was in the MIDDLE of on steps 1-2. Those steps re-run their
 * own search / pricing when they mount and select a default; the hint lets them come
 * back to the customer's pick instead. It dies as soon as the step changes.
 */
export type OrderResume =
  | { step: 1; ticketId: string }
  | { step: 2; flight: Flight };

export type ResumedOrder = OrderDraftState & { resume: OrderResume | null };

/**
 * Links that bring their own order from the server (?orderId = a held order,
 * ?pkg = an agent's prepared package). They own the composition - the draft neither
 * restores over them nor records them. The passenger form is remembered regardless.
 */
export function ownedByLink(search: string): boolean {
  try {
    const params = new URLSearchParams(search);
    return !!params.get("orderId") || !!params.get("pkg");
  } catch {
    return false;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const intIn = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
/** JSON boundary: an object that carries a non-empty string id is taken as the stored T. */
const withId = <T>(v: unknown): T | null =>
  isRecord(v) && typeof v.id === "string" && v.id !== "" ? (v as T) : null;
const isCity = (v: unknown): v is LodgingCity =>
  (LODGING_CITIES as readonly unknown[]).includes(v);

/** Saved within the last TTL (a clock that jumped back a minute is tolerated). */
const isFresh = (savedAt: unknown, now: number): savedAt is number =>
  typeof savedAt === "number" &&
  Number.isFinite(savedAt) &&
  savedAt <= now + 60_000 &&
  now - savedAt <= ORDER_DRAFT_TTL_MS;

/** A stored draft or form that is past its TTL, or not readable at all - for pruning. */
export function isStale(raw: string | null, now: number): boolean {
  if (!raw) return true;
  try {
    const parsed: unknown = JSON.parse(raw);
    return !isRecord(parsed) || !isFresh(parsed.savedAt, now);
  } catch {
    return true;
  }
}

export function buildOrderDraft(eventId: number, state: OrderDraftState, now: number): OrderDraft {
  return { v: ORDER_DRAFT_VERSION, eventId, savedAt: now, ...state };
}

/**
 * A stored draft that is ours, for this event, fresh and well-formed - or null.
 * Anything doubtful is dropped whole: a half-trusted order is worse than a new one.
 */
export function parseOrderDraft(raw: string | null, eventId: number, now: number): OrderDraft | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.v !== ORDER_DRAFT_VERSION || parsed.eventId !== eventId) return null;
  if (!isFresh(parsed.savedAt, now)) return null;

  const step = intIn(parsed.step, 1, 4);
  const tickets = intIn(parsed.numberOfEventTickets, 1, MAX_ORDER_TICKETS);
  if (step === null || tickets === null) return null;

  const plane = isRecord(parsed.planeTickets) ? parsed.planeTickets : {};
  const rawSegments = Array.isArray(parsed.hotelSegments) ? parsed.hotelSegments : null;
  const segments = rawSegments
    ?.map((h) => withId<OrderHotel>(h))
    .filter((h): h is OrderHotel => h !== null);
  const rawNights = Array.isArray(parsed.splitNights) ? parsed.splitNights : null;
  const nights = rawNights?.filter(
    (n): n is NightAssign => isRecord(n) && typeof n.date === "string" && isCity(n.city),
  );
  const skippedPrice = parsed.skippedHotelPricePerGuest;
  const minPrice = parsed.currentMinTicketPrice;

  return {
    v: ORDER_DRAFT_VERSION,
    eventId,
    savedAt: parsed.savedAt,
    step,
    returnToSummary: parsed.returnToSummary === true,
    numberOfEventTickets: tickets,
    planeTickets: { adults: intIn(plane.adults, 1, MAX_ORDER_TICKETS) ?? tickets, children: 0 },
    currentMinTicketPrice:
      typeof minPrice === "number" && Number.isFinite(minPrice) && minPrice > 0 ? minPrice : 0,
    eventTicket: withId<OrderTicket>(parsed.eventTicket),
    flight: withId<Flight>(parsed.flight),
    flightSkipped: parsed.flightSkipped === true,
    hotel: withId<OrderHotel>(parsed.hotel),
    skipHotel: parsed.skipHotel === true,
    skippedHotelPricePerGuest:
      typeof skippedPrice === "number" && Number.isFinite(skippedPrice) ? skippedPrice : null,
    lodgingCity: isCity(parsed.lodgingCity) ? parsed.lodgingCity : "flight",
    // A split is all of its segments or none of them.
    hotelSegments:
      rawSegments && segments && segments.length > 1 && segments.length === rawSegments.length
        ? segments
        : null,
    splitNights:
      rawNights && nights && nights.length > 0 && nights.length === rawNights.length ? nights : null,
  };
}

/** The order as it opens with no draft - the layout's own initial values. */
export function freshOrder(event: Event, tickets = 2): ResumedOrder {
  return {
    step: 1,
    returnToSummary: false,
    numberOfEventTickets: tickets,
    planeTickets: { adults: tickets, children: 0 },
    currentMinTicketPrice: 0,
    eventTicket: null,
    flight: null,
    flightSkipped: false,
    hotel: null,
    skipHotel: false,
    skippedHotelPricePerGuest: null,
    lodgingCity: defaultCity(event),
    hotelSegments: null,
    splitNights: null,
    resume: null,
  };
}

/** Start of the local day of `now`. */
const startOfDay = (now: number) => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** The flight still leaves in the future - a draft never brings back a departed one. */
const flightStillAhead = (flight: Flight | null, now: number): flight is Flight => {
  const departs = flight?.outbound?.departureTime
    ? new Date(flight.outbound.departureTime).getTime()
    : NaN;
  return !!flight?.inbound?.departureTime && Number.isFinite(departs) && departs > now;
};

/** Check-in today or later (a "YYYY-MM-DD" day, compared as a local day). */
const hotelStillAhead = (hotel: OrderHotel | null, now: number): hotel is OrderHotel => {
  if (!hotel?.checkin) return false;
  const checkin = new Date(`${hotel.checkin.slice(0, 10)}T00:00:00`).getTime();
  return Number.isFinite(checkin) && checkin >= startOfDay(now);
};

/**
 * What a stored draft may bring back on THIS event today.
 *
 * - The ticket must still be on sale on the event (as the page itself sees it). When it
 *   is gone the customer starts again at step 1, keeping only the party size.
 * - A departed flight, a hotel whose check-in has passed and a broken split are dropped.
 * - The step never runs ahead of the order: no flight yet -> the flight step at most,
 *   no hotel yet -> the hotel step at most. A ticket-only event is step 1 or the summary.
 */
export function resumeOrder(draft: OrderDraft, event: Event, now: number): ResumedOrder {
  const base = freshOrder(event, draft.numberOfEventTickets);

  const ticket = draft.eventTicket;
  const onSale =
    !!ticket &&
    (event.tickets_and_rates ?? []).some((t) => t.id === ticket.id && t.available !== false);
  if (!ticket || !onSale) return base;

  const kept: ResumedOrder = {
    ...base,
    // The event city is only a choice while the event still has one.
    lodgingCity:
      draft.lodgingCity === "event" && !hasEventCity(event) ? base.lodgingCity : draft.lodgingCity,
    currentMinTicketPrice: draft.currentMinTicketPrice,
    eventTicket: ticket,
    planeTickets: draft.planeTickets,
  };

  if (isTicketOnlyEvent(event)) {
    // No flight step, no hotel step - OrderForm forces both skips on such an event.
    const atSummary = draft.step >= 4;
    return {
      ...kept,
      step: atSummary ? 4 : 1,
      flightSkipped: true,
      skipHotel: true,
      resume: atSummary ? null : { step: 1, ticketId: ticket.id },
    };
  }

  const isUS = event.location?.country_code === "US";
  const flightSkipped = draft.flightSkipped && !!event.skip_flight;
  const flight = !flightSkipped && flightStillAhead(draft.flight, now) ? draft.flight : null;
  const flightSettled = flightSkipped || !!flight;

  // `hotel` is always the first segment of a split - a split that lost that, or a
  // segment whose check-in has passed, takes the whole hotel choice with it.
  const segments = draft.hotelSegments;
  const splitHolds =
    !segments ||
    (segments[0].id === draft.hotel?.id && segments.every((h) => hotelStillAhead(h, now)));
  const skipHotel = flightSettled && draft.skipHotel;
  const hotel =
    flightSettled && !isUS && !skipHotel && splitHolds && hotelStillAhead(draft.hotel, now)
      ? draft.hotel
      : null;
  const hotelSettled = isUS || skipHotel || !!hotel;

  let step = draft.step;
  if (!flightSettled) step = Math.min(step, 2);
  else if (!hotelSettled) step = Math.min(step, 3);

  return {
    ...kept,
    step,
    // Edit-from-summary only makes sense while the summary is still reachable.
    returnToSummary: draft.returnToSummary && step < 4 && flightSettled && hotelSettled,
    flight,
    flightSkipped,
    hotel,
    skipHotel,
    skippedHotelPricePerGuest: skipHotel ? draft.skippedHotelPricePerGuest : null,
    hotelSegments: hotel ? segments : null,
    splitNights: flightSettled && !isUS ? draft.splitNights : null,
    resume:
      step === 1
        ? { step: 1, ticketId: ticket.id }
        : step === 2 && flight
          ? { step: 2, flight }
          : null,
  };
}

const legKey = (leg: Flight["outbound"] | undefined) =>
  leg
    ? [
        leg.departureTime,
        leg.arrivalTime,
        leg.departureAirport,
        leg.arrivalAirport,
        leg.flightNumber ?? "",
      ].join("|")
    : "";

/**
 * The same itinerary in a NEW search. Offer ids are per search ("1", "2", ...), so a
 * flight is recognised by its airline and both legs' times, airports and flight number.
 */
export function sameFlight(a: Flight | null | undefined, b: Flight | null | undefined): boolean {
  if (!a || !b) return false;
  return (
    a.airline === b.airline &&
    !!a.isOffline === !!b.isOffline &&
    (a.offlineId ?? null) === (b.offlineId ?? null) &&
    legKey(a.outbound) !== "" &&
    legKey(a.outbound) === legKey(b.outbound) &&
    legKey(a.inbound) === legKey(b.inbound)
  );
}

/**
 * The search dates of a flight - its two departure DAYS, at midnight like the date
 * picker's own values. Null when the outbound leaves before `minDate` (the earliest
 * day the flight search accepts).
 */
export function flightSearchDates(
  flight: Flight | null | undefined,
  minDate: Date,
): [Date, Date] | null {
  if (!flight?.outbound?.departureTime || !flight.inbound?.departureTime) return null;
  const depart = new Date(flight.outbound.departureTime);
  const back = new Date(flight.inbound.departureTime);
  if (!Number.isFinite(depart.getTime()) || !Number.isFinite(back.getTime())) return null;
  depart.setHours(0, 0, 0, 0);
  back.setHours(0, 0, 0, 0);
  if (depart < minDate || back < depart) return null;
  return [depart, back];
}

/* ── The passenger form of the summary step ──────────────────────────────────── */

export const PASSENGER_FIELDS = ["firstName", "lastName", "phone", "email"] as const;
export type PassengerField = (typeof PASSENGER_FIELDS)[number];
export type DraftPassenger = Record<PassengerField, string>;

export type OrderFormDraft = {
  v: number;
  savedAt: number;
  passengers: DraftPassenger[];
  termsAccepted: boolean;
  /** The coupon code that was APPLIED - it is validated again when the form comes back. */
  coupon: string | null;
};

const FIELD_MAX = 120;
const COUPON_MAX = 40;
const blankPassenger = (): DraftPassenger => ({ firstName: "", lastName: "", phone: "", email: "" });

const cleanPassenger = (p: unknown): DraftPassenger => {
  const out = blankPassenger();
  if (!isRecord(p)) return out;
  for (const field of PASSENGER_FIELDS) {
    const value = p[field];
    if (typeof value === "string") out[field] = value.slice(0, FIELD_MAX);
  }
  return out;
};

export function buildOrderForm(
  form: { passengers: unknown[]; termsAccepted: boolean; coupon: string | null },
  now: number,
): OrderFormDraft {
  return {
    v: ORDER_DRAFT_VERSION,
    savedAt: now,
    passengers: form.passengers.slice(0, MAX_ORDER_TICKETS).map(cleanPassenger),
    termsAccepted: form.termsAccepted,
    coupon: form.coupon?.trim() ? form.coupon.trim().slice(0, COUPON_MAX) : null,
  };
}

export function parseOrderForm(raw: string | null, now: number): OrderFormDraft | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.v !== ORDER_DRAFT_VERSION) return null;
  if (!isFresh(parsed.savedAt, now) || !Array.isArray(parsed.passengers)) return null;
  return {
    v: ORDER_DRAFT_VERSION,
    savedAt: parsed.savedAt,
    passengers: parsed.passengers.slice(0, MAX_ORDER_TICKETS).map(cleanPassenger),
    termsAccepted: parsed.termsAccepted === true,
    coupon:
      typeof parsed.coupon === "string" && parsed.coupon.trim()
        ? parsed.coupon.trim().slice(0, COUPON_MAX)
        : null,
  };
}

/** The saved travellers laid over a form of `count` rows - extra rows dropped, missing ones blank. */
export function fitPassengers(
  saved: DraftPassenger[] | null | undefined,
  count: number,
): DraftPassenger[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) =>
    saved?.[i] ? cleanPassenger(saved[i]) : blankPassenger(),
  );
}

/** Nothing typed, nothing ticked - not worth keeping. */
export const isBlankForm = (
  form: Pick<OrderFormDraft, "passengers" | "termsAccepted" | "coupon">,
) =>
  !form.termsAccepted &&
  !form.coupon &&
  form.passengers.every((p) => PASSENGER_FIELDS.every((f) => !p[f]?.trim()));
