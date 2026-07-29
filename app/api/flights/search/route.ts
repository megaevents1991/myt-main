import { NextResponse } from "next/server";
import {
  FlightSearchOptions,
  FlightSegment,
  Event,
  Flight,
} from "@/lib/app.types";
import { getAirlineByIata } from "aircodes";
import { amadeus } from "../amadeusClient";
import { getEvents } from "@/lib/eventsData";
import dayjs from "dayjs";
import { supabase } from "@/lib/supabase";
import { serialize } from 'tinyduration';
import { buildSeatQuota, hasSeatsForEvent } from "@/lib/flights/offlineSeatQuota";
import { buildOfflineStops, isoDurationToHours } from "@/lib/flights/offlineStops";
import { resolveLockedFlight } from "@/lib/flights/lockedFlight";
import { 
  trackServerSideEvent, 
  extractIpFromRequest, 
  extractUserAgentFromRequest 
} from "@/lib/gtmAnalytics";

// Type definition for Amadeus API error response
interface AmadeusError {
  response?: {
    result?: {
      errors?: Array<{
        status: number;
        code: number;
        title: string;
      }>;
    };
  };
}

// Helper function to retry Amadeus API calls with exponential backoff
// This specifically handles the "SYSTEM ERROR HAS OCCURRED" (status: 500, code: 141) error from Amadeus
async function retryAmadeusCall<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error: unknown) {
      // Check if this is the specific Amadeus system error we want to retry
      const amadeusError = error as AmadeusError;
      const isSystemError = amadeusError?.response?.result?.errors?.some(
        (err) => err.status === 500 && err.code === 141 && err.title === "SYSTEM ERROR HAS OCCURRED"
      );
      
      // If it's the last attempt or not a system error, throw the error
      if (attempt === maxRetries || !isSystemError) {
        throw error;
      }
      
      // Calculate delay with exponential backoff (1s, 2s, 4s, etc.)
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.warn(`Amadeus API system error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error("All retry attempts failed");
}

export const maxDuration = 30;
const currencyCode = "USD";
const MAX_STOP_DURATION_HOURS = 4;
const MAX_STOPS = 1; // Maximum allowed stops per journey

// A baggage allowance counts as "included" whether Amadeus expresses it as a
// piece count or as a weight — which form arrives depends entirely on the
// carrier. Reading `quantity` alone reported "no bag" for fares that plainly
// include one (Arkia's 8kg cabin bag, Cyprus Airways' 10kg, Emirates' 30kg
// checked), which both mislabelled the card and fed the client's luggage filter
// a false negative. `quantity: 0` still correctly means no bag.
const hasBagAllowance = (bag?: BagAllowance): boolean =>
  Boolean(bag && ((bag.quantity ?? 0) > 0 || (bag.weight ?? 0) > 0));

const PTfunction = (duration: string): string => {
  const parts = duration.split(":").map(Number);
  const hours = parts[0];
  const minutes = parts[1];

  const durationObject = {
    hours: hours,
    minutes: minutes,
  };
  return serialize(durationObject);
};

const transformDbFlightToFlight = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dbFlight: any,
  id: number,
  num_of_travelers: number,
  eventSeatQuota: Map<number, number>
): Flight | null => {
  // Not enough remaining inventory for this party size — hide the flight
  // entirely. Returning a placeholder ({}) here would propagate an invalid
  // Flight to the client and crash flight rendering. Returning null lets the
  // caller filter it out so the online flights still show.
  if (
    dbFlight.initial_quantity - dbFlight.consumed_quantity <
    num_of_travelers
  ) {
    return null;
  }
  // Hard cap: when this event has its own seat allocation on the flight, it may
  // not sell past it even if the flight still has unallocated seats.
  if (!hasSeatsForEvent(eventSeatQuota, dbFlight.id, num_of_travelers)) {
    return null;
  }
  return {
    offer: {} as Flight["offer"],
    id: (id + 1).toString(),
    numOfTravelers: num_of_travelers,
    price: parseFloat(dbFlight.price) * num_of_travelers,
    duration: PTfunction(dbFlight.duration),
    stops: Number(dbFlight.stops) || 0,
    airline: dbFlight.airline_code,
    outbound: {
      stops: buildOfflineStops(
        dbFlight.outbound_arrival_airport,
        dbFlight.outbound_stop_airport ?? null,
        isoDurationToHours(dbFlight.outbound_stop_duration)
      ),
      departureTime: dbFlight.outbound_departure_time,
      departureAirport: dbFlight.outbound_departure_airport,
      arrivalAirport: dbFlight.outbound_arrival_airport,
      arrivalTime: dbFlight.outbound_arrival_time,
      duration: PTfunction(dbFlight.outbound_duration),
      checkBagsIncluded: dbFlight.outbound_check_bags_included,
      cabinBagsIncluded: dbFlight.outbound_cabin_bags_included,
      checkedBagKg: dbFlight.checked_bag_kg ?? null,
      cabinBagKg: dbFlight.cabin_bag_kg ?? null,
      flightNumber: dbFlight.outbound_flight_number,
    },
    inbound: {
      stops: buildOfflineStops(
        dbFlight.inbound_arrival_airport,
        dbFlight.inbound_stop_airport ?? null,
        isoDurationToHours(dbFlight.inbound_stop_duration)
      ),
      departureTime: dbFlight.inbound_departure_time,
      departureAirport: dbFlight.inbound_departure_airport,
      arrivalAirport: dbFlight.inbound_arrival_airport,
      arrivalTime: dbFlight.inbound_arrival_time,
      duration: PTfunction(dbFlight.inbound_duration),
      checkBagsIncluded: dbFlight.inbound_check_bags_included,
      cabinBagsIncluded: dbFlight.inbound_cabin_bags_included,
      checkedBagKg: dbFlight.checked_bag_kg ?? null,
      cabinBagKg: dbFlight.cabin_bag_kg ?? null,
      flightNumber: dbFlight.inbound_flight_number,
    },
    metadata: {
      iata: dbFlight.metadata_iata,
      country: dbFlight.metadata_country,
      name: dbFlight.metadata_name,
      logo: dbFlight.metadata_logo,
    },
    isOffline: true,
    offlineId: dbFlight.id,
    offlineRawPrice: parseFloat(dbFlight.price),
  };
};

/**
 * Seats still sellable to THIS event, per flight. Empty map = no allocations,
 * so every flight falls back to the flight-level global check — the
 * pre-allocation behaviour, deliberately preserved.
 *
 * Both queries throw on error. The caller's try/catch turns that into "no
 * offline flights this search", which is the safe direction: a transient
 * database error must never let a sold-out block oversell.
 */
const getEventSeatQuota = async (eventId: number): Promise<Map<number, number>> => {
  const { data: allocations, error: allocError } = await supabase
    .from("flight_event_allocations")
    .select("flight_id, allocated_seats")
    .eq("event_id", eventId);
  if (allocError) throw allocError;
  if (!allocations || allocations.length === 0) return new Map();

  const { data: consumed, error: consumedError } = await supabase
    .from("flight_event_consumed")
    .select("flight_id, consumed_seats")
    .eq("event_id", eventId);
  if (consumedError) throw consumedError;

  return buildSeatQuota(allocations, consumed ?? []);
};

const getOfflineFlightsFromDB = async (
  eventId: number,
  depart_date: string,
  return_date: string,
  indexShift: number,
  num_of_travelers: number,
  lockedFlightId: number | null
): Promise<Flight[]> => {
  try {
    // Offline flights are explicitly assigned to events via `event_ids` in the
    // backoffice (same pattern as offline hotels). We must match on that link —
    // NOT on the arrival airport. The event stores a city/metro code (e.g.
    // "LON") while a flight row stores a specific airport (e.g. "LTN"), so an
    // airport `.eq` would silently drop every London flight.
    const eventSeatQuota = await getEventSeatQuota(eventId);

    let query = supabase
      .from("flights")
      .select("*")
      .contains("event_ids", [eventId])
      .eq("is_deleted", false)
      .gte("outbound_departure_time", `${depart_date}T00:00:00`)
      .lt("outbound_departure_time", `${depart_date}T23:59:59`)
      .gte("inbound_departure_time", `${return_date}T00:00:00`)
      .lt("inbound_departure_time", `${return_date}T23:59:59`);

    // A locked package narrows the result to its one flight. Every other check
    // above still applies — locking restricts, it never loosens.
    if (lockedFlightId) query = query.eq("id", lockedFlightId);

    const { data: flights, error } = await query;

    if (error) throw error;

    // Transform DB records to Flight objects
    return flights
      ? flights
          .map((flight, index) =>
            transformDbFlightToFlight(
              flight,
              index + indexShift,
              num_of_travelers,
              eventSeatQuota
            )
          )
          .filter((f): f is Flight => f !== null)
      : ([] as Flight[]);
  } catch (error) {
    console.error("DB flights static data retrieval error:", error);
    return [] as Flight[];
  }
};

export async function POST(request: Request) {
  if (!amadeus) {
    return NextResponse.json(
      {
        error:
          "Amadeus client is not initialized. Check your environment variables.",
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const eventId = parseInt(searchParams.get("eventId") || "", 10);

  if (!eventId) {
    return NextResponse.json(
      { error: "Event ID is required" },
      { status: 400 }
    );
  }

  const { events }: { events: Event[] } = await getEvents();

  const event = events.find((e) => e.id === eventId);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const {
      returnDate: returnDateFromUi,
      departureDate: departureDateFromUi,
      originLocationCode = "TLV",
      adults,
      nonStop,
      gtmIdnts,
    }: FlightSearchOptions = await request.json();

  // Track flight search analytics
  try {
    const ip = extractIpFromRequest(request);
    const userAgent = extractUserAgentFromRequest(request);
    
    await trackServerSideEvent({
      eventData: {
        id: event.id,
        name: event.name,
        value: 1500,
        currency: "USD",
        category: event.type || "music_event",
        brand: "Mega Events"
      },
      eventType: "add_to_cart",
      gtmIdnts,
      userAgent,
      ip,
    });
  } catch (analyticsError) {
    // Don't fail the main request if analytics fails
    console.warn("Analytics tracking failed for flight search:", analyticsError);
  }

  try {
    const departureDate = dayjs(departureDateFromUi).format("YYYY-MM-DD");
    const returnDate = dayjs(returnDateFromUi).format("YYYY-MM-DD");
    const debugDates = {
      departureDate: departureDateFromUi,
      returnDate: returnDateFromUi,
    };

    // LOCKFLIGHT — a locked package sells one offline flight and never queries
    // Amadeus. Resolved before the Amadeus call so a locked event never pays
    // for a search whose results it would throw away.
    const seatQuota = await getEventSeatQuota(event.id).catch((error) => {
      console.error("Failed to load offline seat allocations:", error);
      // Empty map = fall back to the flight-level global check, which is what
      // ran before allocations existed.
      return new Map<number, number>();
    });
    const lock = resolveLockedFlight(event.locked_flight_id, seatQuota, adults || 1);

    if (lock.mode === "sold_out") {
      // No Amadeus fallback by design: falling back would quietly re-price the
      // package and defeat the point of locking it.
      return NextResponse.json({
        flights: [],
        locked: true,
        lockedSoldOut: true,
        debug: debugDates,
      });
    }

    if (lock.mode === "locked") {
      const lockedFlights = await getOfflineFlightsFromDB(
        event.id,
        departureDate,
        returnDate,
        0,
        adults || 1,
        lock.flightId
      );
      return NextResponse.json({
        flights: lockedFlights,
        locked: true,
        // The flight can still vanish on the global inventory check or the date
        // window even when the allocation looks healthy. Nothing to sell = sold out.
        lockedSoldOut: lockedFlights.length === 0,
        debug: debugDates,
      });
    }

    // Amadeus per-request client reference (ama-Client-Ref) — required by the
    // production-certification checklist. Ties the call to the event + time.
    const clientRef = `MYT-${event.id}-${Math.floor(Date.now() / 1000)}`;

    const response = await retryAmadeusCall(() =>
      amadeus.shopping.flightOffersSearch.get(
        {
          originLocationCode,
          destinationLocationCode: event.location.city_iata,
          departureDate,
          returnDate,
          adults: adults || 1,
          max: 250,
          nonStop,
          currencyCode,
        },
        clientRef
      )
    );

    const flights = await getOfflineFlightsFromDB(
      event.id,
      departureDate,
      returnDate,
      0,
      adults || 1,
      null
    );

    const baseId = flights.length + 1;

    // Transform Amadeus response to match our flight data structure
    const moreFlights: Flight[] = (response.result.data as FlightOffer[]).reduce(
      (acc: Flight[], offer: FlightOffer) => {
        const { validatingAirlineCodes, price, itineraries, travelerPricings } =
          offer;
        // `aircodes` has gaps (unknown codes return undefined — "W6"/Wizz Air,
        // "X3"/TUIfly) and stubs (an empty `logo` — "GP"/APG Airlines). Neither
        // is a reason to throw away a bookable flight, and the old
        // `!airlineByIata.logo` guard did both: it dropped every APG-ticketed
        // offer, and on an unknown code it threw, which the outer catch turned
        // into a 500 for the WHOLE search. FlightCard already falls back to a
        // plane glyph when `metadata.logo` is empty.
        const airlineByIata = getAirlineByIata(validatingAirlineCodes[0]);

        // Filter flights with too many stops (early check)
        const outboundStops = itineraries[0].segments.length - 1;
        const inboundStops = itineraries[1].segments.length - 1;

        if (outboundStops > MAX_STOPS || inboundStops > MAX_STOPS) {
          return acc; // Skip flights with too many stops
        }

        const toDeparture = itineraries[0].segments[0];
        const toArrival = itineraries[0].segments.at(-1);
        const fromDeparture = itineraries[1].segments[0];
        const fromArrival = itineraries[1].segments.at(-1);

        // Calculate stops and durations early
        const toStops = itineraries[0].segments.map((segment, i) => ({
          iataCode: segment.arrival.iataCode,
          duration: Math.ceil(
            (new Date(
              itineraries[0].segments?.[i + 1]?.departure?.at
            ).getTime() -
              new Date(segment.arrival.at).getTime()) /
              1000 /
              60 /
              60
          ),
        }));

        const fromStops = itineraries[1].segments.map((segment, i) => ({
          iataCode: segment.arrival.iataCode,
          duration: Math.ceil(
            (new Date(
              itineraries[1].segments?.[i + 1]?.departure?.at
            ).getTime() -
              new Date(segment.arrival.at).getTime()) /
              1000 /
              60 /
              60
          ),
        }));

        const hasLongLayover =
          toStops.some((stop) => stop.duration > MAX_STOP_DURATION_HOURS) ||
          fromStops.some((stop) => stop.duration > MAX_STOP_DURATION_HOURS);

        // Skip flights with layovers longer than threshold
        if (hasLongLayover) {
          return acc;
        }

        const fromCheckBagsIncluded = itineraries[0].segments.every((segment) =>
          travelerPricings[0].fareDetailsBySegment.some(
            (fare) =>
              fare.segmentId === segment.id &&
              hasBagAllowance(fare.includedCheckedBags)
          )
        );
        const fromCabinBagsIncluded = itineraries[0].segments.every(
          (segment) => {
            return travelerPricings[0].fareDetailsBySegment.some((fare) => {
              return (
                fare.segmentId === segment.id &&
                hasBagAllowance(fare.includedCabinBags)
              );
            });
          }
        );

        const toCheckBagsIncluded = itineraries[1].segments.every((segment) => {
          return travelerPricings[0].fareDetailsBySegment.some((fare) => {
            return (
              fare.segmentId === segment.id &&
              hasBagAllowance(fare.includedCheckedBags)
            );
          });
        });

        const toCabinBagsIncluded = itineraries[1].segments.every((segment) => {
          return travelerPricings[0].fareDetailsBySegment.some((fare) => {
            return (
              fare.segmentId === segment.id &&
              hasBagAllowance(fare.includedCabinBags)
            );
          });
        });

        if (
          fromCabinBagsIncluded !== toCabinBagsIncluded ||
          fromCheckBagsIncluded !== toCheckBagsIncluded
        ) {
          return acc; // Skip flights with inconsistent baggage policies
        }

        const outbound: FlightSegment = {
          stops: toStops,
          departureTime: toDeparture.departure.at,
          departureAirport: toDeparture.departure.iataCode,
          arrivalAirport: toArrival?.arrival.iataCode || "",
          arrivalTime: toArrival?.arrival.at || "0",
          duration: itineraries[0].duration,
          checkBagsIncluded: fromCheckBagsIncluded,
          cabinBagsIncluded: fromCabinBagsIncluded,
          flightNumber:
            validatingAirlineCodes[0] + itineraries[0].segments[0].number,
        };

        const inbound: FlightSegment = {
          departureTime: fromDeparture.departure.at,
          departureAirport: fromDeparture.departure.iataCode,
          arrivalAirport: fromArrival?.arrival.iataCode || "",
          arrivalTime: fromArrival?.arrival.at || "0",
          stops: fromStops,
          duration: itineraries[1].duration,
          checkBagsIncluded: toCheckBagsIncluded,
          cabinBagsIncluded: toCabinBagsIncluded,
          flightNumber:
            validatingAirlineCodes[0] + itineraries[1].segments[0].number,
        };

        const currentFlightId = String(baseId + acc.length);
        acc.push({
          offer,
          id: currentFlightId,
          numOfTravelers: travelerPricings.length,
          price: parseFloat(price.grandTotal),
          duration: itineraries[0].duration,
          stops: itineraries[0].segments.length - 1,
          airline: validatingAirlineCodes[0],
          outbound,
          inbound,
          metadata: {
            // Built field-by-field rather than spread, so a carrier missing
            // from `aircodes` still yields a complete, renderable Airline.
            iata: airlineByIata?.iata ?? validatingAirlineCodes[0],
            country: airlineByIata?.country ?? "",
            logo: airlineByIata?.logo ?? "",
            name:
              response.result.dictionaries.carriers[
                validatingAirlineCodes[0]
              ] ??
              airlineByIata?.name ??
              validatingAirlineCodes[0],
          },
        });

        // Special Handling: Check and update logo for LUFTHANSA
        const currentFlight = acc[acc.length - 1];
        if (currentFlight.metadata.name === "LUFTHANSA") {
          currentFlight.metadata.logo =
            "https://www.avcodes.co.uk/images/logos/DLH.png";
        }
        // Special Handling: Check and update for Bluebird
        else if (currentFlight.metadata.iata === "HR") {
          if (currentFlight.offer.itineraries[0].segments[0].operating?.carrierCode === "BZ") {
            currentFlight.metadata.logo =
              "https://upload.wikimedia.org/wikipedia/fr/c/c2/Bluebird_Airways_logo.png";
              currentFlight.metadata.name = "Bluebird Airways";
              currentFlight.price = currentFlight.price + 45 * currentFlight.numOfTravelers;
          } else if (currentFlight.offer.itineraries[0].segments[0].operating?.carrierCode === "LY") {
            currentFlight.metadata.logo =
              "https://www.avcodes.co.uk/images/logos/ELY.png";
              currentFlight.metadata.name = "El Al";
          }
        }
        // Special Handling: For low-cost carriers
        else if (currentFlight.metadata.iata === "6H") {
          currentFlight.price = currentFlight.price + 45 * currentFlight.numOfTravelers;
        }
        else if (currentFlight.metadata.iata === "IZ") {
          currentFlight.price = currentFlight.price + 45 * currentFlight.numOfTravelers;
        }
        else if (currentFlight.metadata.iata === "U8") {
          currentFlight.price = currentFlight.price + 45 * currentFlight.numOfTravelers;
        }

        if (currentFlight.metadata.iata === "LY" && currentFlight.outbound.checkBagsIncluded === false && currentFlight.inbound.checkBagsIncluded === false) {
          const variantFlight: Flight = {
            ...currentFlight,
            id: String(baseId + acc.length),
            price: currentFlight.price + 150 * currentFlight.numOfTravelers,
            outbound: {
              ...currentFlight.outbound,
              checkBagsIncluded: true,
            },
            inbound: {
              ...currentFlight.inbound,
              checkBagsIncluded: true,
            },
            virtualOfferType: true,
          };
          acc.push(variantFlight);
        }
        

        return acc;
      },
      [] as Flight[]
    );

    flights.push(...moreFlights);

    return NextResponse.json({ flights, debug: debugDates });
  } catch (error) {
    console.error("Error fetching flights:", error);
    // Surface the actual Amadeus error detail (otherwise node prints `[Object]`)
    const amErr = (error as AmadeusError)?.response?.result?.errors;
    if (amErr) {
      console.error("Amadeus error detail:", JSON.stringify(amErr, null, 2));
    }
    return NextResponse.json(
      {
        error:
          "Failed to fetch flight data. Please check the server logs for more information.",
      },
      { status: 500 }
    );
  }
}
