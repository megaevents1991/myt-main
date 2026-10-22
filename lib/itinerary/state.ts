/**
 * "Build Your Euro Trip" - the builder's state and its one reducer. Pure: no I/O, no clock.
 *
 * Invariants the reducer keeps on every action:
 *  - `route` is in trip order (`sortRoute`) and every event in it was addable when it joined;
 *  - `dates` is always `clampTripDates` output for the route (never raw input), so `stays`,
 *    `tripLegs` and `trainLegs` can read it as is; an empty route has `EMPTY_DATES`;
 *  - a change of route, dates, travellers or train toggles clears `flight` and `hotels`
 *    (both were searched for the old trip); another flight keeps only the hotels still on
 *    their stay's nights under it (`hotelsForFlight`); a route change drops the tickets of events
 *    that left it and the train toggles of moves that no longer exist;
 *  - the flow leaves the build step only with two events or more.
 * An action that changes nothing returns the same state object.
 */
import type { Event, ItineraryFlight, OrderHotel, OrderTicket } from "@/lib/app.types";
import { clampTripDates, defaultTripDates, moves, stays } from "./dates";
import { eventDay, eventPoint, stayPoint } from "./geo";
import { compatibility, isAddable, sortRoute } from "./rules";
import type { ItinerarySettings } from "./settings";
import { hotelsForFlight } from "./stayAdapter";
import type { Compat, TripDates } from "./types";

export const ITINERARY_STEPS = ["build", "tickets", "flights", "hotels", "summary"] as const;
export type ItineraryStep = (typeof ITINERARY_STEPS)[number];
export type ItineraryMode = "route" | "custom";

/** Same cap as the ticket step's MAX_TICKETS. */
export const MAX_TRAVELLERS = 9;
export const DEFAULT_TRAVELLERS = 2;
/** The flow needs this many events before it leaves the build step. */
export const MIN_TRIP_EVENTS = 2;

export const EMPTY_DATES: TripDates = { depart: "", ret: "", moves: {} };

export type ItineraryState = {
  step: ItineraryStep;
  mode: ItineraryMode;
  route: Event[];
  dates: TripDates;
  pax: number;
  /** The ticket picked for each event of the route, by event id. */
  tickets: Record<number, OrderTicket | undefined>;
  /** Keys of the moves made by train (`TripDates.moves` keys). */
  train: string[];
  flight: ItineraryFlight | null;
  /** The hotel picked for each stay, by `Stay.key`. */
  hotels: Record<string, OrderHotel | undefined>;
  /** Index of the open event tab (tickets step). */
  activeEvent: number;
  /** Index of the open stay tab (hotels step). */
  activeStay: number;
};

export const INITIAL_ITINERARY_STATE: ItineraryState = {
  step: "build",
  mode: "custom",
  route: [],
  dates: EMPTY_DATES,
  pax: DEFAULT_TRAVELLERS,
  tickets: {},
  train: [],
  flight: null,
  hotels: {},
  activeEvent: 0,
  activeStay: 0,
};

export type ItineraryAction =
  /** The route the page opened on (the URL), already fitted with `fitRoute`. */
  | { type: "load"; route: Event[]; mode: ItineraryMode }
  | { type: "addEvent"; event: Event; settings: ItinerarySettings }
  | { type: "removeEvent"; id: number }
  | { type: "setMode"; mode: ItineraryMode }
  | { type: "setDates"; dates: TripDates }
  | { type: "setPax"; pax: number }
  | { type: "setTicket"; eventId: number; ticket: OrderTicket | undefined }
  | { type: "setEventData"; event: Event }
  | { type: "toggleTrain"; key: string }
  | { type: "setFlight"; flight: ItineraryFlight | null }
  | { type: "setHotel"; stayKey: string; hotel: OrderHotel | undefined }
  /** The flight and every hotel go (the tickets step changed the party) - nothing else. */
  | { type: "clearTravel" }
  /**
   * The summary's 15-minute hold ran out: every priced piece is released - the tickets, the
   * flight, the hotels. The trip's shape (route, dates, party, train moves) stays.
   */
  | { type: "releaseHold" }
  | { type: "goStep"; step: ItineraryStep }
  | { type: "setActiveEvent"; index: number }
  | { type: "setActiveStay"; index: number };

