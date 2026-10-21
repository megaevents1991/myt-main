/**
 * "Build Your Euro Trip" - the trip's draft: a refresh (or a phone dropping a background tab)
 * must not send the customer back to an empty builder. Pure: no window, no clock (the caller
 * passes `now`). The storage calls are in ./draftStorage.ts.
 *
 * The regular order's draft is the pattern (lib/order/draft.ts): sessionStorage (this tab
 * only), versioned, 30 minutes from the last save, read back in an effect after the first
 * render, anything doubtful dropped whole. One difference: a trip's draft never stores a
 * price. What comes back is the trip's SHAPE - the route, its dates, the party, the moves by
 * train, the category held for each event, the travellers' form - and the flow reopens on the
 * tickets step: every ticket is priced again by the live ticket step (which reopens each tab on
 * the held category - `held` - while it still sells for the party), the flight and the hotels
 * are searched again. Nothing restored is ever a price promise.
 */
import type { Event, OrderTicket } from "@/lib/app.types";
import { clampTripDates, moves } from "./dates";
import { sortRoute } from "./rules";
import { ITINERARY_STEPS, MAX_TRAVELLERS, MIN_TRIP_EVENTS, type ItineraryState, type ItineraryStep } from "./state";
import { fitTravellers, type TravellersInput } from "./travellers";
import type { TripDates } from "./types";

export const ITINERARY_DRAFT_KEY = "myt:itinerary-draft";
/** Bump when the stored shape changes - an older draft is then ignored, never migrated. */
export const ITINERARY_DRAFT_VERSION = 1;
/** A draft older than this is dropped (from its last save, so an active trip keeps living). */
export const ITINERARY_DRAFT_TTL_MS = 30 * 60 * 1000;

/** At most this many events in a stored route (settings' `max_events` is 2-3). */
const MAX_ROUTE = 3;
/** A typed value longer than this is not a name, a phone or an email. */
const MAX_TEXT = 120;

/** The category a tab reopens on: no price - the ticket step prices it again. */
export type HeldTicket = Pick<OrderTicket, "id" | "category" | "quantity"> & { zoneLabel?: string };

export type ItineraryDraftForm = { travellers: TravellersInput; termsAccepted: boolean };

/** What comes back: the trip's shape (a `Partial` of the state, flight and hotels never), the held categories and the form. */
export type RestoredDraft = Pick<ItineraryState, "route" | "mode" | "dates" | "pax" | "train" | "step"> & {
  held: Record<number, HeldTicket>;
  form: ItineraryDraftForm | null;
  /** The step the draft was saved on (the flow reopens on `step`): past the tickets = there are picks to make again. */
  savedStep: ItineraryStep;
};

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): string => (typeof v === "string" ? v.slice(0, MAX_TEXT) : "");
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const day = (v: unknown): string => (typeof v === "string" && DAY_RE.test(v) ? v : "");

/** Saved within the TTL (a clock that jumped back a minute is tolerated). */
const isFresh = (savedAt: unknown, now: number): savedAt is number =>
  typeof savedAt === "number" && Number.isFinite(savedAt) && savedAt <= now + 60_000 && now - savedAt <= ITINERARY_DRAFT_TTL_MS;

/** A held ticket's own fields - never its price, supplier or anything else on it. */
function heldOf(t: Partial<HeldTicket> | undefined): HeldTicket | null {
  if (!t || typeof t.id !== "string" || !t.id) return null;
  const out: HeldTicket = { id: t.id, category: text(t.category), quantity: Number(t.quantity) };
  if (typeof t.zoneLabel === "string" && t.zoneLabel) out.zoneLabel = text(t.zoneLabel);
  return out;
}

/**
 * The trip as a stored draft (JSON). `held` = categories restored from an earlier draft whose
 * tab was not opened again yet - kept until the step picks (a pick in `state.tickets` wins).
 */
export function serializeDraft(
  state: ItineraryState,
  now: number,
  extra: { held?: Record<number, HeldTicket>; form?: ItineraryDraftForm | null } = {},
): string {
  const tickets: Record<number, HeldTicket> = {};
  for (const e of state.route) {
    const t = heldOf(state.tickets[e.id] ?? extra.held?.[e.id]);
    if (t) tickets[e.id] = t;
  }
  return JSON.stringify({
    v: ITINERARY_DRAFT_VERSION,
    savedAt: now,
    route: state.route.map((e) => e.id),
    mode: state.mode,
    dates: state.dates,
    pax: state.pax,
    train: state.train,
    step: state.step,
    tickets,
    form: extra.form ?? null,
  });
}

