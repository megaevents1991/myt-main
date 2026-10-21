import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import {
  computePackagePrice,
  isEventSoldOut,
  isTicketOnlyEvent,
} from "../events/price";
import { placeLabel } from "../events/lodging";
import { defaultTripDates, stays } from "../itinerary/dates";
import { eventKind } from "../itinerary/geo";
import { estimateItinerary } from "../itinerary/price";
import { toRouteCard } from "../itinerary/routeCard";
import { compatibility } from "../itinerary/rules";
import { DEFAULT_ITINERARY_SETTINGS as S } from "../itinerary/settings";
import { slimTripEvent } from "../itinerary/slim";

const PARIS = {
  latitude: 48.86,
  longitude: 2.35,
  name: "פריז, צרפת",
  city_iata: "PAR",
  country_code: "FR",
};
const LONDON = {
  latitude: 51.5,
  longitude: -0.13,
  name: "לונדון, בריטניה",
  city_iata: "LON",
  country_code: "GB",
};
const MANCHESTER = {
  latitude: 53.48,
  longitude: -2.24,
  name: "מנצ'סטר",
  country_code: "GB",
};

/** What a catalog row carries beyond what the builder reads (descriptions, maps, campaigns). */
const heavy = {
  description: "x".repeat(400),
  map_image_url: "https://example.com/map.svg",
  campaign_image_url: "https://example.com/c.png",
  campaign_banner_url: "https://example.com/b.png",
  tx_excluded_sections: ["101", "102", "103"],
  created_at: "2026-01-01T00:00:00Z",
  usual_price: 999,
  is_prioritized: false,
  is_deleted: null,
  light_package: "green",
};

const tickets = [
  {
    id: "a",
    category: "Upper",
    description: "",
    colorOnTheMap: "#000",
    price: 150,
    available: false,
  }, // cheaper but off sale
  {
    id: "b",
    category: "Lower",
    description: "long text ".repeat(20),
    colorOnTheMap: "#111",
    price: 210,
  },
  {
    id: "c",
    category: "Floor",
    description: "",
    colorOnTheMap: "#222",
    price: 320,
    available: true,
  },
];

const base = (over: Record<string, unknown>) =>
  ({
    ...heavy,
    tickets_and_rates: tickets,
    base_flight_price: 400,
    base_hotel_price: 300,
    def_date_depart: "2027-05-11",
    def_date_return: "2027-05-13",
    tags: "",
    art_image_url: null,
    card_image_url: "https://example.com/card.jpg",
    ...over,
  }) as unknown as Event;

/** Legacy markup, a music event in Paris. */
const celine = base({
  id: 618,
  name: "סלין דיון",
  name_english: "Celine Dion",
  type: "music_event",
  date: "2027-05-12T20:00:00",
  location: PARIS,
  art_image_url: "https://example.com/celine.png",
  art_color_index: 2,
  art_shape_index: 4,
});
/** Composed markups + an extra markup, a sports event. */
const chelsea = base({
  id: 702,
  name: "צ'לסי - אברטון",
  name_english: "Chelsea vs Everton",
  type: "sports_event",
  date: "2027-05-15T17:30:00",
  location: LONDON,
  markup_ticket: 60,
  markup_flight: 40,
  markup_hotel: 30,
  event_additional_markup: 25,
  match_home_logo_url: "https://example.com/che.png",
  match_away_logo_url: "https://example.com/eve.png",
});
/** A two-city event sleeping in the event city, sold as a tx_event (football by its English name). */
const united = base({
  id: 977,
  name: "מנצ'סטר יונייטד - ליברפול",
  name_english: "Manchester United vs Liverpool",
  type: "tx_event",
  date: "2027-05-17T15:00:00",
  location: LONDON,
  event_location: MANCHESTER,
  lodging_mode: "event_city_only",
  lodging_default: "event",
});
/** A ready package on `live`: the card costs the package's price. */
const ready = base({
  id: 880,
  name: "פיבי ברידג'רס",
  name_english: "Phoebe Bridgers",
  type: "tx_event",
  date: "2027-05-14T20:00:00",
  location: LONDON,
  ready_package_token: "tok",
  ready_package_mode: "live",
  ready_package_price_usd: 1999.4,
});

const all = [celine, chelsea, united, ready];
const slim = (list: Event[]) => list.map(slimTripEvent);

describe("slimTripEvent", () => {
  it("keeps only the cheapest ticket on sale and drops what the builder never reads", () => {
    const s = slimTripEvent(celine) as unknown as Record<string, unknown>;
    expect(s.tickets_and_rates).toEqual([
      { id: "b", category: "Lower", price: 210 },
    ]);
    for (const k of Object.keys(heavy)) expect(s).not.toHaveProperty(k);
    expect(JSON.stringify(s).length).toBeLessThan(
      JSON.stringify(celine).length / 2,
    );
  });

  it("an event with nothing on sale keeps no ticket (still sold out)", () => {
    const off = base({ ...celine, tickets_and_rates: [{ ...tickets[0] }] });
    expect(slimTripEvent(off).tickets_and_rates).toEqual([]);
    expect(isEventSoldOut(slimTripEvent(off))).toBe(isEventSoldOut(off));
  });

  it.each(all.map((e) => [e.id, e] as const))(
    "event %s prices, kinds and places the same slim or full",
    (_id, e) => {
      const s = slimTripEvent(e);
      expect(computePackagePrice(s)).toBe(computePackagePrice(e));
      expect(eventKind(s)).toBe(eventKind(e));
      expect(placeLabel(s)).toBe(placeLabel(e));
      expect(isTicketOnlyEvent(s)).toBe(isTicketOnlyEvent(e));
      expect(isEventSoldOut(s)).toBe(isEventSoldOut(e));
    },
  );

  it("a trip estimates, fits, stays and draws the same slim or full", () => {
    const route = [celine, chelsea, united];
    const d = defaultTripDates(route);
    expect(estimateItinerary(slim(route), d, S, null)).toEqual(
      estimateItinerary(route, d, S, null),
    );
    expect(estimateItinerary(slim(route), d, S, 450)).toEqual(
      estimateItinerary(route, d, S, 450),
    );
    expect(
      stays(slim(route), d).map((x) => [
        x.key,
        x.city,
        x.point.name,
        x.from,
        x.to,
      ]),
    ).toEqual(
      stays(route, d).map((x) => [x.key, x.city, x.point.name, x.from, x.to]),
    );
    expect(
      compatibility(slim([celine, chelsea]), slimTripEvent(ready), S),
    ).toEqual(compatibility([celine, chelsea], ready, S));
    expect(compatibility(slim([celine]), slimTripEvent(united), S)).toEqual(
      compatibility([celine], united, S),
    );
    expect(toRouteCard(slim(route), S)).toEqual(toRouteCard(route, S));
    expect(toRouteCard(slim([chelsea, ready]), S)).toEqual(
      toRouteCard([chelsea, ready], S),
    );
  });
});