/**
 * Events added one by one in trip order, each only when it can join the ones before it
 * (`compatibility`). What could not join comes back in `refused`, with the reason.
 */
export function fitRoute(
  events: Event[],
  s: ItinerarySettings,
): { route: Event[]; refused: { event: Event; compat: Compat }[] } {
  const route: Event[] = [];
  const refused: { event: Event; compat: Compat }[] = [];
  for (const e of sortRoute(events)) {
    if (route.some((r) => r.id === e.id)) continue;
    const compat = compatibility(route, e, s);
    if (isAddable(compat)) route.push(e);
    else refused.push({ event: e, compat });
  }
  return { route: sortRoute(route), refused };
}

const sameDates = (a: TripDates, b: TripDates): boolean => {
  if (a.depart !== b.depart || a.ret !== b.ret) return false;
  const ak = Object.keys(a.moves);
  return ak.length === Object.keys(b.moves).length && ak.every((k) => a.moves[k] === b.moves[k]);
};

const clampIndex = (i: number, length: number): number =>
  Number.isFinite(i) ? Math.min(Math.max(0, Math.trunc(i)), Math.max(0, length - 1)) : 0;

/** Same event, same day: a date anchored on it still means what it meant. */
const sameAnchor = (a: Event | undefined, b: Event | undefined): boolean =>
  !!a && !!b && a.id === b.id && eventDay(a) === eventDay(b);

/** Everything searched for the old trip goes. */
const cleared = { flight: null, hotels: {} } satisfies Pick<ItineraryState, "flight" | "hotels">;

/**
 * The state with a new route. Dates the customer set are kept while their anchor stays:
 * the departure while the first event is the same (same day), the return while the last
 * is, a move while its two events are still neighbours - then everything is clamped.
 */
function withRoute(state: ItineraryState, next: Event[]): ItineraryState {
  const route = sortRoute(next);
  const prev = state.route;
  let dates = EMPTY_DATES;
  if (route.length) {
    const def = defaultTripDates(route);
    const kept = Object.fromEntries(
      Object.keys(def.moves).flatMap((k) => (state.dates.moves[k] ? [[k, state.dates.moves[k]]] : [])),
    );
    dates = clampTripDates(route, {
      depart: sameAnchor(prev[0], route[0]) ? state.dates.depart : def.depart,
      ret: sameAnchor(prev[prev.length - 1], route[route.length - 1]) ? state.dates.ret : def.ret,
      moves: { ...def.moves, ...kept },
    });
  }
  const ids = new Set(route.map((e) => e.id));
  const moveKeys = new Set(moves(route).map((m) => m.key));
  return {
    ...state,
    ...cleared,
    route,
    dates,
    tickets: Object.fromEntries(Object.entries(state.tickets).filter(([id]) => ids.has(Number(id)))),
    train: state.train.filter((k) => moveKeys.has(k)),
    activeEvent: 0,
    activeStay: 0,
    step: route.length < MIN_TRIP_EVENTS ? "build" : state.step,
  };
}

/**
 * Where the trip goes and sleeps for this event: what its dates, stays and legs hang on. The
 * coordinates count too - moving a venue can make two neighbours one city (or two).
 */
const shapeOf = (e: Event): string => {
  const { point } = stayPoint(e);
  const at = eventPoint(e);
  return [
    eventDay(e),
    e.location?.city_iata ?? "",
    point.name,
    point.latitude,
    point.longitude,
    at.latitude,
    at.longitude,
  ].join("|");
};

