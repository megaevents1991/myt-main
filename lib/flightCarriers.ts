import { Flight } from "./app.types";

/**
 * Every carrier code a flight may legitimately be matched against by an airline
 * filter.
 *
 * `flight.airline` is the VALIDATING (ticketing) carrier, which is often not the
 * airline the customer actually flies. Blue Bird Airways sells through Hahn Air:
 * the offers come back validated as "HR" and marketed as "H1…" flight numbers,
 * with `operating.carrierCode === "BZ"`. Matching an airline filter against
 * `flight.airline` alone therefore hid every Blue Bird flight from the
 * Israeli-airlines tab, even though the card itself is relabelled "Bluebird
 * Airways" in app/api/flights/search/route.ts.
 *
 * Only the carrier operating the FIRST OUTBOUND segment is added — the same
 * signal route.ts already uses for that relabelling. Deliberately not every
 * segment's operator: a TLV→OTP→ATH itinerary flown out on TAROM that merely
 * returns on Arkia metal is not an "Israeli airline" flight.
 *
 * Offline (DB) flights carry an empty `offer`, so they fall back to
 * `flight.airline` on its own.
 */
export const getFlightCarrierCodes = (flight: Flight): string[] => {
  const codes: string[] = [];

  if (flight.airline) {
    codes.push(flight.airline);
  }

  const firstSegment = flight.offer?.itineraries?.[0]?.segments?.[0];
  const operatingCarrier =
    firstSegment?.operating?.carrierCode ?? firstSegment?.carrierCode;

  if (operatingCarrier && !codes.includes(operatingCarrier)) {
    codes.push(operatingCarrier);
  }

  return codes;
};
