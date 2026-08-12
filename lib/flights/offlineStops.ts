export type FlightStop = { iataCode: string; duration: number | null };

/**
 * Mirrors the Amadeus shape built in the search route: one entry per segment
 * arrival, so the final entry is always the destination and any earlier entry
 * is a layover carrying its duration in hours.
 */
export function buildOfflineStops(
  arrivalAirport: string,
  stopAirport: string | null,
  stopDurationHours: number | null,
): FlightStop[] {
  const destination: FlightStop = { iataCode: arrivalAirport, duration: null };
  if (!stopAirport) return [destination];
  return [{ iataCode: stopAirport, duration: stopDurationHours }, destination];
}

/**
 * Postgres renders `interval` as "HH:MM:SS" - the same assumption the route's
 * existing PTfunction makes. Returns hours to one decimal, or null when the
 * value is missing or unparseable (never NaN, which would break the UI).
 */
export function isoDurationToHours(
  value: string | null | undefined,
): number | null {
  if (!value) return null;
  const [hours, minutes] = String(value).split(":").map(Number);
  if (!Number.isFinite(hours)) return null;
  const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
  return Math.round((hours + safeMinutes / 60) * 10) / 10;
}
