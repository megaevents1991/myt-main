import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import { DEFAULT_ITINERARY_SETTINGS as S } from "../itinerary/settings";
import { toRouteCard } from "../itinerary/routeCard";

type City = { latitude: number; longitude: number; name: string; city_iata: string };

const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז, צרפת", city_iata: "PAR" };
const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון, בריטניה", city_iata: "LON" };
/** ~46 km from LONDON (Luton), but named London: another stay with the same city name. */
const LUTON_AS_LONDON: City = { latitude: 51.88, longitude: -0.42, name: "לונדון, בריטניה", city_iata: "LON" };
/** Another London venue (Wembley), ~12 km from LONDON: the same city, one stay. */
const WEMBLEY: City = { latitude: 51.556, longitude: -0.28, name: "לונדון, בריטניה", city_iata: "LON" };

/** A partial event: what the card reads. Markup through `markup_ticket` (composed pricing). */
const ev = (id: number, name: string, date: string, city: City, type: string, over: Record<string, unknown> = {}) =>
  ({
    id,
    name,
    date: `${date}T20:00:00`,
    type,
    location: { ...city, country_code: "XX" },
    markup_ticket: 175,
    card_image_url: `https://img.test/${id}.jpg`,
    ...over,
  }) as unknown as Event;

/**
 * Céline in Paris on 12.5, Chelsea in London on 15.5. Default trip: depart 11.5, Paris -> London
 * on 13.5, return 16.5 = 5 nights, 2 stays (Paris 2 nights, London 3).
 *
 *   tickets   150 + 200                          =  350
 *   flight    0.6 x (300 + 300)                  =  360
 *   hotel     Paris 300 / 2 x 2 + London 400 / 2 x 3 = 900
 *   markup    175 full + 122.5 (-30%)            =  297.5
 *   per traveller 1907.5 -> 1908; separate 925 + 1075 = 2000; saving 92
 */
const celine = ev(618, "סלין דיון", "2027-05-12", PARIS, "music_event", {
  art_image_url: "https://img.test/celine-cut.png",
  art_color_index: 2,
  art_shape_index: 1,
  art_image_scale: 1.1,
  art_bg_scale: null,
  art_image_offset_x: 4,
  art_image_offset_y: null,
  tickets_and_rates: [{ price: 150, available: true }],
  base_flight_price: 300,
  base_hotel_price: 300,
  def_date_depart: "2027-05-11",
  def_date_return: "2027-05-13",
});
const chelsea = ev(702, "צ'לסי - אברטון", "2027-05-15", LONDON, "sports_event", {
  match_home_logo_url: "https://img.test/chelsea.png",
  match_away_logo_url: "https://img.test/everton.png",
  tickets_and_rates: [{ price: 200, available: true }],
  base_flight_price: 300,
  base_hotel_price: 400,
  def_date_depart: "2027-05-14",
  def_date_return: "2027-05-16",
});
const wembley = ev(703, "קונצרט בוומבלי", "2027-05-17", WEMBLEY, "music_event", {
  tickets_and_rates: [{ price: 120, available: true }],
  base_flight_price: 100,
  base_hotel_price: 400,
});
/** Sold as a flight to London (default lodging there), played in Manchester. */
const manchesterMatch = ev(705, "מנצ'סטר יונייטד - ליברפול", "2027-05-15", LONDON, "sports_event", {
  event_location: { latitude: 53.48, longitude: -2.24, name: "מנצ'סטר", city_iata: "MAN", country_code: "GB" },
});

