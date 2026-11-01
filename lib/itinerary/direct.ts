/**
 * "Build Your Euro Trip" - flying straight to a sub-location (Alon 01.11: "האופצייה למעבר למנצסטר
 * ישירות"). A Manchester match is sold as a flight to London and a train from there. A trip that
 * reaches it from another country may land in Manchester instead: no stop in London, the hotel in
 * Manchester, and - when it is the trip's last event - home from Manchester.
 *
 * The customer's choice turns the event into an event in that city (`flyDirect`), so stays, legs,
 * names and prices all follow from the one route, on the client and on the server alike. Pure.
 */
import type { Event } from "@/lib/app.types";
import { hasEventCity, shortPlace } from "@/lib/events/lodging";
import { sameHub } from "./geo";
import { sortRoute } from "./rules";

/**
 * Airports of the event cities (`event_location` holds no IATA of its own). Every two-city event on
 * sale on 01.11.2026 is in Manchester; a city that is not here simply offers no direct flight.
 */
const EVENT_CITY_AIRPORTS: Record<string, string> = {
  "מנצ'סטר": "MAN",
  "ליברפול": "LPL",
};

/** The airport of the event's own city, when the event is sold as a flight to another. */
export function eventCityAirport(e: Event): string | null {
  if (!hasEventCity(e) || !e.event_location) return null;
  return EVENT_CITY_AIRPORTS[shortPlace(e.event_location.name).replace(/׳/g, "'")] ?? null;
}

/**
 * May this event of the route be flown to directly? Its airport is known, and neither neighbour
 * shares its flight city: next to a London show the way to Manchester is the train, not a flight.
 */
export function canFlyDirect(route: Event[], e: Event): boolean {
  if (!eventCityAirport(e)) return false;
  const trip = sortRoute(route);
  const at = trip.findIndex((x) => x.id === e.id);
  if (at < 0) return false;
  return ![trip[at - 1], trip[at + 1]].some((n) => !!n && sameHub(n, e));
}

/** The event as one in its own city: flights land there and the hotel is there. */
export function flyDirect(e: Event): Event {
  const airport = eventCityAirport(e);
  if (!airport || !e.event_location) return e;
  const { name, latitude, longitude } = e.event_location;
  return {
    ...e,
    location: { ...e.location, name, latitude, longitude, city_iata: airport },
    event_location: null,
    lodging_mode: "flight_city",
    lodging_default: "flight",
  };
}

/**
 * A fresher row of an event the customer flies to directly: the row's prices on the event's own
 * places. The live ticket step hands back the row it was given, already flown (no event city of its
 * own), so its places are taken from `origin`.
 */
export function directOrigin(origin: Event, fresh: Event): Event {
  if (hasEventCity(fresh)) return fresh;
  const { location, event_location, lodging_mode, lodging_default } = origin;
  return { ...fresh, location, event_location, lodging_mode, lodging_default };
}

/** The route with the customer's direct flights applied; `null` when one of them cannot be flown. */
export function applyDirect(route: Event[], ids: readonly number[]): Event[] | null {
  if (!ids.length) return route;
  if (ids.some((id) => !route.some((e) => e.id === id && canFlyDirect(route, e)))) return null;
  return route.map((e) => (ids.includes(e.id) ? flyDirect(e) : e));
}