function parseForm(raw: unknown, pax: number): ItineraryDraftForm | null {
  if (!isRecord(raw) || !isRecord(raw.travellers)) return null;
  const c = isRecord(raw.travellers.contact) ? raw.travellers.contact : {};
  const others = Array.isArray(raw.travellers.others) ? raw.travellers.others : [];
  const travellers: TravellersInput = {
    contact: { firstName: text(c.firstName), lastName: text(c.lastName), phone: text(c.phone), email: text(c.email) },
    others: others.slice(0, MAX_TRAVELLERS).map((o) => {
      const r = isRecord(o) ? o : {};
      return { firstName: text(r.firstName), lastName: text(r.lastName) };
    }),
  };
  return { travellers: fitTravellers(travellers, pax), termsAccepted: raw.termsAccepted === true };
}

function parseDates(raw: unknown): TripDates {
  const r = isRecord(raw) ? raw : {};
  const ms = isRecord(r.moves) ? r.moves : {};
  return {
    depart: day(r.depart),
    ret: day(r.ret),
    moves: Object.fromEntries(Object.entries(ms).flatMap(([k, v]) => (day(v) ? [[k, day(v)]] : []))),
  };
}

/**
 * A stored draft that is ours, fresh and well-formed, matched against the catalog the page
 * holds now - or null. Events the catalog no longer holds are dropped (the rest of the trip
 * comes back); none left = nothing to restore. The dates are clamped for the route as it is
 * now, train moves that no longer exist are dropped, a held category is kept only for an event
 * of the route and for the party size. Never a flight, a hotel or a price.
 *
 * The step: the build step while the route has fewer than two events or the customer had not
 * left it; else the tickets step - the first step whose picks must be priced again.
 */
export function parseDraft(raw: string | null, now: number, catalog: Map<number, Event>): RestoredDraft | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.v !== ITINERARY_DRAFT_VERSION || !isFresh(parsed.savedAt, now)) return null;
  if (!Array.isArray(parsed.route)) return null;
  const pax = parsed.pax;
  if (typeof pax !== "number" || !Number.isInteger(pax) || pax < 1 || pax > MAX_TRAVELLERS) return null;

  const ids = parsed.route.filter((id): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0);
  const route = sortRoute(
    [...new Set(ids)].slice(0, MAX_ROUTE).flatMap((id) => {
      const e = catalog.get(id);
      return e ? [e] : [];
    }),
  );
  if (!route.length) return null;

  const moveKeys = new Set(moves(route).map((m) => m.key));
  const train = Array.isArray(parsed.train)
    ? [...new Set(parsed.train.filter((k): k is string => typeof k === "string" && moveKeys.has(k)))]
    : [];

  const stored = isRecord(parsed.tickets) ? parsed.tickets : {};
  const held: Record<number, HeldTicket> = {};
  for (const e of route) {
    const t = heldOf(isRecord(stored[e.id]) ? (stored[e.id] as Partial<HeldTicket>) : undefined);
    if (t && t.quantity === pax) held[e.id] = t;
  }

  const savedStep = ITINERARY_STEPS.find((st) => st === parsed.step) ?? "build";
  return {
    route,
    mode: parsed.mode === "route" ? "route" : "custom",
    dates: clampTripDates(route, parseDates(parsed.dates)),
    pax,
    train,
    step: route.length >= MIN_TRIP_EVENTS && savedStep !== "build" ? "tickets" : "build",
    held,
    form: parseForm(parsed.form, pax),
    savedStep,
  };
}

/** What the browser says about how this page was loaded (`PerformanceNavigationTiming`). */
export type PageNavigation = { type?: string; name?: string };

const trimPath = (p: string): string => p.replace(/\/+$/, "") || "/";

/**
 * May this page load bring the tab's draft back? Only when the builder page ITSELF was
 * reloaded or reached by the browser's back / forward - a refresh, or a phone bringing back a
 * dropped tab. A fresh visit (a hub card, a link, a typed address) starts clean, and its first
 * save replaces the old draft: the regular order's rule (a draft lives while the tab is on its
 * order page - components/order/OrderDraftSweeper.tsx), without touching the root layout.
 * `nav.name` is the URL the document was loaded at: a reload of the hub followed by a click on
 * a card is a reload entry for the hub, not for this page.
 */
export function draftMayRestore(nav: PageNavigation | null | undefined, pathname: string): boolean {
  if (!nav || (nav.type !== "reload" && nav.type !== "back_forward")) return false;
  try {
    return trimPath(new URL(nav.name ?? "").pathname) === trimPath(pathname);
  } catch {
    return false;
  }
}

/** The same events, in any order (`?events=` and a draft name the same trip). */
export function sameRouteIds(a: Event[], b: Event[]): boolean {
  if (!a.length || a.length !== b.length) return false;
  const ids = new Set(a.map((e) => e.id));
  return b.every((e) => ids.has(e.id));
}
