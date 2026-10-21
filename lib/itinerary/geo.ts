/**
 * "Build Your Euro Trip" - geography helpers. Pure: no I/O, no clock.
 * Distances are between STAY points (where the traveller sleeps), days are
 * `YYYY-MM-DD` strings and the day math is UTC so a DST change never moves one.
 */
import type { Event } from "@/lib/app.types";
import {
  defaultCity,
  lodgingLocation,
  type LodgingCity,
  type LodgingPoint,
} from "@/lib/events/lodging";

const EARTH_RADIUS_KM = 6371;
const MS_PER_DAY = 86_400_000;

/** Stay points within this distance count as the same city (spec §4). */
export const SAME_CITY_KM = 30;

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

/** Where the traveller sleeps by default: the hotel step's opening city for this event. */
export function stayPoint(e: Event): { point: LodgingPoint; city: LodgingCity } {
  const city = defaultCity(e);
  return { point: lodgingLocation(e, city), city };
}

/** Two events share a city when their stay points are within 30 km. */
export function sameCity(a: Event, b: Event): boolean {
  return haversineKm(stayPoint(a).point, stayPoint(b).point) <= SAME_CITY_KM;
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

/** The two kinds the trip builder tells apart (the picker's filter, the card's badge). */
export function eventKind(e: Event): "music" | "football" {
  return e.type.includes("music") ? "music" : "football";
}
