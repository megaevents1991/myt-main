import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import { computePackagePrice } from "../events/price";
import { DEFAULT_ITINERARY_SETTINGS as S } from "../itinerary/settings";
import { defaultTripDates } from "../itinerary/dates";
import { estimateItinerary, markupDiscount, nightlyHotelBase, tierMarkups } from "../itinerary/price";

type City = { latitude: number; longitude: number; name: string; city_iata: string };

const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז, צרפת", city_iata: "PAR" };
const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון, בריטניה", city_iata: "LON" };
/** Another London venue (Wembley), ~12 km from LONDON: the same city, one stay. */
const WEMBLEY: City = { latitude: 51.556, longitude: -0.28, name: "לונדון, בריטניה", city_iata: "LON" };

/**
 * A partial event: only what the prices read. The markup is set through `markup_ticket`
 * (composed pricing), so the test never depends on NEXT_PUBLIC_MARKUP being set or not.
 */
const ev = (id: number, date: string, city: City, over: Record<string, unknown> = {}) =>
  ({
    id,
    name: `event ${id}`,
    date: `${date}T20:00:00`,
    type: "music_event",
    location: { ...city, country_code: "XX" },
    markup_ticket: 175,
    tickets_and_rates: [{ price: 100, available: true }],
    base_flight_price: 0,
    base_hotel_price: 0,
    ...over,
  }) as unknown as Event;

/** Three events with markups 175 / 250 / 175, on three days (a < b < c). */
const a = ev(1, "2027-05-12", PARIS, { markup_ticket: 175 });
const b = ev(2, "2027-05-15", LONDON, { markup_ticket: 250 });
const c = ev(3, "2027-05-17", WEMBLEY, { markup_ticket: 175 });

describe("tierMarkups", () => {
  it("a pair at 175 / 175: the first full, the second 30% off", () => {
    const m = tierMarkups([a, c], S);
    expect(m.get(1)).toBe(175);
    expect(m.get(3)).toBe(122.5);
    expect(m.size).toBe(2);
  });

  it("175 / 250 / 175: the highest markup is full, then 122.5, then 87.5", () => {
    const m = tierMarkups([a, b, c], S);
    expect(m.get(2)).toBe(250); // the highest markup, though it is the middle date
    expect(m.get(1)).toBe(122.5); // tie at 175: the earlier date comes first (-30%)
    expect(m.get(3)).toBe(87.5); // the later one gets the second discount (-50%)
  });

  it("a tie goes to the earlier date whatever the order of the array", () => {
    const m = tierMarkups([c, a], S);
    expect(m.get(1)).toBe(175);
    expect(m.get(3)).toBe(122.5);
  });

  it("follows the settings' percentages", () => {
    const m = tierMarkups([a, b, c], { ...S, tier2Pct: 20, tier3Pct: 40 });
    expect(m.get(2)).toBe(250);
    expect(m.get(1)).toBe(140);
    expect(m.get(3)).toBe(105);
  });

  it("a fractional percentage carries no float error", () => {
    // 100 x (100 - 12.5) / 100 = 87.5 and 100 x (100 - 37.5) / 100 = 62.5, exactly
    const x = ev(51, "2027-05-12", PARIS, { markup_ticket: 100 });
    const y = ev(52, "2027-05-15", LONDON, { markup_ticket: 100 });
    const z = ev(53, "2027-05-17", WEMBLEY, { markup_ticket: 100 });
    const m = tierMarkups([x, y, z], { ...S, tier2Pct: 12.5, tier3Pct: 37.5 });
    expect([m.get(51), m.get(52), m.get(53)]).toEqual([100, 87.5, 62.5]);
  });

  it("rounds each value to cents", () => {
    const x = ev(11, "2027-05-12", PARIS, { markup_ticket: 100.01 });
    const y = ev(12, "2027-05-15", LONDON, { markup_ticket: 100.01 });
    const m = tierMarkups([x, y], S);
    expect(m.get(11)).toBe(100.01);
    expect(m.get(12)).toBe(70.01); // 100.01 x 0.7 = 70.007
  });

  it("reads getTotalMarkup: composed markups and the event's additional markup count", () => {
    const x = ev(21, "2027-05-12", PARIS, {
      markup_ticket: 100,
      markup_flight: 50,
      markup_hotel: null,
      event_additional_markup: 25,
    });
    expect(tierMarkups([x], S).get(21)).toBe(175);
  });

  it("a single event is full price; an empty route is an empty map", () => {
    expect(tierMarkups([b], S).get(2)).toBe(250);
    expect(tierMarkups([], S).size).toBe(0);
  });
});

