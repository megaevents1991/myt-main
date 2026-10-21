/**
 * "Build Your Euro Trip" - the multi-city flight search, pure parts: the Amadeus request
 * body, the request validation, and the conversion of one multi-city offer (one itinerary
 * per leg of the trip) into an `ItineraryFlight`.
 *
 * `offerToItineraryFlight` MIRRORS the offer -> Flight conversion of the live search route
 * (`app/api/flights/search/route.ts`, the `.reduce` over `response.result.data`), with the
 * two itineraries of a round trip generalised to N. That route's conversion is inline and
 * stays untouched, so the rules are copied here, not imported. Change a rule there and
 * change it here. No I/O, no clock: the route file calls these.
 */
import { getAirlineByIata } from "aircodes";
import type { Airline } from "aircodes";
import type { FlightSegment, ItineraryFlight } from "@/lib/app.types";
import { addDays } from "./dates";

/** One Amadeus flight offer (the ambient `FlightOffer` of amadeus.d.ts). */
export type AmadeusOffer = FlightOffer;

type OfferSegment = AmadeusOffer["itineraries"][number]["segments"][number];

/** One flight of the trip: `from` / `to` are IATA codes, `date` is `YYYY-MM-DD`. */
export type FlightLeg = { from: string; to: string; date: string };

// Same limits as the live search route (app/api/flights/search/route.ts).
export const MAX_STOPS = 1; // per itinerary
export const MAX_STOP_DURATION_HOURS = 4;

/** Per traveler, added to the price of the carriers whose fare shows less than it costs
 *  (route.ts: HR operated by BZ, 6H, IZ, U8). */
const LOW_COST_SURCHARGE_USD = 45;
const LOW_COST_CARRIERS: ReadonlySet<string> = new Set(["6H", "IZ", "U8"]);

const MIN_LEGS = 2;
const MAX_LEGS = 4;
const MAX_ADULTS = 9; // = MAX_TICKETS of the ticket step

