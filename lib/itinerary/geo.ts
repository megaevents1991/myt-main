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
 * The city a TRIP sleeps in for this event: where it is played whenever its hotel may be there
 * (Dor 09.11 - London, Manchester, London is a split: a Manchester match gets a Manchester hotel,
 * a Liverpool match a Liverpool one), else its flight city. Not the event's own package default
 * (`defaultCity`): a single-event order still opens on the flight city with a split on offer.
 */
export function tripStayCity(e: Event): LodgingCity {
  return offeredCities(e).includes("event") ? "event" : "flight";
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
 * a short train apart (`SHARED_STAY_KM`: Liverpool and Manchester) - the stay is `a`'s, the first.
 */
export function shareStay(a: Event, b: Event): boolean {
  if (sameCity(a, b)) return true;
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
 * One flight city (`location.city_iata`): a Manchester or Liverpool match sold as a flight to
 * London is a sub-location of London - a train away, no flight and no change of country between.
 */
export function sameHub(a: Event, b: Event): boolean {
  const hub = a.location?.city_iata;
  return !!hub && hub === b.location?.city_iata;
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