describe("markupDiscount", () => {
  it("the pair at 175 / 175 saves 52.5", () => {
    expect(markupDiscount([a, c], S)).toBe(52.5);
  });

  it("175 / 250 / 175 saves 600 - 460 = 140", () => {
    expect(markupDiscount([a, b, c], S)).toBe(140);
  });

  it("a single event and an empty route save nothing", () => {
    expect(markupDiscount([a], S)).toBe(0);
    expect(markupDiscount([], S)).toBe(0);
  });

  it("is rounded to cents", () => {
    const x = ev(11, "2027-05-12", PARIS, { markup_ticket: 100.01 });
    const y = ev(12, "2027-05-15", LONDON, { markup_ticket: 100.01 });
    expect(markupDiscount([x, y], S)).toBe(30);
  });
});

/**
 * Paris (12.5) + London (15.5) + Wembley (17.5): London and Wembley are one stay.
 * Default trip dates: depart 11.5, Paris -> London on 13.5, return 18.5 =
 * Paris 2 nights, London 5 nights.
 *
 *   tickets   150 + 80 + 120                                  =  350
 *   flight    0.6 x (200 + 100 + 100)                         =  240   (fallback)
 *   hotel     Paris   300 / 3 nights x 2 nights               =  200
 *             London  480 / 4 nights x 5 nights               =  600   (Wembley's 400 is not used)
 *                                                               =  800
 *   markup    London 250 full, Paris 122.5, Wembley 87.5      =  460
 *   per traveller                                              = 1850
 *   separate  (200+300+150+175) + (100+480+80+250) + (100+400+120+175)
 *             = 825 + 910 + 795                                = 2530
 *   saving    2530 - 1850                                      =  680
 */
const paris = ev(618, "2027-05-12", PARIS, {
  markup_ticket: 175,
  tickets_and_rates: [
    { price: 400, available: true },
    { price: 150, available: true },
    { price: 50, available: false }, // not on sale: never the cheapest
  ],
  base_flight_price: 200,
  base_hotel_price: 300,
  // ISO timestamps are cut to the day: 11.5 -> 14.5 = 3 nights
  def_date_depart: "2027-05-11T00:00:00",
  def_date_return: "2027-05-14T00:00:00",
});
const chelsea = ev(702, "2027-05-15", LONDON, {
  markup_ticket: 250,
  tickets_and_rates: [{ price: 80, available: true }],
  base_flight_price: 100,
  base_hotel_price: 480,
  def_date_depart: "2027-05-14",
  def_date_return: "2027-05-18", // 4 nights
});
const wembley = ev(703, "2027-05-17", WEMBLEY, {
  markup_ticket: 175,
  tickets_and_rates: [{ price: 120, available: true }],
  base_flight_price: 100,
  base_hotel_price: 400,
  def_date_depart: "2027-05-16",
  def_date_return: "2027-05-18",
});
const trip = [paris, chelsea, wembley];
const dates = defaultTripDates(trip);

