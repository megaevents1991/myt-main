/**
 * "Build Your Euro Trip" - geography helpers. Pure: no I/O, no clock.
 * Distances are between STAY points (where the traveller sleeps), days are
 * `YYYY-MM-DD` strings and the day math is UTC so a DST change never moves one.
 */
import type { Event } from "@/lib/app.types";
import { isSportsEvent } from "@/lib/search";
import {
  lodgingLocation,
  offeredCities,
  type LodgingCity,
  type LodgingPoint,
} from "@/lib/events/lodging";

const EARTH_RADIUS_KM = 6371;
const MS_PER_DAY = 86_400_000;

/** Stay points within this distance count as the same city (spec §4). */
export const SAME_CITY_KM = 30;

/**
 * Two neighbours under one flight city, each sleeping where it is played, at most this far apart
 * share ONE hotel - the first one's (Dor 09.11: a Liverpool match and a Manchester match, 50 km,
 * "משאיר את הלינה איפה שהמשחק הראשון מבין השתיים"). London - Manchester (262 km) is two hotels.
 */
export const SHARED_STAY_KM = 80;

type LatLon = { latitude: number; longitude: number };

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in whole kilometres (haversine, R = 6371). */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** Where the event itself takes place: the event city when it has one, else the flight city. */
export function eventPoint(e: Event) {
  return e.event_location ?? e.location;
}

/**
 * Where the customer chose to sleep for this event on the hotels step (Alon 12.11, lib/itinerary/
 * stayChoice.ts): its own city or its flight city. Carried on the event itself, like a direct flight
 * (`event_location.trip_stay`), so every rule that reads the route - stays, moves, the ways on the
 * ground, the server's own rows - follows it. Absent = the trip's default.
 */
export type StayPick = LodgingCity;

export function stayPickOf(e: Event): StayPick | undefined {
  const at = e.event_location;
  if (!at || !("trip_stay" in at)) return undefined;
  return at.trip_stay === "event" || at.trip_stay === "flight" ? at.trip_stay : undefined;
}

/** The event with the customer's pick on it, or with none (`undefined`). Same object when nothing changes. */
export function withStayPick(e: Event, pick: StayPick | undefined): Event {
  if (stayPickOf(e) === pick || !e.event_location) return e;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the old pick is dropped on purpose
  const { trip_stay: _drop, ...place } = { trip_stay: undefined, ...e.event_location };
  // A field of the trip's own on the event's place (not in the shared `Event` type): set through a
  // variable, the way `flyDirect` adds `location.hub_iata`.
  const picked = { ...place, trip_stay: pick };
  return { ...e, event_location: pick ? picked : place };
}

/**
 * The city a TRIP sleeps in for this event: the customer's pick when the event offers it, else
 * where it is played whenever its hotel may be there (Dor 09.11 - London, Manchester, London is a
 * split: a Manchester match gets a Manchester hotel, a Liverpool match a Liverpool one), else its
 * flight city. Not the event's own package default (`defaultCity`): a single-event order still
 * opens on the flight city with a split on offer.
 */
export function tripStayCity(e: Event): LodgingCity {
  const offered = offeredCities(e);
  const pick = stayPickOf(e);
  if (pick && offered.includes(pick)) return pick;
  return offered.includes("event") ? "event" : "flight";
}

/** Where the traveller sleeps for this event on a trip (`tripStayCity`). */
export function stayPoint(e: Event): { point: LodgingPoint; city: LodgingCity } {
  const city = tripStayCity(e);
  return { point: lodgingLocation(e, city), city };
}

/** Two events share a city when their stay points are within 30 km. */
export function sameCity(a: Event, b: Event): boolean {
  return haversineKm(stayPoint(a).point, stayPoint(b).point) <= SAME_CITY_KM;
}

/**
 * `b` sleeps in `a`'s hotel: the same city (`sameCity`), or two sub-locations of one flight city
 * a short train apart (`SHARED_STAY_KM`: Liverpool and Manchester) - the stay is `a`'s, the first -
 * unless the customer chose where `b` sleeps (Alon 12.11: "ספליט מנצ'סטר / ליברפול").
 */
export function shareStay(a: Event, b: Event): boolean {
  if (sameCity(a, b)) return true;
  if (stayPickOf(b)) return false;
  const pa = stayPoint(a);
  const pb = stayPoint(b);
  return (
    sameHub(a, b) &&
    pa.city === "event" &&
    pb.city === "event" &&
    haversineKm(pa.point, pb.point) <= SHARED_STAY_KM
  );
}

/**
 * The two events are played in one city. Not the same as sleeping in one (`sameCity`): a Manchester
 * match slept in London shares a hotel with a London show, and still needs a train (Alon 01.11).
 */
export function sameEventCity(a: Event, b: Event): boolean {
  return haversineKm(eventPoint(a), eventPoint(b)) <= SAME_CITY_KM;
}

/**
 * The flight city the event is SOLD under (`location.city_iata`), also once a direct flight lands it
 * elsewhere: `flyDirect` keeps it as `location.hub_iata` (a Manchester match flown to MAN is still a
 * London-hub event, a train from a London show - Alon 12.11).
 */
export function hubIata(e: Event): string | undefined {
  const loc = e.location;
  if (!loc) return undefined;
  if ("hub_iata" in loc && typeof loc.hub_iata === "string" && loc.hub_iata) return loc.hub_iata;
  return loc.city_iata;
}

/**
 * One flight city (`hubIata`): a Manchester or Liverpool match sold as a flight to London is a
 * sub-location of London - a train away, no flight and no change of country between. Still so when
 * the customer flies to Manchester directly: the way on to London is the train.
 */
export function sameHub(a: Event, b: Event): boolean {
  const hub = hubIata(a);
  return !!hub && hub === hubIata(b);
}

/** The event's calendar day, `YYYY-MM-DD`. */
export function eventDay(e: Event): string {
  return e.date.slice(0, 10);
}

/** `b - a` in whole days (UTC) between two `YYYY-MM-DD` strings. */
export function dayDiff(a: string, b: string): number {
  const ms = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(b) - ms(a)) / MS_PER_DAY);
}

/**
 * The two kinds the trip builder tells apart (the picker's filter, the card's badge).
 * Uses the site's shared rule: `tx_event` is a mixed feed (football + concerts), so the
 * type alone is not enough - `isSportsEvent` reads the name too (lib/search.ts).
 */
export function eventKind(e: Event): "music" | "football" {
  return isSportsEvent(e) ? "football" : "music";
}