describe("toRouteCard", () => {
  it("[Céline, Chelsea]: Paris then London, 5 nights, 2 stays", () => {
    const card = toRouteCard([celine, chelsea], S);
    expect(card.ids).toEqual([618, 702]);
    expect(card.title).toBe("פריז ← לונדון");
    expect(card.cities).toEqual(["פריז", "לונדון"]);
    expect(card.nights).toBe(5);
    expect(card.stays).toBe(2);
    expect(card.firstDay).toBe("2027-05-12");
    expect(card.kinds).toEqual(["music", "football"]);
  });

  it("puts the events in trip order whatever order they arrive in", () => {
    expect(toRouteCard([chelsea, celine], S)).toEqual(toRouteCard([celine, chelsea], S));
  });

  it("each event: name, day and the city it is played in", () => {
    const card = toRouteCard([celine, chelsea], S);
    expect(card.events.map((e) => [e.id, e.name, e.day, e.cityName])).toEqual([
      [618, "סלין דיון", "2027-05-12", "פריז"],
      [702, "צ'לסי - אברטון", "2027-05-15", "לונדון"],
    ]);
  });

  it("art as the homepage card: a cut-out is a blob, a match is home crest + away crest", () => {
    const [c, m] = toRouteCard([celine, chelsea], S).events.map((e) => e.art);
    expect(c).toEqual({
      imageUrl: "https://img.test/celine-cut.png",
      awayImageUrl: null,
      variant: "blob",
      colorIndex: 2,
      shapeIndex: 1,
      imageScale: 1.1,
      bgScale: null,
      imageOffsetX: 4,
      imageOffsetY: null,
    });
    expect(m.imageUrl).toBe("https://img.test/chelsea.png");
    expect(m.awayImageUrl).toBe("https://img.test/everton.png");
    expect(m.variant).toBe("photo");
    expect(m.colorIndex).toBeUndefined();
  });

  it("an event with no cut-out and no match shows its card photo", () => {
    const art = toRouteCard([wembley], S).events[0].art;
    expect(art.imageUrl).toBe("https://img.test/703.jpg");
    expect(art.awayImageUrl).toBeNull();
    expect(art.variant).toBe("photo");
  });

  it("prices the trip with the estimator: per traveller and the saving", () => {
    const card = toRouteCard([celine, chelsea], S);
    expect(card.perTraveller).toBe(1908);
    expect(card.saving).toBe(92);
  });

  it("no saving below $50", () => {
    // No discount on the 2nd markup: 350 + 360 + 900 + 350 = 1960, 2000 - 1960 = 40
    const card = toRouteCard([celine, chelsea], { ...S, tier2Pct: 0 });
    expect(card.perTraveller).toBe(1960);
    expect(card.saving).toBeNull();
  });

  it("two events in one city: one stay, the city named once, both kinds in trip order", () => {
    const card = toRouteCard([wembley, chelsea], S);
    expect(card.title).toBe("לונדון");
    expect(card.cities).toEqual(["לונדון"]);
    expect(card.stays).toBe(1);
    expect(card.nights).toBe(4); // 14.5 -> 18.5
    expect(card.kinds).toEqual(["football", "music"]);
  });


  it("a kind is listed once", () => {
    expect(toRouteCard([celine, wembley], S).kinds).toEqual(["music"]);
  });

  it("two stays that carry one city name: two hotels, the city named once", () => {
    // Luton airport area, ~46 km from LONDON: not the same stay, but the location says London.
    const luton = ev(704, "קונצרט בלוטון", "2027-05-17", LUTON_AS_LONDON, "music_event");
    const card = toRouteCard([chelsea, luton], S);
    expect(card.stays).toBe(2);
    expect(card.cities).toEqual(["לונדון"]);
    expect(card.title).toBe("לונדון");
  });

  it("A -> B -> A: only neighbouring names collapse, the way back is named", () => {
    const parisAgain = ev(619, "סלין דיון", "2027-05-18", PARIS, "music_event");
    const card = toRouteCard([celine, chelsea, parisAgain], S);
    expect(card.stays).toBe(3);
    expect(card.cities).toEqual(["פריז", "לונדון", "פריז"]);
    expect(card.title).toBe("פריז ← לונדון ← פריז");
  });

  it("a Manchester match sold as a flight to London: played in Manchester, the stay is London", () => {
    const card = toRouteCard([celine, manchesterMatch], S);
    expect(card.events[1].cityName).toBe("מנצ'סטר");
    expect(card.cities).toEqual(["פריז", "לונדון"]);
  });
});