/** The Amadeus POST body of a multi-city search: one origin-destination per leg. */
export function multiCityBody(
  legs: FlightLeg[],
  adults: number,
  nonStop: boolean,
): Record<string, unknown> {
  return {
    currencyCode: "USD",
    originDestinations: legs.map((l, i) => ({
      id: String(i + 1),
      originLocationCode: l.from,
      destinationLocationCode: l.to,
      departureDateTimeRange: { date: l.date },
    })),
    travelers: Array.from({ length: adults }, (_, i) => ({
      id: String(i + 1),
      travelerType: "ADULT",
    })),
    sources: ["GDS"],
    searchCriteria: {
      maxFlightOffers: 250,
      ...(nonStop
        ? { flightFilters: { connectionRestriction: { maxNumberOfConnections: 0 } } }
        : {}),
    },
  };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const IATA_RE = /^[A-Z]{3}$/;

/** `YYYY-MM-DD` that is a day on the calendar ("2027-02-30" is not). */
function isRealDay(s: string): boolean {
  if (!DAY_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/**
 * Why a POST /api/itinerary/flights body is refused, or null when it is fine:
 * 2-4 legs, 1-9 adults, 3-letter upper-case codes, days from tomorrow on and never going
 * back. `todayIso` is today as `YYYY-MM-DD` (UTC) - the caller owns the clock.
 */
export function validateFlightRequest(body: unknown, todayIso: string): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return "Body must be a JSON object.";
  }
  const { legs, adults, nonStop } = body as Record<string, unknown>;

  if (!Array.isArray(legs) || legs.length < MIN_LEGS || legs.length > MAX_LEGS) {
    return `legs must be an array of ${MIN_LEGS} to ${MAX_LEGS} flights.`;
  }
  if (typeof adults !== "number" || !Number.isInteger(adults) || adults < 1 || adults > MAX_ADULTS) {
    return `adults must be a whole number from 1 to ${MAX_ADULTS}.`;
  }
  if (nonStop !== undefined && typeof nonStop !== "boolean") {
    return "nonStop must be true or false.";
  }

  const tomorrow = addDays(todayIso, 1);
  let previous = "";
  for (const [i, raw] of legs.entries()) {
    const n = i + 1;
    if (typeof raw !== "object" || raw === null) return `Leg ${n} must be an object.`;
    const { from, to, date } = raw as Record<string, unknown>;
    if (typeof from !== "string" || !IATA_RE.test(from)) {
      return `Leg ${n}: from must be a 3-letter upper-case IATA code.`;
    }
    if (typeof to !== "string" || !IATA_RE.test(to)) {
      return `Leg ${n}: to must be a 3-letter upper-case IATA code.`;
    }
    if (from === to) return `Leg ${n}: from and to are the same place.`;
    if (typeof date !== "string" || !isRealDay(date)) {
      return `Leg ${n}: date must be a real day as YYYY-MM-DD.`;
    }
    if (date < tomorrow) return `Leg ${n}: date must be tomorrow or later.`;
    if (date < previous) return `Leg ${n}: date is before the previous leg.`;
    previous = date;
  }
  return null;
}

// A baggage allowance counts as "included" whether Amadeus expresses it as a piece count
// or as a weight (route.ts hasBagAllowance). `quantity: 0` means no bag.
const hasBagAllowance = (bag?: BagAllowance): boolean =>
  Boolean(bag && ((bag.quantity ?? 0) > 0 || (bag.weight ?? 0) > 0));

/** Hours to the next segment after each one, rounded up (route.ts toStops / fromStops);
 *  the last segment has no next one, so no layover. */
const stopsOf = (segments: OfferSegment[]): FlightSegment["stops"] =>
  segments.map((segment, i) => {
    const next = segments[i + 1];
    const hours = next
      ? Math.ceil(
          (new Date(next.departure.at).getTime() - new Date(segment.arrival.at).getTime()) /
            1000 /
            60 /
            60,
        )
      : null;
    return { iataCode: segment.arrival.iataCode, duration: hours !== null && Number.isFinite(hours) ? hours : null };
  });

/**
 * One multi-city offer as an `ItineraryFlight`: `legs` = one segment per itinerary,
 * `outbound` = the first, `inbound` = the last (so every reader of a `Flight` keeps
 * working), `trainLegs` empty (the caller fills it). null when the offer breaks a rule of
 * the live flight step: an itinerary with more than `MAX_STOPS` stops, a layover over
 * `MAX_STOP_DURATION_HOURS`, a bag policy that differs between itineraries - or when it
 * cannot be read at all.
 *
 * `carriers` is the response's `dictionaries.carriers`; `adults` is the party the search
 * was made for.
 */
export function offerToItineraryFlight(
  offer: AmadeusOffer,
  id: string,
  adults: number,
  carriers: Record<string, string> = {},
): ItineraryFlight | null {
  const { validatingAirlineCodes, price, itineraries, travelerPricings } = offer;
  const validating = validatingAirlineCodes?.[0];
  if (!validating || !itineraries?.length || !travelerPricings?.length) return null;
  if (itineraries.some((it) => !it.segments?.length)) return null;

  // Too many stops (early check, as the route does).
  if (itineraries.some((it) => it.segments.length - 1 > MAX_STOPS)) return null;

  const stops = itineraries.map((it) => stopsOf(it.segments));
  const hasLongLayover = stops.some((list) =>
    list.some((stop) => stop.duration !== null && stop.duration > MAX_STOP_DURATION_HOURS),
  );
  if (hasLongLayover) return null;

  // A bag counts when every segment of the itinerary has a fare with one; the policy must
  // be the same on every itinerary of the offer.
  const fares = travelerPricings[0].fareDetailsBySegment ?? [];
  const bagsOf = (segments: OfferSegment[], pick: "includedCheckedBags" | "includedCabinBags") =>
    segments.every((segment) =>
      fares.some((fare) => fare.segmentId === segment.id && hasBagAllowance(fare[pick])),
    );
  const bags = itineraries.map((it) => ({
    check: bagsOf(it.segments, "includedCheckedBags"),
    cabin: bagsOf(it.segments, "includedCabinBags"),
  }));
  if (bags.some((b) => b.check !== bags[0].check || b.cabin !== bags[0].cabin)) return null;

  // Hahn Air (HR) sells other airlines' seats: the card shows who actually flies.
  const isHrBz = itineraries.some((it) => {
    const first = it.segments[0];
    return (
      (validating === "HR" || first.carrierCode === "HR") && first.operating?.carrierCode === "BZ"
    );
  });
  const hrOperator = itineraries[0].segments[0].operating?.carrierCode;

  // `aircodes` has gaps (unknown codes return null) and stubs (an empty `logo`): neither is
  // a reason to drop a bookable flight (route.ts).
  const airlineByIata = getAirlineByIata(validating);
  const metadata: Airline = {
    iata: airlineByIata?.iata ?? validating,
    country: airlineByIata?.country ?? "",
    logo: airlineByIata?.logo ?? "",
    name: carriers[validating] ?? airlineByIata?.name ?? validating,
  };
  if (metadata.name === "LUFTHANSA") {
    metadata.logo = "https://www.avcodes.co.uk/images/logos/DLH.png";
  } else if (metadata.iata === "HR") {
    if (isHrBz) {
      metadata.logo =
        "https://upload.wikimedia.org/wikipedia/fr/c/c2/Bluebird_Airways_logo.png";
      metadata.name = "Bluebird Airways";
    } else if (hrOperator === "LY") {
      metadata.logo = "https://www.avcodes.co.uk/images/logos/ELY.png";
      metadata.name = "El Al";
    }
  }

  // Once per ticket, not per itinerary: the validating carrier, or any carrier flying a
  // segment of it, is one of the low-cost ones.
  const onTicket = new Set([
    validating,
    ...itineraries.flatMap((it) => it.segments.map((s) => s.carrierCode)),
  ]);
  const surcharged = isHrBz || [...onTicket].some((code) => LOW_COST_CARRIERS.has(code));
  const total = parseFloat(price.grandTotal);
  if (!Number.isFinite(total)) return null;

  // Codeshare disclosure per leg: "operated by X" when the plane is not the card's
  // carrier's. For HR the card shows the operating carrier (route.ts).
  const displayedCarrier = metadata.iata === "HR" ? (hrOperator ?? "HR") : validating;
  const operatedByLabel = (segment: OfferSegment): string | undefined => {
    // Amadeus omits `operating` when it equals the marketing carrier.
    const operating = segment.operating?.carrierCode ?? segment.carrierCode;
    if (!operating || operating === displayedCarrier) return undefined;
    return getAirlineByIata(operating)?.name ?? carriers[operating] ?? operating;
  };

  const legs: FlightSegment[] = itineraries.map((it, i) => {
    const first = it.segments[0];
    const last = it.segments.at(-1);
    return {
      stops: stops[i],
      departureTime: first.departure.at,
      departureAirport: first.departure.iataCode,
      arrivalAirport: last?.arrival.iataCode || "",
      arrivalTime: last?.arrival.at || "0",
      duration: it.duration,
      checkBagsIncluded: bags[i].check,
      cabinBagsIncluded: bags[i].cabin,
      flightNumber: validating + first.number,
      operatedBy: operatedByLabel(first),
    };
  });

  return {
    offer,
    id,
    numOfTravelers: travelerPricings.length,
    price: total + (surcharged ? LOW_COST_SURCHARGE_USD * adults : 0),
    duration: itineraries[0].duration,
    stops: itineraries[0].segments.length - 1,
    airline: validating,
    outbound: legs[0],
    inbound: legs[legs.length - 1],
    metadata,
    legs,
    trainLegs: [],
  };
}
