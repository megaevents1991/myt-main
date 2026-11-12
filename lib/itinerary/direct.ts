/**
 * "Build Your Euro Trip" - flying straight to a sub-location (Alon 01.11: "האופצייה למעבר למנצסטר
 * ישירות"). A Manchester match is sold as a flight to London and a train from there. A trip may land
 * in Manchester instead: no stop in London, the hotel in Manchester, and - when it is the trip's last
 * event - home from Manchester.
 *
 * The customer's choice turns the event into an event under that airport (`flyDirect`), so stays,
 * legs, names and prices all follow from the one route, on the client and on the server alike. The
 * flown event keeps the flight city it is sold under (`location.hub_iata`, read by `sameHub`): next
 * to a London show the way between them is still the train (Alon 12.11). Pure.
 */
import type { Event } from "@/lib/app.types";
import { hasEventCity, shortPlace } from "@/lib/events/lodging";
import { hubIata, sameHub } from "./geo";
import { sortRoute } from "./rules";

/** An airport a sub-location is flown to: its code, and the city it is in. */
type Airport = { iata: string; name: string; latitude: number; longitude: number };

const MANCHESTER: Airport = { iata: "MAN", name: "מנצ'סטר, אנגליה", latitude: 53.4808, longitude: -2.2426 };

/**
 * The airport of each event city (`event_location` holds no IATA of its own). Liverpool lands in
 * Manchester (Alon 12.11: "ליברפול אין שדה - הנחיתה במנצסטר"; measured 11.11: no flight from Tel Aviv
 * reaches LPL). A city that is not here simply offers no direct flight.
 */
const EVENT_CITY_AIRPORTS: Record<string, Airport> = {
  "מנצ'סטר": MANCHESTER,
  "ליברפול": MANCHESTER,
};

/** The airport for the event's own city, when the event is sold as a flight to another. */
function airportOf(e: Event): Airport | null {
  if (!hasEventCity(e) || !e.event_location) return null;
  return EVENT_CITY_AIRPORTS[shortPlace(e.event_location.name).replace(/׳/g, "'")] ?? null;
}

/** That airport's code ("MAN"), or null. */
export function eventCityAirport(e: Event): string | null {
  return airportOf(e)?.iata ?? null;
}

/**
 * The city a direct flight lands in, for the switch ("לטוס ישר למנצ'סטר" - also on a Liverpool match),
 * or null when the event has none.
 */
export function directCityName(e: Event): string | null {
  const own = airportOf(e);
  if (own) return shortPlace(own.name);
  // Already flown: its flight city is the airport's.
  return isFlown(e) ? shortPlace(e.location.name) : null;
}

/** The event has been flown to directly (`flyDirect` marked it with the hub it is sold under). */
export function isFlown(e: Event): boolean {
  return !!e.location && "hub_iata" in e.location && !!e.location.hub_iata;
}

/**
 * May this event of the route be flown to directly? Its airport is known, and a flight reaches it on
 * at least one side: it opens the trip (the flight out), closes it (the flight home), or a neighbour
 * is under another flight city. Between two London shows there is no flight to move (Alon 12.11: next
 * to a London match the first or last event may still land in Manchester).
 */
export function canFlyDirect(route: Event[], e: Event): boolean {
  if (!eventCityAirport(e)) return false;
  const trip = sortRoute(route);
  const at = trip.findIndex((x) => x.id === e.id);
  if (at < 0) return false;
  if (at === 0 || at === trip.length - 1) return true;
  return [trip[at - 1], trip[at + 1]].some((n) => !sameHub(n, e));
}

/**
 * The event under its airport: flights land there. A match in the airport's own city (Manchester) is
 * then an event in that city, with its hotel there; one a train away (Liverpool, from MAN) keeps its
 * own city, so the trip still sleeps there and says the train from the airport (`eventGrounds`).
 */
export function flyDirect(e: Event): Event {
  const airport = airportOf(e);
  if (!airport || !e.event_location) return e;
  const hub_iata = hubIata(e) ?? e.location.city_iata;
  const sameCity = shortPlace(airport.name) === shortPlace(e.event_location.name);
  if (sameCity) {
    const { name, latitude, longitude } = e.event_location;
    const location = { ...e.location, name, latitude, longitude, city_iata: airport.iata, hub_iata };
    return { ...e, location, event_location: null, lodging_mode: "flight_city", lodging_default: "flight" };
  }
  const { name, latitude, longitude, iata } = airport;
  const location = { ...e.location, name, latitude, longitude, city_iata: iata, hub_iata };
  return { ...e, location };
}

/**
 * A fresher row of an event the customer flies to directly: the row's prices on the event's own
 * places. The live ticket step hands back the row it was given, already flown (`isFlown`), so its
 * places are taken from `origin`.
 */
export function directOrigin(origin: Event, fresh: Event): Event {
  if (!isFlown(fresh)) return fresh;
  const { location, event_location, lodging_mode, lodging_default } = origin;
  return { ...fresh, location, event_location, lodging_mode, lodging_default };
}

/** The route with the customer's direct flights applied; `null` when one of them cannot be flown. */
export function applyDirect(route: Event[], ids: readonly number[]): Event[] | null {
  if (!ids.length) return route;
  if (ids.some((id) => !route.some((e) => e.id === id && canFlyDirect(route, e)))) return null;
  return route.map((e) => (ids.includes(e.id) ? flyDirect(e) : e));
}