export function itineraryReducer(state: ItineraryState, action: ItineraryAction): ItineraryState {
  switch (action.type) {
    case "load": {
      // A ready trip (every event fitted, two or more) opens straight on event 1's tickets, the
      // order flow's first step; the planner (custom) and anything shorter open on build.
      const ready = action.mode === "route" && action.route.length >= MIN_TRIP_EVENTS;
      const step: ItineraryStep = ready ? "tickets" : "build";
      return { ...withRoute({ ...state, route: [], step }, action.route), mode: action.mode };
    }

    case "addEvent": {
      if (state.route.some((e) => e.id === action.event.id)) return state;
      if (!isAddable(compatibility(state.route, action.event, action.settings))) return state;
      return withRoute(state, [...state.route, action.event]);
    }

    case "removeEvent":
      if (!state.route.some((e) => e.id === action.id)) return state;
      return withRoute(
        state,
        state.route.filter((e) => e.id !== action.id),
      );

    case "setMode":
      return state.mode === action.mode ? state : { ...state, mode: action.mode };

    case "setDates": {
      if (!state.route.length) return state;
      const dates = clampTripDates(state.route, action.dates);
      return sameDates(dates, state.dates) ? state : { ...state, ...cleared, dates };
    }

    case "setPax": {
      if (!Number.isFinite(action.pax)) return state;
      const pax = Math.min(MAX_TRAVELLERS, Math.max(1, Math.round(action.pax)));
      return pax === state.pax ? state : { ...state, ...cleared, pax };
    }

    case "setTicket":
      if (!state.route.some((e) => e.id === action.eventId)) return state;
      return { ...state, tickets: { ...state.tickets, [action.eventId]: action.ticket } };

    case "setEventData": {
      const old = state.route.find((e) => e.id === action.event.id);
      if (!old) return state;
      const route = state.route.map((e) => (e.id === action.event.id ? action.event : e));
      // Fresher data for the same trip (live prices): the picks stay.
      if (shapeOf(old) === shapeOf(action.event)) return { ...state, route };
      return withRoute(state, route);
    }

    case "toggleTrain": {
      if (!moves(state.route).some((m) => m.key === action.key)) return state;
      const train = state.train.includes(action.key)
        ? state.train.filter((k) => k !== action.key)
        : [...state.train, action.key];
      return { ...state, ...cleared, train, dates: clampTripDates(state.route, state.dates) };
    }

    case "setFlight": {
      if (state.flight === action.flight) return state;
      // No flight (a new search answer) leaves the hotels: there are no dates to judge them by.
      if (!action.flight) return { ...state, flight: null };
      // Another flight can move a stay's check-in by a day: a hotel goes once it is off its stay's nights.
      const hotels = hotelsForFlight(state.route, state.dates, new Set(state.train), state.hotels, action.flight);
      return { ...state, flight: action.flight, hotels };
    }

    case "setHotel":
      if (!stays(state.route, state.dates).some((s) => s.key === action.stayKey)) return state;
      return { ...state, hotels: { ...state.hotels, [action.stayKey]: action.hotel } };

    case "clearTravel":
      return !state.flight && !Object.keys(state.hotels).length ? state : { ...state, ...cleared };

    case "releaseHold":
      return !state.flight && !Object.keys(state.hotels).length && !Object.keys(state.tickets).length
        ? state
        : { ...state, ...cleared, tickets: {} };

    case "goStep":
      if (action.step !== "build" && state.route.length < MIN_TRIP_EVENTS) return state;
      return state.step === action.step ? state : { ...state, step: action.step };

    case "setActiveEvent": {
      const activeEvent = clampIndex(action.index, state.route.length);
      return activeEvent === state.activeEvent ? state : { ...state, activeEvent };
    }

    case "setActiveStay": {
      const activeStay = clampIndex(action.index, stays(state.route, state.dates).length);
      return activeStay === state.activeStay ? state : { ...state, activeStay };
    }
  }
}
