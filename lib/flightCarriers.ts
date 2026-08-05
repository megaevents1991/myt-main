import { Flight } from "./app.types";

/**
 * The carriers the "ישראלי" tab matches. LY El Al, 6H Israir, IZ Arkia, plus
 * the two foreign-registered carriers sold here as Israeli market inventory:
 * BZ Blue Bird Airways and U8 TUS Airways (the same group route.ts surcharges
 * as local low-cost).
 */
export const ISRAELI_AIRLINE_CODES: string[] = ["LY", "6H", "IZ", "BZ", "U8"];

/**
 * Validating carriers that are pure ticketing vehicles — never the airline on
 * the card. app/api/flights/search/route.ts relabels these offers after the
 * operating carrier of the first outbound segment: Hahn Air sells Blue Bird
 * as "HR" with `operating.carrierCode === "BZ"` (and some El Al inventory as
 * "HR"/operating "LY").
 */
const TICKETING_ONLY_CARRIERS = new Set(["HR"]);

/**
 * Every carrier code a flight may legitimately be matched against by an airline
 * filter — the codes behind the identity the card actually displays.
 *
 * `flight.airline` is the VALIDATING (ticketing) carrier. That is also the name
 * FlightCard shows, EXCEPT for ticketing-only carriers, where route.ts relabels
 * the card after the operating carrier — so only there does the operating
 * carrier speak for the flight. Matching the operating carrier unconditionally
 * let a foreign-validated codeshare riding Israeli metal out of TLV (card says
 * "IBERIA", first leg operated by LY) pass the "ישראלי" tab; matching the
 * validating carrier alone hid every Blue Bird flight from it. The filter must
 * agree with the airline the customer sees on the card.
 *
 * Only the carrier operating the FIRST OUTBOUND segment is considered — the
 * same signal route.ts uses for the relabelling.
 *
 * Offline (DB) flights carry an empty `offer`, so they fall back to
 * `flight.airline` on its own.
 */
export const getFlightCarrierCodes = (flight: Flight): string[] => {
  const codes: string[] = [];

  if (flight.airline) {
    codes.push(flight.airline);
  }

  // A real airline as validating carrier IS the card's identity — stop here.
  // Fall through only for ticketing-only carriers (or a missing code).
  if (flight.airline && !TICKETING_ONLY_CARRIERS.has(flight.airline)) {
    return codes;
  }

  const firstSegment = flight.offer?.itineraries?.[0]?.segments?.[0];
  const operatingCarrier =
    firstSegment?.operating?.carrierCode ?? firstSegment?.carrierCode;

  if (operatingCarrier && !codes.includes(operatingCarrier)) {
    codes.push(operatingCarrier);
  }

  return codes;
};
