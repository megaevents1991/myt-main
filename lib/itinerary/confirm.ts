/**
 * "Build Your Euro Trip" - the trip's 24-hour hold (POST /api/itinerary/confirm). Pure: no I/O,
 * no clock (the caller hands in today / now).
 *
 * The trip is saved as ONE request that writes one `reservations` row per event, in one bulk
 * insert, tied by `itinerary_group` - a uuid v4 the browser makes once per hold attempt, which is
 * also the idempotency key (a double click or a retry sends the same group; the rows already
 * written are answered). What the server trusts:
 *  - the events: re-read on the server (`getEvents(id)`), never the browser's copy;
 *  - the tickets: the submitted ticket, re-checked per event by the live order's own validators
 *    (LiveTickets offer, own stock - `app/api/confirm-order/utils.ts`), plus the price floor;
 *  - the flight and the hotels: as submitted (spec §13 call 8, like `confirm-order`: no new
 *    supplier search at confirm - sales converts the hold by hand);
 *  - the price: the summary's own `livePrice` (lib/itinerary/progress.ts) on a state rebuilt
 *    from the above - never a formula of its own. The browser's party total must agree within $1.
 *
 * Each row's share of the total (`final_purchase_price_ils`, `user_shown_price`) is its event's
 * part of that same sum (its tickets and tiered markup for the party, its stay's hotel when the
 * row carries it, the flight on seq 1), the rounding remainder on seq 1, so the rows add up to the
 * total exactly.
 */
import type { Event, EventTicket, ItineraryFlight, OrderData, OrderHotel, OrderTicket } from "@/lib/app.types";
import { persistableHotel } from "@/app/order/order-review.utils";
import { placeLabel } from "@/lib/events/lodging";
import { orderHotelSellable } from "@/lib/hotelRateTerms";
import { ticketSupplier } from "@/lib/suppliers";
import { MAX_TRIP_LOAD, ticketReady } from "./adapter";
import { stayCityName } from "./builder";
import { clampTripDates, moves, stays, tripLegs } from "./dates";
import { ITINERARY_DRAFT_TTL_MS } from "./draft";
import { isItineraryEligible, isListedForTrip } from "./eligibility";
import { tierMarkups } from "./price";
import { offlineHotelColumns } from "./offlineHold";
import { hotelPerTraveller, livePrice, type LivePrice } from "./progress";
import { compatibility, isAddable, sortRoute } from "./rules";
import type { ItinerarySettings } from "./settings";
import { INITIAL_ITINERARY_STATE, MAX_TRAVELLERS, MIN_TRIP_EVENTS, type ItineraryState, type ItineraryStep } from "./state";
import { stayHotelReady, stayRanges } from "./stayAdapter";
import { parseSuggestion, type TripSuggestion } from "./suggestion";
import {
  fitTravellers,
  toOrderContactFields,
  validateTravellers,
  type OtherTraveller,
  type TravellersInput,
} from "./travellers";
import type { TripDates } from "./types";

// ---------------------------------------------------------------------------------------------
// The group id
// ---------------------------------------------------------------------------------------------

/** A uuid v4 (the `itinerary_group` column is `uuid`; v4 = random, never guessable). */
export const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * A fresh group id: `crypto.randomUUID()`, or the same v4 layout from `getRandomValues` where
 * `randomUUID` is missing (a page served over plain http on a LAN address).
 */
export function newGroupId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Paying for a trip on the site is phase 3. Until then a trip is ALWAYS a 24-hour hold: the
 * request's `payNow` is ignored (parsed as a hold - the hold's travellers rules - and its rows
 * are `24Save`) whatever `payments_enabled` says, so a crafted request can never write `Pending`
 * rows that no payment follows. The pay-now path stays in the code; phase 3 turns this on with
 * the payment flow.
 */
export const PAYMENTS_LIVE: boolean = false;

// ---------------------------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------------------------

