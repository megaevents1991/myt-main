import { describe, expect, it } from "vitest";
import type { Event, FlightSegment, ItineraryFlight } from "../app.types";
import {
  PAIR_SIDE_MAX,
  airlineLabel,
  directOnlyFlights,
  directOutcome,
  legAirlines,
  pairFlight,
  pairOneWays,
} from "../itinerary/directPairs";
import { MAIN_PART, composeFlight } from "../itinerary/flightParts";
import { isIsraeliFlight, pickBestFlight, pricedTickets, pricingOffers, searchKey } from "../itinerary/flightsView";

// Dor 09.11: "טיסות ישירות בלבד" on the way there and back - three non-stop searches, the one-ways paired.

/** A leg; `stopsAt` = the airports it touches after takeoff (the destination alone = direct). */
const seg = (from: string, to: string, day: string, num: string, stopsAt: string[] = [to]): FlightSegment => ({
  departureAirport: from,
  arrivalAirport: to,
  departureTime: `${day}T09:00:00`,
  arrivalTime: `${day}T14:00:00`,
  duration: "PT4H",
  stops: stopsAt.map((iataCode) => ({ iataCode, duration: null })),
  checkBagsIncluded: false,
  cabinBagsIncluded: true,
  flightNumber: num,
});

const fl = (id: string, price: number, legs: FlightSegment[], airline = "LY", name = "El Al", pax = 2): ItineraryFlight =>
  ({
    id,
    price,
    numOfTravelers: pax,
    airline,
    legs,
    outbound: legs[0],
    inbound: legs[legs.length - 1],
    trainLegs: [],
    metadata: { name, iata: airline, country: "", logo: "" },
    offer: { id: `offer-${id}` },
  }) as unknown as ItineraryFlight;

const OUT = "2027-05-10";
const HOME = "2027-05-16";
const out = (id: string, price: number, airline = "LY", name = "El Al") => fl(id, price, [seg("TLV", "DUS", OUT, `${airline}1${id}`)], airline, name);
const home = (id: string, price: number, airline = "W6", name = "Wizz Air") => fl(id, price, [seg("LTN", "TLV", HOME, `${airline}2${id}`)], airline, name);

describe("pairOneWays", () => {
  it("a direct way out and a direct way home make one round trip of two tickets", () => {
    const [p] = pairOneWays([out("1", 474.3)], [home("1", 666.25)], 2);
    expect(p.id).toBe("ow:1+1");
    expect(p.price).toBe(1140.55);
    expect(p.legs.map((l) => `${l.departureAirport}-${l.arrivalAirport}`)).toEqual(["TLV-DUS", "LTN-TLV"]);
    expect(p.outbound).toBe(p.legs[0]);
    expect(p.inbound).toBe(p.legs[1]);
    expect(p.stops).toBe(0);
    // The way out's card fields, both tickets kept with their own offer and price.
    expect(p.airline).toBe("LY");
    expect(p.oneWays?.map((t) => [t.airline, t.price, (t.offer as unknown as { id: string }).id])).toEqual([
      ["LY", 474.3, "offer-1"],
      ["W6", 666.25, "offer-1"],
    ]);
    // A ticket inside the pair carries no trip fields.
    expect(p.oneWays?.[0]).not.toHaveProperty("legs");
  });

  it("only one-leg direct flights for the party, the cheapest PAIR_SIDE_MAX of each way", () => {
    const stop = fl("s", 100, [seg("TLV", "DUS", OUT, "X1", ["FRA", "DUS"])]);
    const otherParty = fl("p", 100, [seg("TLV", "DUS", OUT, "X2")], "LY", "El Al", 3);
    const outs = [stop, otherParty, ...Array.from({ length: PAIR_SIDE_MAX + 3 }, (_, i) => out(String(i), 500 - i))];
    const pairs = pairOneWays(outs, [home("h", 300)], 2);
    expect(pairs).toHaveLength(PAIR_SIDE_MAX);
    expect(pairs.some((p) => p.id.includes(":s+") || p.id.includes(":p+"))).toBe(false);
    // The dearest three ways out were left out.
    expect(pairs.some((p) => p.id === "ow:0+h")).toBe(false);
  });
});

describe("directOnlyFlights", () => {
  it("lists the round trip's direct flights and the pairs, never a flight with a stop", () => {
    const direct = fl("rt1", 1300, [seg("TLV", "DUS", OUT, "LY1"), seg("LHR", "TLV", HOME, "LY2")]);
    const viaFra = fl("rt2", 900, [seg("TLV", "DUS", OUT, "LH1", ["FRA", "DUS"]), seg("LHR", "TLV", HOME, "LY2")]);
    const list = directOnlyFlights([direct, viaFra], [out("1", 474)], [home("1", 666)], 2);
    expect(list.map((f) => f.id)).toEqual(["rt1", "ow:1+1"]);
  });

  it("the same two flights on one ticket win a tie; a cheaper pair stays", () => {
    const a = out("1", 500);
    const b = home("1", 600);
    const same = fl("rt", 1100, [a.legs[0], b.legs[0]]);
    expect(directOnlyFlights([same], [a], [b], 2).map((f) => f.id)).toEqual(["rt"]);
    const dear = fl("rt", 1200, [a.legs[0], b.legs[0]]);
    expect(directOnlyFlights([dear], [a], [b], 2).map((f) => f.id)).toEqual(["rt", "ow:1+1"]);
  });

  it("a pair is the best flight when it is the cheapest direct one (fewest stops, then price)", () => {
    const list = directOnlyFlights([fl("rt", 1300, [seg("TLV", "DUS", OUT, "LY1"), seg("LHR", "TLV", HOME, "LY2")])], [out("1", 474)], [home("1", 666)], 2);
    expect(pickBestFlight(list)?.id).toBe("ow:1+1");
  });
});