describe("estimateItinerary", () => {
  it("the fixture is the trip the numbers above assume", () => {
    expect(dates.depart).toBe("2027-05-11");
    expect(dates.ret).toBe("2027-05-18");
    expect(dates.moves).toEqual({ "618>702": "2027-05-13" });
    expect(computePackagePrice(paris)).toBe(825);
    expect(computePackagePrice(chelsea)).toBe(910);
    expect(computePackagePrice(wembley)).toBe(795);
  });

  it("sums tickets, a fallback flight, the hotel per stay and the tiered markups", () => {
    const r = estimateItinerary(trip, dates, S, null);
    expect(r.perTraveller).toBe(1850);
    expect(r.separate).toBe(2530);
    expect(r.saving).toBe(680);
  });

  it("an estimated flight replaces the 60% fallback", () => {
    // 350 + 500 + 800 + 460 = 2110; 2530 - 2110 = 420
    const r = estimateItinerary(trip, dates, S, 500);
    expect(r.perTraveller).toBe(2110);
    expect(r.separate).toBe(2530);
    expect(r.saving).toBe(420);
  });

  it("the saving is shown from $50 up and hidden below it", () => {
    // per traveller = 350 + flight + 800 + 460 = 1610 + flight; separate 2530
    expect(estimateItinerary(trip, dates, S, 870).saving).toBe(50); // 2480 -> 50
    expect(estimateItinerary(trip, dates, S, 871).saving).toBeNull(); // 2481 -> 49
    expect(estimateItinerary(trip, dates, S, 5000).saving).toBeNull(); // dearer than separate
  });

  it("an event with no date range of its own prices its hotel as one night", () => {
    const noDates = ev(618, "2027-05-12", PARIS, {
      markup_ticket: 175,
      tickets_and_rates: [{ price: 150, available: true }],
      base_flight_price: 200,
      base_hotel_price: 300,
      def_date_depart: undefined,
      def_date_return: "",
    });
    // One stay: depart 11.5 -> return 13.5 = 2 nights x (300 / 1) = 600
    const r = estimateItinerary([noDates], defaultTripDates([noDates]), S, 0);
    expect(r.perTraveller).toBe(150 + 0 + 600 + 175);
  });

  it("a non-finite flight quote is no quote: NaN / Infinity price like null", () => {
    const fallback = estimateItinerary(trip, dates, S, null);
    expect(estimateItinerary(trip, dates, S, Number.NaN)).toEqual(fallback);
    expect(estimateItinerary(trip, dates, S, Number.POSITIVE_INFINITY)).toEqual(fallback);
    expect(estimateItinerary(trip, dates, S, Number.NEGATIVE_INFINITY)).toEqual(fallback);
    expect(fallback.perTraveller).toBe(1850);
  });

  it("a single event shows no saving even when separate - perTraveller is $50 or more", () => {
    const one = ev(41, "2027-05-12", PARIS, {
      markup_ticket: 175,
      tickets_and_rates: [{ price: 100, available: true }],
      base_flight_price: 200,
      base_hotel_price: 300,
      def_date_depart: "2027-05-11",
      def_date_return: "2027-05-13", // 2 nights = the trip's default stay
    });
    // 100 + 0.6 x 200 + 300 / 2 x 2 + 175 = 695; separate 200 + 300 + 100 + 175 = 775: a diff of 80
    const r = estimateItinerary([one], defaultTripDates([one]), S, null);
    expect(r.perTraveller).toBe(695);
    expect(r.separate).toBe(775);
    expect(r.separate - r.perTraveller).toBeGreaterThanOrEqual(50);
    expect(r.saving).toBeNull();
  });

  it("rounds to whole dollars, and a single event never shows a saving", () => {
    const solo = ev(31, "2027-05-12", PARIS, {
      markup_ticket: 175,
      tickets_and_rates: [{ price: 50, available: true }],
      base_flight_price: 101,
      base_hotel_price: 100,
      def_date_depart: "2027-05-11",
      def_date_return: "2027-05-12", // 1 night
    });
    // 50 + 0.6 x 101 + (100 x 2 nights) + 175 = 485.6 -> 486; separate 101 + 100 + 50 + 175 = 426
    const r = estimateItinerary([solo], defaultTripDates([solo]), S, null);
    expect(r.perTraveller).toBe(486);
    expect(r.separate).toBe(426);
    expect(r.saving).toBeNull();
  });

  it("a draft without trip dates has no hotel yet, and never a NaN price", () => {
    // 350 tickets + 240 flight + 0 hotel + 460 markup
    const r = estimateItinerary(trip, { depart: "", ret: "", moves: {} }, S, null);
    expect(r.perTraveller).toBe(1050);
    expect(r.saving).toBe(1480);
  });

  it("an empty route is all zeros", () => {
    const r = estimateItinerary([], { depart: "", ret: "", moves: {} }, S, null);
    expect(r).toEqual({ perTraveller: 0, separate: 0, saving: null });
  });
});

describe("nightlyHotelBase", () => {
  it("is the package's base hotel price over the nights that package assumes", () => {
    expect(nightlyHotelBase(ev(9, "2027-05-12", PARIS, { base_hotel_price: 600, def_date_depart: "2027-05-10", def_date_return: "2027-05-14" }))).toBe(150);
  });

  it("a package without its dates counts one night; a missing or broken price counts 0", () => {
    expect(nightlyHotelBase(ev(9, "2027-05-12", PARIS, { base_hotel_price: 420 }))).toBe(420);
    expect(nightlyHotelBase(ev(9, "2027-05-12", PARIS, { base_hotel_price: null }))).toBe(0);
    expect(nightlyHotelBase(ev(9, "2027-05-12", PARIS, { base_hotel_price: "x" }))).toBe(0);
  });
});