/** What the summary sends. */
export type TripSubmission = {
  /** Client-made uuid v4 = `itinerary_group` = the idempotency key. */
  group: string;
  /** Event ids (the server re-reads them and puts them in date order). */
  route: number[];
  dates: TripDates;
  pax: number;
  /** Moves made by train (`TripDates.moves` keys). */
  train: string[];
  tickets: Record<number, OrderTicket>;
  flight: ItineraryFlight;
  /** The hotel of each stay, by `Stay.key`. */
  hotels: Record<string, OrderHotel>;
  travellers: TravellersInput;
  /** The summary's `livePrice(...).total` - the party's charge, USD. */
  clientTotal: number;
  /** The summary's `livePrice(...).perTraveller` (logged when the totals disagree). */
  clientPerTraveller: number;
  /** The visit's utm_source - `aff_partner_tracking_code` on every row (phase 1: no discount). */
  utmSource: string;
  /**
   * Pay now (phase 3). Always false while `PAYMENTS_LIVE` is off; rows are `Pending` only when it
   * is on AND the settings allow payments too.
   */
  payNow: boolean;
  /**
   * "Offer my trip to others" (./suggestion): the name the customer gave it, or null when they did not
   * opt in. Written after the hold's rows, best effort - an unreadable value is no suggestion, never a refusal.
   */
  suggest: TripSuggestion | null;
  /**
   * "רוצים לפצל תשלום? דברו עם נציג" (Dor 28.10 - the regular summary's button, Alon's "פיצול הזמנה"):
   * the same hold, and the sales mail says the customer wants to split the payment. Nothing else changes.
   */
  splitPay: boolean;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Longest text field the request may carry (names, ids, keys). */
const MAX_TEXT = 200;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isText = (v: unknown, max = MAX_TEXT): v is string => typeof v === "string" && v.length <= max;
const isPositive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const isDay = (v: unknown): v is string => typeof v === "string" && DAY_RE.test(v);

function parseDates(v: unknown): TripDates | null {
  if (!isObj(v) || !isDay(v.depart) || !isDay(v.ret) || !isObj(v.moves)) return null;
  const entries = Object.entries(v.moves);
  if (entries.length > MAX_TRIP_LOAD) return null;
  const moves: Record<string, string> = {};
  for (const [key, day] of entries) {
    if (!isText(key, 40) || !isDay(day)) return null;
    moves[key] = day;
  }
  return { depart: v.depart, ret: v.ret, moves };
}

function parseTravellers(v: unknown): TravellersInput | null {
  if (!isObj(v) || !isObj(v.contact) || !Array.isArray(v.others) || v.others.length >= MAX_TRAVELLERS) return null;
  const c = v.contact;
  if (![c.firstName, c.lastName, c.phone, c.email].every((f) => isText(f, 120))) return null;
  const others: OtherTraveller[] = [];
  for (const o of v.others) {
    if (!isObj(o) || !isText(o.firstName, 120) || !isText(o.lastName, 120)) return null;
    others.push({ firstName: o.firstName, lastName: o.lastName });
  }
  return {
    contact: { firstName: String(c.firstName), lastName: String(c.lastName), phone: String(c.phone), email: String(c.email) },
    others,
  };
}

/**
 * A ticket's text as the backoffice may write it (its editor has no limit; live's yup schema has
 * none either) - generous, only to keep a hostile body bounded.
 */
const TICKET_TEXT_MAX = 1000;

/**
 * The ticket's text fields that go to the reservation's `event_order_info` and to the ops email,
 * as the live order's schema takes them (`validateOrderData`, app/api/confirm-order/utils.ts -
 * yup): each one absent or text (yup's `string()` also casts a number), `nonInstant` a boolean,
 * `seatingChoice` "together" / "split". `description` is neither stored nor mailed - not checked
 * (a long VIP / hospitality text must never refuse a hold).
 */
const TICKET_TEXT_FIELDS = ["vendor", "eid", "supplier", "supplierCategory", "zoneLabel"] as const;
function ticketTextOk(t: Record<string, unknown>): boolean {
  for (const k of TICKET_TEXT_FIELDS) {
    const v = t[k];
    if (v === undefined) continue;
    if (!(isText(v, TICKET_TEXT_MAX) || (typeof v === "number" && Number.isFinite(v)))) return false;
  }
  if (t.nonInstant !== undefined && typeof t.nonInstant !== "boolean") return false;
  if (t.seatingChoice !== undefined && t.seatingChoice !== "together" && t.seatingChoice !== "split") return false;
  return true;
}

/** An optional text field as yup takes it (`ticketTextOk` checked it): absent stays absent, a number becomes its text. */
const optText = (v: unknown): string | undefined => (v === undefined ? undefined : String(v));

/**
 * The ticket the server keeps: an ALLOWLIST of the fields that are priced, checked, stored on the
 * reservation (`eventOrderInfo`) or mailed - `id`, `category`, `price`, `quantity`, `vendor`,
 * `eid`, `supplier`, `supplierCategory`, `zoneLabel`, `nonInstant`, `seatingChoice` (all checked
 * by `ticketTextOk` / `parseSubmission` first). Anything else the client sent - `description`
 * (left empty), an unknown key - goes no further than this function.
 */
function pickTicket(t: Record<string, unknown>, pax: number): OrderTicket {
  const ticket: OrderTicket = {
    id: String(t.id),
    category: String(t.category),
    price: Number(t.price),
    quantity: pax,
    description: "",
  };
  const vendor = optText(t.vendor);
  const eid = optText(t.eid);
  const supplier = optText(t.supplier);
  const supplierCategory = optText(t.supplierCategory);
  const zoneLabel = optText(t.zoneLabel);
  if (vendor !== undefined) ticket.vendor = vendor;
  if (eid !== undefined) ticket.eid = eid;
  if (supplier !== undefined) ticket.supplier = supplier;
  if (supplierCategory !== undefined) ticket.supplierCategory = supplierCategory;
  if (zoneLabel !== undefined) ticket.zoneLabel = zoneLabel;
  if (t.nonInstant === true || t.nonInstant === false) ticket.nonInstant = t.nonInstant;
  if (t.seatingChoice === "together" || t.seatingChoice === "split") ticket.seatingChoice = t.seatingChoice;
  return ticket;
}

const isSegment = (v: unknown): boolean =>
  isObj(v) && isText(v.departureTime) && isText(v.arrivalTime) && isText(v.departureAirport) && isText(v.arrivalAirport);

/** A hotel as the hotels step keeps it: a name, a price, rooms, its nights and its rate. */
const isHotel = (v: unknown): boolean =>
  isObj(v) &&
  isText(v.name, 400) &&
  (isPositive(v.price) || (typeof v.price === "string" && isPositive(Number(v.price)))) &&
  Array.isArray(v.guests) &&
  isText(v.checkin, 40) &&
  isText(v.checkout, 40) &&
  isObj(v.rate);

export type ParsedSubmission = { ok: true; sub: TripSubmission } | { ok: false; reason: string };

/**
 * The request's shape (400 when it fails). Nothing here needs the events: the trip itself is
 * judged once they are re-read (`checkRoute`, `checkDates`, `checkPieces`). The form is checked
 * with the summary's own rules (`validateTravellers`, "hold" = the main contact; "pay" = every name).
 */
export function parseSubmission(raw: unknown, maxEvents: number): ParsedSubmission {
  const no = (reason: string): ParsedSubmission => ({ ok: false, reason });
  if (!isObj(raw)) return no("body is not an object");

  const group = typeof raw.group === "string" ? raw.group.trim().toLowerCase() : "";
  if (!UUID_V4_RE.test(group)) return no("group is not a uuid v4");

  const cap = Math.min(MAX_TRIP_LOAD, Math.max(MIN_TRIP_EVENTS, Math.trunc(maxEvents) || MIN_TRIP_EVENTS));
  const ids = raw.route;
  if (!Array.isArray(ids) || ids.length < MIN_TRIP_EVENTS || ids.length > cap) return no(`route must hold 2-${cap} events`);
  if (!ids.every((id) => typeof id === "number" && Number.isSafeInteger(id) && id > 0)) return no("route ids");
  const route = ids.map(Number);
  if (new Set(route).size !== route.length) return no("route repeats an event");

  const pax = raw.pax;
  if (typeof pax !== "number" || !Number.isInteger(pax) || pax < 1 || pax > MAX_TRAVELLERS) return no("pax");

  const dates = parseDates(raw.dates);
  if (!dates) return no("dates");

  const trainRaw = raw.train ?? [];
  if (!Array.isArray(trainRaw) || trainRaw.length > MAX_TRIP_LOAD || !trainRaw.every((k) => isText(k, 40))) return no("train");
  const train = trainRaw.map(String);
  if (new Set(train).size !== train.length) return no("train repeats a move");

  if (!isObj(raw.tickets)) return no("tickets");
  const tickets: Record<number, OrderTicket> = {};
  for (const id of route) {
    const t = raw.tickets[String(id)];
    if (
      !isObj(t) ||
      !isText(t.id, TICKET_TEXT_MAX) ||
      !t.id ||
      !isText(t.category, TICKET_TEXT_MAX) ||
      !t.category ||
      !isPositive(t.price) ||
      t.quantity !== pax
    ) {
      return no(`ticket of event ${id}`);
    }
    if (!ticketTextOk(t)) return no(`ticket fields of event ${id}`);
    // The boundary: only the checked fields go on (an allowlist).
    tickets[id] = pickTicket(t, pax);
  }

  const f = raw.flight;
  if (!isObj(f) || !isPositive(f.price) || f.numOfTravelers !== pax) return no("flight price / party");
  if (!Array.isArray(f.legs) || f.legs.length < 2 || !f.legs.every(isSegment) || !isSegment(f.outbound) || !isSegment(f.inbound)) {
    return no("flight legs");
  }
  // The trip's flights come from the itinerary's own Amadeus search; our own flight stock is not
  // sold on a trip (spec §13 call 3).
  if (f.isOffline === true || f.offlineId != null) return no("own-stock flight");
  const flight = { ...f, trainLegs: Array.isArray(f.trainLegs) ? f.trainLegs : [] } as unknown as ItineraryFlight;

  if (!isObj(raw.hotels)) return no("hotels");
  const hotelEntries = Object.entries(raw.hotels);
  if (hotelEntries.length > MAX_TRIP_LOAD) return no("too many hotels");
  const hotels: Record<string, OrderHotel> = {};
  for (const [key, h] of hotelEntries) {
    if (!isText(key, 40) || !isHotel(h)) return no(`hotel of stay ${key}`);
    hotels[key] = h as unknown as OrderHotel;
  }

  const form = parseTravellers(raw.travellers);
  if (!form) return no("travellers");
  // Phase 3: until payments are live a request that asks to pay is a hold (`PAYMENTS_LIVE`).
  const payNow = PAYMENTS_LIVE && raw.payNow === true;
  const travellers = fitTravellers(form, pax);
  if (Object.keys(validateTravellers(travellers, pax, payNow ? "pay" : "hold")).length) return no("travellers form");

  if (!isPositive(raw.clientTotal) || !isPositive(raw.clientPerTraveller)) return no("client total");

  const utmSource = typeof raw.utmSource === "string" ? raw.utmSource.trim().slice(0, 100) : "";

  return {
    ok: true,
    sub: {
      group,
      route,
      dates,
      pax,
      train,
      tickets,
      flight,
      hotels,
      travellers,
      clientTotal: raw.clientTotal,
      clientPerTraveller: raw.clientPerTraveller,
      utmSource,
      payNow,
      suggest: parseSuggestion(raw.suggest),
      splitPay: raw.splitPay === true,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Refusals: one code each, the HTTP status, the step the customer goes back to, the words
// ---------------------------------------------------------------------------------------------

export type ConfirmErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "ROUTE_CHANGED"
  | "TICKET_CHANGED"
  | "FLIGHT_CHANGED"
  | "HOTEL_CHANGED"
  | "OFFLINE_HOTEL_DATE_MISMATCH"
  | "OFFLINE_HOTEL_SOLD_OUT"
  | "HOTEL_NOT_REFUNDABLE"
  | "TRIP_INCOMPLETE"
  | "PRICE_CHANGED"
  | "PRICE_VALIDATION_FAILED"
  | "SERVER_ERROR";

const CODES: Record<ConfirmErrorCode, { status: number; step?: ItineraryStep }> = {
  NOT_FOUND: { status: 404 },
  BAD_REQUEST: { status: 400 },
  ROUTE_CHANGED: { status: 400, step: "build" },
  TICKET_CHANGED: { status: 409, step: "tickets" },
  // The offer no longer fits the trip's legs (count or departure days): pick a flight again.
  FLIGHT_CHANGED: { status: 409, step: "flights" },
  HOTEL_CHANGED: { status: 400, step: "hotels" },
  // The live code (confirm-order answers it with 409); a trip answers 400 like its other hotel refusals.
  OFFLINE_HOTEL_DATE_MISMATCH: { status: 400, step: "hotels" },
  // Our own block has fewer rooms left than the stay takes.
  OFFLINE_HOTEL_SOLD_OUT: { status: 400, step: "hotels" },
  HOTEL_NOT_REFUNDABLE: { status: 400, step: "hotels" },
  TRIP_INCOMPLETE: { status: 400, step: "tickets" },
  PRICE_CHANGED: { status: 409, step: "tickets" },
  PRICE_VALIDATION_FAILED: { status: 400 },
  SERVER_ERROR: { status: 500 },
};

const isCode = (v: unknown): v is ConfirmErrorCode => typeof v === "string" && v in CODES;

export type ConfirmFailure = {
  code: ConfirmErrorCode;
  status: number;
  step?: ItineraryStep;
  /** The event the refusal is about (route / ticket). */
  eventId?: number;
  /** The stay the refusal is about (hotel), `Stay.key`. */
  stayKey?: string;
};

/** A refusal; `status` overrides the code's own (e.g. HOTEL_CHANGED is 409 for an own-stock price mismatch). */
export function failure(
  code: ConfirmErrorCode,
  about: Pick<ConfirmFailure, "eventId" | "stayKey"> = {},
  status?: number,
): ConfirmFailure {
  return { code, ...CODES[code], ...about, ...(status ? { status } : {}) };
}

/** The words the customer reads, named when the event / the city is known. */
export function confirmMessage(code: ConfirmErrorCode, names: { event?: string; city?: string } = {}): string {
  const city = names.city || "אחת הערים";
  switch (code) {
    case "NOT_FOUND":
      return "בניית טיול לא זמינה כרגע.";
    case "BAD_REQUEST":
      return "משהו בבקשה לא הסתדר. רעננו את הדף ונסו שוב.";
    case "ROUTE_CHANGED":
      return names.event
        ? `המסלול השתנה: ${names.event} כבר לא זמין במסלול הזה. בדקו את המסלול ונסו שוב.`
        : "המסלול השתנה. בדקו את המסלול ונסו שוב.";
    case "TICKET_CHANGED":
      return names.event
        ? `הכרטיס ל${names.event} כבר לא זמין במחיר הזה. בחרו שוב ואשרו את הטיול.`
        : "אחד הכרטיסים כבר לא זמין במחיר הזה. בחרו שוב ואשרו את הטיול.";
    case "FLIGHT_CHANGED":
      return "הטיסה כבר לא מתאימה למסלול. בחרו טיסה שוב.";
    case "HOTEL_CHANGED":
      return `המלון ב${city} לא מתאים לתאריכי הלינה או למספר הנוסעים. בחרו מלון שוב.`;
    case "OFFLINE_HOTEL_DATE_MISMATCH":
      return `המלון שבחרתם ב${city} כבר לא זמין בתאריכים האלה. בחרו מלון שוב.`;
    case "OFFLINE_HOTEL_SOLD_OUT":
      return `החדרים שבחרתם במלון ב${city} כבר נתפסו. בחרו מלון אחר.`;
    case "HOTEL_NOT_REFUNDABLE":
      return `המלון שבחרתם ב${city} כבר לא ניתן לביטול. בחרו מלון אחר.`;
    case "TRIP_INCOMPLETE":
      return "חסר רכיב בטיול. השלימו את כל הרכיבים ונסו שוב.";
    case "PRICE_CHANGED":
      return "המחיר עודכן. עברו שוב על הכרטיסים, הטיסה והמלונות - המחיר המעודכן יופיע בסיכום.";
    case "PRICE_VALIDATION_FAILED":
      return "לא הצלחנו לאשר את המחיר של הטיול. נסו שוב, או כתבו לנו ונשמור אותו עבורכם.";
    case "SERVER_ERROR":
      return "לא הצלחנו לשמור את הטיול כרגע. נסו שוב בעוד רגע, או כתבו לנו ונשמור אותו עבורכם.";
  }
}

/** The names a refusal is about, from a route (and its dates, for a stay). */
function namesFor(f: Pick<ConfirmFailure, "eventId" | "stayKey">, route: Event[], dates: TripDates): { event?: string; city?: string } {
  const event = f.eventId != null ? route.find((e) => e.id === f.eventId)?.name : undefined;
  const stay = f.stayKey && route.length ? stays(route, dates).find((s) => s.key === f.stayKey) : undefined;
  return { event, city: stay ? stayCityName(stay.events[0]) : undefined };
}

/** The JSON body of a refusal: `{ error: code, message, step?, eventId?, stayKey? }`. */
export function failureBody(f: ConfirmFailure, route: Event[] = [], dates: TripDates = { depart: "", ret: "", moves: {} }) {
  return {
    error: f.code,
    message: confirmMessage(f.code, namesFor(f, route, dates)),
    ...(f.step ? { step: f.step } : {}),
    ...(f.eventId != null ? { eventId: f.eventId } : {}),
    ...(f.stayKey ? { stayKey: f.stayKey } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// The trip, judged on the server's events
// ---------------------------------------------------------------------------------------------

/**
 * The route as it is now: every event still there (`getEvents(id)` - `found[i]` for `ids[i]`),
 * still eligible today, no more than the settings allow, and each one still fits next to the
 * others (`compatibility` not blocked - the builder's own rule, on the current settings). In
 * date order.
 */
export function checkRoute(
  ids: number[],
  found: (Event | undefined)[],
  s: ItinerarySettings,
  todayIso: string,
): { ok: true; route: Event[] } | { ok: false; failure: ConfirmFailure } {
  const changed = (eventId?: number) => ({ ok: false as const, failure: failure("ROUTE_CHANGED", eventId != null ? { eventId } : {}) });
  const events: Event[] = [];
  for (const [i, id] of ids.entries()) {
    const e = found[i];
    if (!e || e.id !== id) return changed(id);
    events.push(e);
  }
  if (events.length < MIN_TRIP_EVENTS || events.length > s.maxEvents) return changed();
  // Listed (a row read by id is not filtered: a QA, deactivated or hidden event) and eligible today.
  for (const e of events) if (!isListedForTrip(e) || !isItineraryEligible(e, todayIso)) return changed(e.id);
  for (const e of events) {
    const others = events.filter((o) => o !== e);
    if (!isAddable(compatibility(others, e, s))) return changed(e.id);
  }
  return { ok: true, route: sortRoute(events) };
}

const sameDates = (a: TripDates, b: TripDates): boolean => {
  if (a.depart !== b.depart || a.ret !== b.ret) return false;
  const ak = Object.keys(a.moves);
  return ak.length === Object.keys(b.moves).length && ak.every((k) => a.moves[k] === b.moves[k]);
};

/**
 * The dates are the route's own: exactly what `clampTripDates` keeps for this route (the builder
 * only ever holds clamped dates), and every train move is one of the route's moves.
 */
export function checkDates(route: Event[], sub: Pick<TripSubmission, "dates" | "train">): ConfirmFailure | null {
  if (!sameDates(clampTripDates(route, sub.dates), sub.dates)) return failure("ROUTE_CHANGED");
  const keys = new Set(moves(route).map((m) => m.key));
  if (sub.train.some((k) => !keys.has(k))) return failure("ROUTE_CHANGED");
  return null;
}

/** The builder's state for this trip, on the server's route (date order) - what `livePrice` reads. */
export function tripState(sub: TripSubmission, route: Event[]): ItineraryState {
  return {
    ...INITIAL_ITINERARY_STATE,
    step: "summary",
    route,
    dates: sub.dates,
    pax: sub.pax,
    tickets: Object.fromEntries(route.map((e) => [e.id, sub.tickets[e.id]])),
    train: [...sub.train],
    flight: sub.flight,
    hotels: { ...sub.hotels },
  };
}

/**
 * Every piece is ready for the party - the flow's own rules (`ticketReady`, the flights step's
 * party, `stayHotelReady` on `stayRanges`) plus:
 *  - the flight has one leg per FLOWN leg of the trip (`tripLegs` with the train moves), each
 *    leaving on that leg's day (the search asked for those days) - the hotels' dates hang on that
 *    alignment (stayAdapter.ts `stayFlight`);
 *  - every hotel's rate may be sold for its check-in (`orderHotelSellable`, the live rule).
 * An own-stock hotel is taken like live: its block is checked against the database and its rooms
 * held by the flow (lib/itinerary/offlineHold.ts) - nothing here needs the database.
 */
export function checkPieces(state: ItineraryState, now: Date | number): ConfirmFailure | null {
  const { route, dates, pax, flight } = state;
  const train = new Set(state.train);
  for (const e of route) if (!ticketReady(state.tickets[e.id], pax)) return failure("TICKET_CHANGED", { eventId: e.id });
  const flown = tripLegs(route, dates, train);
  const legs = flight?.legs ?? [];
  if (!flight || flight.numOfTravelers !== pax || legs.length !== flown.length) return failure("FLIGHT_CHANGED");
  if (legs.some((leg, i) => String(leg.departureTime).slice(0, 10) !== flown[i].date)) return failure("FLIGHT_CHANGED");
  const ranges = stayRanges(route, dates, flight, train);
  for (const [i, stay] of stays(route, dates).entries()) {
    const h = state.hotels[stay.key];
    if (!stayHotelReady(h, ranges[i], pax)) return failure("HOTEL_CHANGED", { stayKey: stay.key });
    if (!orderHotelSellable(h, now)) return failure("HOTEL_NOT_REFUNDABLE", { stayKey: stay.key });
  }
  return null;
}

/**
 * A live-priced ticket - TixStock and LiveTickets (their live price can sit below the stored one) -
 * may not go below this share of its stored price: the live floor's slack
 * (app/api/confirm-order/utils.ts:248). For LiveTickets it holds ALWAYS, beside the live check
 * (`validateLiveTicketsOffer`): that check answers "fine" both when it passed and when it could
 * not run, so nothing may rest on it alone.
 */
export const UNCHECKED_PRICE_FLOOR = 0.6;

/** The event's own row of the order's ticket (by id), if it still has one. */
export function ticketRow(e: Event, t: Pick<OrderTicket, "id"> | undefined): EventTicket | undefined {
  return t?.id ? (e.tickets_and_rates ?? []).find((r) => r?.id === t.id) : undefined;
}

/** Below `UNCHECKED_PRICE_FLOOR` of the row's stored price (or no price to compare)? */
export function belowUncheckedFloor(t: Pick<OrderTicket, "price">, row: Pick<EventTicket, "price">): boolean {
  return !(Number(t.price) >= UNCHECKED_PRICE_FLOOR * Number(row.price));
}

/**
 * The tickets with the supplier's event id taken from the event's own row (`eid`), never the
 * client's: the live LiveTickets check reads it (`supplier_event_id`), ops buy by it, the cost
 * snapshot looks it up. A ticket without a row is left as it is (`checkTickets` refused it).
 */
export function withRowEids(route: Event[], tickets: Record<number, OrderTicket>): Record<number, OrderTicket> {
  const out: Record<number, OrderTicket> = { ...tickets };
  for (const e of route) {
    const t = tickets[e.id];
    const row = ticketRow(e, t);
    if (t && row) out[e.id] = { ...t, eid: row.eid };
  }
  return out;
}

/**
 * Each ticket is one the event still sells, on the event the server re-read: every supplier's
 * ticket is a row of the event's own `tickets_and_rates` (the live ticket step prices those rows -
 * lib/supplier-offers.ts `priceTicketsForQuantity` - and the order keeps the row's id; a together
 * twin records its real ticket, `orderTicketId`; TixStock's live sync rewrites prices, never ids),
 * so its id must be there and not off sale (`available === false`), and the supplier the order
 * names must be that row's.
 * The price, by supplier:
 *  - our own and static tickets are never live-priced (`ownTicketForQuantity`): not below the row's;
 *  - TixStock and LiveTickets: not below `UNCHECKED_PRICE_FLOOR` of the row's - for LiveTickets on
 *    top of its live check (`validateLiveTicketsOffer`, on the row's `eid`, ≥ 97% of the live offer
 *    when it runs).
 * 409 TICKET_CHANGED: the customer picks again on fresh rows.
 */
export function checkTickets(route: Event[], tickets: Record<number, OrderTicket | undefined>): ConfirmFailure | null {
  for (const e of route) {
    const t = tickets[e.id];
    const row = ticketRow(e, t);
    if (!t || !row || row.available === false) return failure("TICKET_CHANGED", { eventId: e.id });
    const supplier = ticketSupplier(row, e.type);
    if (ticketSupplier(t, e.type) !== supplier) return failure("TICKET_CHANGED", { eventId: e.id });
    if (supplier === "static" && !(Number(t.price) >= Number(row.price))) return failure("TICKET_CHANGED", { eventId: e.id });
    if ((supplier === "tixstock" || supplier === "livetickets") && belowUncheckedFloor(t, row)) {
      return failure("TICKET_CHANGED", { eventId: e.id });
    }
  }
  return null;
}

/** A date-time that names its zone (`Z` / `±hh:mm`). */
const ZONED_RE = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const WALL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/;

const ISRAEL_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jerusalem",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Israel's offset from UTC at an instant, ms (DST-aware - the platform's time-zone data). */
function israelOffsetMs(ms: number): number {
  const p = Object.fromEntries(ISRAEL_PARTS.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/**
 * The event's date as the live summary stores it: the BROWSER turns `event.date` into an instant
 * (`new Date(event.date)`, app/order/OrderReview.tsx:1636). `events.date` is a Postgres DATE, so
 * production sends "YYYY-MM-DD" - which JavaScript reads as UTC midnight in ANY zone (a date-only
 * ISO form): kept exactly so, = the live row. A date-TIME without a zone is read by the browser as
 * Israel time - on the server (UTC) the same call would put a 20:00 show at 23:00 Israel and a
 * 22:00 one on the next day - so it is read as its wall time in Asia/Jerusalem (summer and winter
 * time alike). A date that names its zone is read as is. ISO string out; an unreadable value comes
 * back as it is.
 */
export function eventDateIso(value: string): string {
  const v = String(value ?? "").trim();
  if (ZONED_RE.test(v) || DAY_RE.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toISOString();
  }
  const m = WALL_RE.exec(v);
  if (!m) return v;
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0));
  // The offset at the guessed instant, then once more at the instant it gives (a DST change between).
  let ms = wall - israelOffsetMs(wall);
  ms = wall - israelOffsetMs(ms);
  return new Date(ms).toISOString();
}

// ---------------------------------------------------------------------------------------------
// The price
// ---------------------------------------------------------------------------------------------

/** The summary's `livePrice`, on the trip rebuilt from the request and the server's events. */
export function serverPrice(sub: TripSubmission, route: Event[], s: ItinerarySettings): LivePrice | null {
  return livePrice(tripState(sub, route), s);
}

/** The price per traveller the summary showed (whole dollars, rounded up), or null when incomplete. */
export function serverPerTraveller(sub: TripSubmission, route: Event[], s: ItinerarySettings): number | null {
  return serverPrice(sub, route, s)?.perTraveller ?? null;
}

/** The party totals agree: within $1 (rounding). */
export function totalsMatch(server: number, client: number): boolean {
  return Number.isFinite(server) && Number.isFinite(client) && Math.abs(server - client) <= 1;
}

const cents = (n: number): number => Math.round(n * 100) / 100;

/**
 * Each event's part of the party's charge, USD, in route (date) order - the terms of `livePrice`'s
 * one sum, grouped by the row that carries them: the event's ticket and tiered markup × the party,
 * its stay's hotel (`hotelPerTraveller` × the party) on the first event of the stay, the flight's
 * own price on the first event. Σ parts, rounded up once, is `livePrice(...).total`.
 */
export function eventParts(state: ItineraryState, s: ItinerarySettings): number[] {
  const { route, dates, pax, flight } = state;
  const tiers = tierMarkups(route, s);
  const ranges = stayRanges(route, dates, flight, new Set(state.train));
  const hotelOf = new Map<number, number>();
  stays(route, dates).forEach((stay, i) => {
    const h = state.hotels[stay.key];
    hotelOf.set(stay.events[0].id, h ? hotelPerTraveller(h, stay.events[0], ranges[i]) * pax : Number.NaN);
  });
  return route.map((e, i) => {
    let part = (Number(state.tickets[e.id]?.price) + (tiers.get(e.id) ?? Number.NaN)) * pax;
    if (hotelOf.has(e.id)) part += hotelOf.get(e.id) ?? Number.NaN;
    if (i === 0) part += Number(flight?.price);
    return cents(part);
  });
}

/**
 * The rows' shares of `total` (USD, whole dollars - `livePrice`'s total) and of its ILS charge,
 * `ceil(total × rate)` - the live rounding (`finalPurchasePriceILSCalc`, app/order/hooks.tsx:
 * `Math.ceil(USDprice * travelRate)`): every row but the first gets its own part, rounded; the
 * first takes the rest, so each column adds up to its total exactly.
 */
export function splitTotal(parts: number[], total: number, rate: number): { usd: number[]; ils: number[]; totalIls: number } {
  const totalIls = Math.ceil(total * rate);
  const usd = parts.map((p, i) => (i === 0 ? 0 : Math.round(p)));
  const ils = parts.map((p, i) => (i === 0 ? 0 : Math.round(p * rate)));
  usd[0] = total - usd.reduce((a, b) => a + b, 0);
  ils[0] = totalIls - ils.reduce((a, b) => a + b, 0);
  return { usd, ils, totalIls };
}

// ---------------------------------------------------------------------------------------------
// The rows
// ---------------------------------------------------------------------------------------------

type OrderEventInfo = OrderData["event_order_info"];

/**
 * The event's ticket in the single-event shape the live summary sends (app/order/OrderReview.tsx
 * `event_order_info`), for the party. `date` is a Date there; a row stores its ISO string
 * (`buildGroupRows`), which is what the live request's JSON carries.
 */
export function eventOrderInfo(e: Event, t: OrderTicket, pax: number): OrderEventInfo {
  return {
    event_id: e.id,
    date: new Date(e.date),
    name: e.name,
    location_name: placeLabel(e),
    number_of_ticket: pax,
    category: t.category,
    event_type: e.type,
    event_tags: e.tags || "",
    event_additional_markup: e.event_additional_markup ?? null,
    price_per_ticket: t.price,
    total_tickets_price: t.price * pax,
    vendor: t.vendor,
    id: t.id,
    supplier: t.supplier,
    supplier_event_id: t.eid,
    supplier_category: t.supplierCategory,
    zone_label: t.zoneLabel,
    non_instant: t.nonInstant || undefined,
    seating_choice: t.seatingChoice,
  };
}

/**
 * One event of the trip as a single-event `OrderData` - only for the live per-event validators
 * (`validateLiveTicketsOffer`, `validateOwnStock`), which read `event_id`, `is_agent_booking` and
 * `event_order_info` (and set its `non_instant` / `own_stock` from the event). The money fields
 * are not theirs to read and stay 0; a trip is never an agent booking.
 */
export function toSingleEventOrderData(sub: TripSubmission, event: Event, info?: OrderEventInfo): OrderData {
  return {
    ...toOrderContactFields(fitTravellers(sub.travellers, sub.pax)),
    event_order_info: info ?? eventOrderInfo(event, sub.tickets[event.id], sub.pax),
    flight_order_info: {},
    hotel_order_info: {},
    hotel_segments: null,
    user_shown_price: 0,
    event_id: event.id,
    aff_partner_tracking_code: sub.utmSource,
    booking_reference: "",
    final_purchase_price_ils: 0,
    exchange_rate_usd_ils_100: 0,
    is_agent_booking: false,
    confirmation_email_sent: false,
  };
}

/** A row's `event_order_info`: the live shape, the date as an ISO string (as the live JSON has it). */
export type RowEventInfo = Omit<OrderEventInfo, "date"> & { date: string };

/** One reservation row of the trip, as inserted. */
export type GroupRowInsert = ReturnType<typeof toOrderContactFields> & {
  event_id: number;
  event_order_info: RowEventInfo;
  /** The whole trip's flight on seq 1; `{}` ("no flight") on the others. */
  flight_order_info: ItineraryFlight | Record<string, never>;
  /** The stay's hotel on the first event of the stay; `{}` on the others. */
  hotel_order_info: OrderHotel | Record<string, never>;
  /** Our own hotel stock on the row that carries it (confirm-order's columns); null otherwise. */
  offline_hotel_id: number | null;
  offline_hotel_ids: number[] | null;
  offline_hotel_cost: number | null;
  user_shown_price: number;
  final_purchase_price_ils: number;
  exchange_rate_usd_ils_100: number;
  aff_partner_tracking_code: string;
  /** Always null: a non-null payment_info reads as paid elsewhere. */
  payment_info: null;
  status: "24Save" | "Pending";
  gtmIdnts: string | null;
  itinerary_group: string;
  itinerary_seq: number;
  itinerary_of: number;
};

export type GroupRowsCtx = {
  group: string;
  /** ILS per USD (the travel rate confirm-order's checks use). */
  rateIls: number;
  settings: ItinerarySettings;
  status: "24Save" | "Pending";
  /** Each event's `event_order_info` after the live validators ran on it (their flags). */
  infos?: Map<number, OrderEventInfo>;
  gtmIdnts?: string | null;
};

/**
 * One row per event, in date order (`route` = `checkRoute`'s): seq 1..N of N, the flight on seq
 * 1, each stay's hotel on its first event (`persistableHotel` - no in-session fields), the
 * contact on every row, the shares of `livePrice`'s total (`splitTotal`). Throws on a trip
 * `livePrice` cannot price (the caller checked it first).
 */
export function buildGroupRows(sub: TripSubmission, route: Event[], ctx: GroupRowsCtx): GroupRowInsert[] {
  if (!Number.isFinite(ctx.rateIls) || ctx.rateIls <= 0) throw new Error("buildGroupRows: no exchange rate");
  const state = tripState(sub, route);
  const price = livePrice(state, ctx.settings);
  if (!price) throw new Error("buildGroupRows: the trip is not complete");
  const parts = eventParts(state, ctx.settings);
  if (!parts.every(Number.isFinite)) throw new Error("buildGroupRows: a part of the price is not a number");
  const split = splitTotal(parts, price.total, ctx.rateIls);
  const firstOfStay = new Map(stays(route, sub.dates).map((stay) => [stay.events[0].id, stay.key]));
  const contact = toOrderContactFields(fitTravellers(sub.travellers, sub.pax));

  return route.map((e, i): GroupRowInsert => {
    const info = ctx.infos?.get(e.id) ?? eventOrderInfo(e, sub.tickets[e.id], sub.pax);
    const stayKey = firstOfStay.get(e.id);
    const hotel = stayKey !== undefined ? sub.hotels[stayKey] : undefined;
    return {
      ...contact,
      event_id: e.id,
      // As the live summary sends it: the instant the customer's (Israeli) browser makes of the date.
      event_order_info: { ...info, date: eventDateIso(e.date) },
      flight_order_info: i === 0 ? sub.flight : {},
      hotel_order_info: hotel ? persistableHotel(hotel) : {},
      ...offlineHotelColumns(hotel),
      user_shown_price: split.usd[i],
      final_purchase_price_ils: split.ils[i],
      exchange_rate_usd_ils_100: Math.round(ctx.rateIls * 100),
      aff_partner_tracking_code: sub.utmSource,
      payment_info: null,
      status: ctx.status,
      gtmIdnts: ctx.gtmIdnts ?? null,
      itinerary_group: ctx.group,
      itinerary_seq: i + 1,
      itinerary_of: route.length,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// The browser's side
// ---------------------------------------------------------------------------------------------

/**
 * What a hold answers: the group, its reservation ids (seq order), seq 1's booking reference, and
 * whether THIS answer sent the customer's email (`emailed`: true = sent, false = not sent or it
 * failed; absent = unknown - the group was written by an earlier request, a retry's answer). The
 * confirmation says "sent to your email" only on true.
 */
export type HeldAnswer = { group: string; ids: number[]; reference: string | null; emailed?: boolean };

export function isHeldAnswer(v: unknown): v is HeldAnswer {
  return (
    isObj(v) &&
    typeof v.group === "string" &&
    Array.isArray(v.ids) &&
    v.ids.length > 0 &&
    v.ids.every((id) => typeof id === "number") &&
    (v.reference === null || v.reference === undefined || typeof v.reference === "string") &&
    (v.emailed === undefined || typeof v.emailed === "boolean")
  );
}

/**
 * The request the summary sends for its trip: the picked pieces as they are, the travellers fitted
 * to the party, and the summary's own price (`livePrice`). Only the route's tickets and the
 * route's stays' hotels go (a hotel of a stay the trip no longer has stays home).
 */
export function submissionFromState(
  state: ItineraryState,
  travellers: TravellersInput,
  group: string,
  price: LivePrice,
  extra: { utmSource?: string; payNow?: boolean; suggest?: TripSuggestion | null; splitPay?: boolean } = {},
): TripSubmission {
  if (!state.flight) throw new Error("submissionFromState: the trip has no flight");
  const tickets: Record<number, OrderTicket> = {};
  for (const e of state.route) {
    const t = state.tickets[e.id];
    if (t) tickets[e.id] = t;
  }
  const hotels: Record<string, OrderHotel> = {};
  for (const stay of stays(state.route, state.dates)) {
    const h = state.hotels[stay.key];
    if (h) hotels[stay.key] = h;
  }
  return {
    group,
    route: state.route.map((e) => e.id),
    dates: state.dates,
    pax: state.pax,
    train: state.train,
    tickets,
    flight: state.flight,
    hotels,
    travellers: fitTravellers(travellers, state.pax),
    clientTotal: price.total,
    clientPerTraveller: price.perTraveller,
    utmSource: extra.utmSource ?? "",
    payNow: extra.payNow === true,
    suggest: extra.suggest ?? null,
    splitPay: extra.splitPay === true,
  };
}

/**
 * What the summary does with a refusal:
 *  - "go": back to the step that changed, with the message as the route's notice - the event's
 *    tab (ticket) or the city's tab (hotel) open; `reloadRows` = the route's rows are read again
 *    on the tickets step (the server priced fresher event data - markups, base hotel prices);
 *  - "stay": the message on the summary (a server error, the price floor, a broken request).
 */
export type HoldAction =
  | { kind: "stay"; code: ConfirmErrorCode; message: string }
  | {
      kind: "go";
      code: ConfirmErrorCode;
      step: ItineraryStep;
      message: string;
      eventIndex?: number;
      stayIndex?: number;
      reloadRows: boolean;
    };

export function confirmFailureAction(status: number, body: unknown, state: ItineraryState): HoldAction {
  const b = isObj(body) ? body : {};
  const code: ConfirmErrorCode = isCode(b.error) ? b.error : status >= 500 || !status ? "SERVER_ERROR" : "BAD_REQUEST";
  const eventId = typeof b.eventId === "number" ? b.eventId : undefined;
  const stayKey = typeof b.stayKey === "string" ? b.stayKey : undefined;
  const message = confirmMessage(code, namesFor({ eventId, stayKey }, state.route, state.dates));
  const eventIndex = eventId != null ? state.route.findIndex((e) => e.id === eventId) : -1;
  const stayIndex = stayKey && state.route.length ? stays(state.route, state.dates).findIndex((s) => s.key === stayKey) : -1;
  const step = CODES[code].step;
  if (!step) return { kind: "stay", code, message };
  return {
    kind: "go",
    code,
    step,
    message,
    ...(step === "tickets" && eventIndex >= 0 ? { eventIndex } : {}),
    ...(step === "hotels" && stayIndex >= 0 ? { stayIndex } : {}),
    reloadRows: code === "PRICE_CHANGED" || code === "TICKET_CHANGED",
  };
}

/** Said when the price changed again right after the trip was re-priced on fresh rows. */
export const PRICE_STILL_CHANGING = "המחיר עדיין משתנה - רעננו את הדף או דברו איתנו";

/**
 * "The price changed" a second time in a row (the trip was already re-priced on fresh rows): no
 * second bounce through the steps - the summary says so and offers a refresh and the WhatsApp
 * contact. (Known cause: the page's settings are read once, at render - a staff save of the tiers
 * mid-session needs a refresh.) `consecutive` counts this answer (`notePriceAnswer`).
 */
export function escalatePriceChange(action: HoldAction, consecutive: number): HoldAction {
  if (action.code !== "PRICE_CHANGED" || consecutive < 2) return action;
  return { kind: "stay", code: "PRICE_CHANGED", message: PRICE_STILL_CHANGING };
}

/**
 * Which trip a hold was for: the route (in order), the dates (depart, return, every move), the
 * party and the train moves. NOT the step, the tickets, the flight, the hotels or the event rows -
 * a "the price changed" bounce itself changes those (fresh rows, the tickets step, the re-picks),
 * and the next attempt is still the same trip.
 */
export function tripKey(state: Pick<ItineraryState, "route" | "dates" | "pax" | "train">): string {
  const moveDays = Object.keys(state.dates.moves)
    .sort()
    .map((k) => `${k}=${state.dates.moves[k]}`);
  return JSON.stringify([
    state.route.map((e) => e.id),
    state.dates.depart,
    state.dates.ret,
    moveDays,
    state.pax,
    [...state.train].sort(),
  ]);
}

/**
 * What one hold attempt was for: the trip (`tripKey`), its picks - each event's ticket, the flight
 * (an offer id repeats across searches, so its price and legs too), each stay's hotel and rate -
 * and the price it sent. Two attempts with the same signature are the same request.
 */
export function holdSignature(state: ItineraryState, total: number): string {
  const tickets = state.route.map((e) => state.tickets[e.id]?.id ?? "");
  const f = state.flight;
  const flight = f
    ? [
        f.id,
        f.price,
        f.numOfTravelers,
        (f.legs ?? []).map((l) => `${l.departureAirport}>${l.arrivalAirport}@${l.departureTime}#${l.flightNumber ?? ""}`),
      ]
    : null;
  const hotels = state.route.length
    ? stays(state.route, state.dates).map((s) => {
        const h = state.hotels[s.key];
        return h ? [h.id, h.rate?.match_hash ?? "", h.checkin, h.checkout, h.offlineIds ?? []] : null;
      })
    : [];
  return JSON.stringify([tripKey(state), tickets, flight, hotels, total]);
}

/** A hold attempt's group id (`itinerary_group`, the idempotency key) and what it was sent for. */
export type HoldAttempt = { group: string; signature: string };

/**
 * The group id an attempt sends: the previous attempt's ONLY for a retry of the identical trip (a
 * double click, a retry after an error or a lost answer - the server then answers the rows it may
 * already have written); anything else - another trip, another pick, another price - gets a new
 * one. An edited trip sent with the old group would be answered with the OLD trip's rows, as if
 * the new one were held.
 */
export function holdAttempt(prev: HoldAttempt | null, signature: string, makeId: () => string = newGroupId): HoldAttempt {
  return prev && prev.signature === signature ? prev : { group: makeId(), signature };
}

/** The hold's "the price changed" answers in a row, for one trip (`tripKey`). */
export type PriceChangeMemo = { key: string; count: number; at: number };
export const NO_PRICE_CHANGES: PriceChangeMemo = { key: "", count: 0, at: 0 };

/**
 * How long a first "the price changed" waits for the second to count as "in a row": the trip's
 * draft life (30 minutes) - a customer back an hour later starts over.
 */
const PRICE_CHANGE_WINDOW_MS = ITINERARY_DRAFT_TTL_MS;

/**
 * The memo after the hold's answer: a "the price changed" for the SAME trip within the window
 * counts on; for another trip (route / dates / party / train changed) or after the window it is
 * the first again; any other answer - a hold, another refusal, no answer - clears it.
 */
export function notePriceAnswer(memo: PriceChangeMemo, key: string, priceChanged: boolean, now: number): PriceChangeMemo {
  if (!priceChanged) return NO_PRICE_CHANGES;
  const consecutive = memo.count > 0 && memo.key === key && now - memo.at <= PRICE_CHANGE_WINDOW_MS;
  return { key, count: consecutive ? memo.count + 1 : 1, at: now };
}