describe("directOutcome", () => {
  const ok = (flights: ItineraryFlight[]) => ({ kind: "ok" as const, flights });
  const empty = { kind: "empty" as const };

  it("Düsseldorf out, London home (09.11): one ticket has nothing direct, the one-ways pair up", () => {
    const r = directOutcome(empty, ok([out("1", 474)]), ok([home("1", 666), home("2", 700)]), 2);
    expect(r.kind).toBe("ok");
    expect(r.kind === "ok" && r.flights.map((f) => f.id)).toEqual(["ow:1+1", "ow:1+2"]);
  });

  it("throttled anywhere is busy; no card is invalid, then error, then empty", () => {
    expect(directOutcome(ok([out("1", 1)]), { kind: "busy" }, empty, 2).kind).toBe("busy");
    expect(directOutcome(empty, { kind: "invalid" }, { kind: "error" }, 2).kind).toBe("invalid");
    expect(directOutcome({ kind: "error" }, empty, ok([home("1", 1)]), 2).kind).toBe("error");
    expect(directOutcome(empty, ok([out("1", 1)]), empty, 2).kind).toBe("empty");
  });

  it("a failed one-ticket search still leaves the pairs", () => {
    expect(directOutcome({ kind: "error" }, ok([out("1", 474)]), ok([home("1", 666)]), 2).kind).toBe("ok");
  });
});

describe("a pair through the step", () => {
  const pair = pairFlight(out("1", 474), home("1", 666));

  it("is priced as two tickets and sells only when both can", () => {
    expect(pricingOffers(pair).map((o) => (o as unknown as { id: string }).id)).toEqual(["offer-1", "offer-1"]);
    expect(pricingOffers(out("9", 1)).map((o) => (o as unknown as { id: string }).id)).toEqual(["offer-9"]);
    const both = pricedTickets(
      pair,
      [
        { status: 200, body: { penalties: "No refund" } },
        { status: 200, body: { penalties: "Change $50" } },
      ],
      [],
    );
    expect(both?.penalties).toBe("הלוך: No refund\nחזור: Change $50");
    expect(both?.price).toBe(pair.price);
    expect(pricedTickets(pair, [{ status: 200, body: {} }, { status: 500, body: null }], [])).toBeNull();
    expect(pricedTickets(pair, [], [])).toBeNull();
  });

  it("is Israeli only when both tickets are", () => {
    expect(isIsraeliFlight(pair)).toBe(false);
    expect(isIsraeliFlight(pairFlight(out("1", 474), home("1", 666, "LY", "El Al")))).toBe(true);
  });

  it("names both airlines, and every leg its own", () => {
    expect(airlineLabel(pair)).toBe("El Al · Wizz Air");
    expect(airlineLabel(out("1", 1))).toBe("El Al");
    expect(legAirlines(pair)).toEqual(["El Al", "Wizz Air"]);
  });

  it("a direct-only search is its own key", () => {
    const legs = [
      { from: "TLV", to: "DUS", date: OUT },
      { from: "LON", to: "TLV", date: HOME },
    ];
    expect(searchKey(legs, 2, true)).not.toBe(searchKey(legs, 2, false));
  });

  it("composed with a move, the trip keeps both tickets and every leg names its airline", () => {
    type City = { latitude: number; longitude: number; name: string; city_iata: string };
    const DUS: City = { latitude: 51.22, longitude: 6.77, name: "דיסלדורף, גרמניה", city_iata: "DUS" };
    const LON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון, בריטניה", city_iata: "LON" };
    const ev = (id: number, date: string, c: City) =>
      ({ id, name: `e${id}`, date: `${date}T20:00:00`, type: "music_event", location: { ...c, country_code: "XX" } }) as unknown as Event;
    const route = [ev(1, "2027-05-11", DUS), ev(2, "2027-05-15", LON)];
    const dates = { depart: OUT, ret: HOME, moves: { "1>2": "2027-05-13" } };
    const move = fl("m", 200, [seg("DUS", "LHR", "2027-05-13", "BA9")], "BA", "British Airways");
    const f = composeFlight(route, dates, new Set(), 2, { [MAIN_PART]: pair, "1>2": move });
    expect(f?.oneWays?.length).toBe(2);
    expect(f?.price).toBe(1340);
    expect(f && legAirlines(f)).toEqual(["El Al", "British Airways", "Wizz Air"]);
  });
});
