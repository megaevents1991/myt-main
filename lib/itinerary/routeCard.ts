/**
 * "Build Your Euro Trip" - what a route card shows. Pure: no I/O, no clock.
 * Runs on the server: the page resolves the events and hands them in, and the client gets
 * plain data (no Event rows, no estimator), so the hub's bundle and its HTML stay small.
 * The hub's filters over the cards are in ./hubView.
 */
import type { Event } from "@/lib/app.types";
import { cityName, defaultCity, eventCityName } from "@/lib/events/lodging";
import { defaultTripDates, stays } from "./dates";
import { dayDiff, eventDay, eventKind } from "./geo";
import { estimateItinerary } from "./price";
import { sortRoute } from "./rules";
import type { ItinerarySettings } from "./settings";

export type RouteCardArt = {
  imageUrl: string | null;
  awayImageUrl: string | null;
  variant: "blob" | "photo";
  colorIndex?: number;
  shapeIndex?: number;
  imageScale?: number | null;
  bgScale?: number | null;
  imageOffsetX?: number | null;
  imageOffsetY?: number | null;
};

export type RouteCardData = {
  /** The events' ids in trip order - what `/euro-trip/build?events=` opens. */
  ids: number[];
  /** The stay cities joined " ← " ("פריז ← לונדון"). */
  title: string;
  events: { id: number; name: string; day: string; cityName: string; art: RouteCardArt }[];
  /** The stays' city names in trip order (a city named once while the trip stays in it). */
  cities: string[];
  /** Nights from the default departure to the default return. */
  nights: number;
  /** Hotels in the trip: one per run of events in one city. */
  stays: number;
  /** The estimate, USD per traveller, whole dollars. */
  perTraveller: number;
  /** Against buying every event as its own package; null below $50. */
  saving: number | null;
  /** Each kind once, in trip order. */
  kinds: ("music" | "football")[];
  /** The first event's day, `YYYY-MM-DD`. */
  firstDay: string;
};

/** The card art exactly as the homepage card picks it (components/ClientSideHomepage.tsx). */
function cardArt(e: Event): RouteCardArt {
  return {
    imageUrl: (e.match_away_logo_url ? e.match_home_logo_url : e.art_image_url || e.card_image_url) ?? null,
    awayImageUrl: e.match_away_logo_url ?? null,
    variant: e.art_image_url ? "blob" : "photo",
    colorIndex: e.art_color_index ?? undefined,
    shapeIndex: e.art_shape_index ?? undefined,
    imageScale: e.art_image_scale ?? null,
    bgScale: e.art_bg_scale ?? null,
    imageOffsetX: e.art_image_offset_x ?? null,
    imageOffsetY: e.art_image_offset_y ?? null,
  };
}

/** The card for a route: dates, stays and price from the trip's default dates, no flight quote. */
export function toRouteCard(route: Event[], s: ItinerarySettings): RouteCardData {
  const trip = sortRoute(route);
  const d = defaultTripDates(trip);
  const list = stays(trip, d);
  // A stay's city as the hotel step names it. Neighbouring stays always differ by place, but two
  // places may carry one name - the title then names the city once, not "לונדון ← לונדון".
  const cities = list
    .map((stay) => cityName(stay.events[0], defaultCity(stay.events[0])))
    .filter((name, i, all) => i === 0 || name !== all[i - 1]);
  const { perTraveller, saving } = estimateItinerary(trip, d, s, null);
  const kinds = [...new Set(trip.map(eventKind))];

  return {
    ids: trip.map((e) => e.id),
    title: cities.join(" ← "),
    events: trip.map((e) => ({
      id: e.id,
      name: e.name,
      day: eventDay(e),
      // Where the event itself is played (a Manchester match sold as a flight to London says Manchester).
      cityName: eventCityName(e),
      art: cardArt(e),
    })),
    cities,
    nights: trip.length ? dayDiff(d.depart, d.ret) : 0,
    stays: list.length,
    perTraveller,
    saving,
    kinds,
    firstDay: trip.length ? eventDay(trip[0]) : "",
  };
}
