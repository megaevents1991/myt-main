/**
 * "Build Your Euro Trip" - the hotels step's search and default pick for ONE stay (one city,
 * one hotel). Pure but for `fetchHotels`, which is injectable: no React, no context, no clock.
 *
 * The live split stay (`app/order/HotelSelection.tsx`) searches a segment, picks its default
 * hotel and turns the pick into an `OrderHotel` in closures that are not exported - they read
 * the order's event and the step's refs. A stay of the trip has none of that, so this module
 * does the same four things from plain arguments, with the live rules:
 *
 *   - `searchStayHotels`  = `searchSegment`: two tries, a pause between them, "answered" is
 *                           the live `searchAnswered` (an empty city is an answer, a failure
 *                           is not).
 *   - `pickDefaultHotel`  = `autoPickSegments`' pick: the cheapest 3-5 star "Hotel" with a
 *                           room without breakfast, else the first hotel the API listed that
 *                           has static info and a rate.
 *   - `buildStayHotel`    = `buildSegmentHotel`.
 *   - `withStayHotelExtras` = `withBreakfastOffer` + `withCardInfo`: the in-session fields the
 *                           card draws (photos, distance, pin) and the breakfast upsell.
 *
 * `findBreakfastUpgrade` is the live function (imported, never copied); only the thin wrappers
 * above are re-written. The caller adds `city` to the search (`lodgingLocation`), the room
 * packing (`getRoomParams`) and the cache; a search is spent only on the hotels step (RateHawk
 * takes 10 a minute for the whole account).
 */
import type { HotelsData } from "@/app/hooks/HotelFetch.provider";
import { fetchHotels, type FetchHotelsParams } from "@/app/order/fetchHotels";
import { findBreakfastUpgrade } from "@/app/order/order-review.utils";
import type { OrderHotel, SegmentCardInfo } from "@/lib/app.types";
import type { LodgingCity } from "@/lib/events/lodging";
import { applyFiltersAndSorting } from "@/lib/hotelFilter";
import type { Hotel, Rate } from "@/lib/hotel.type";
import { rateRoomName } from "@/lib/hotels/roomName";

/** How many photos a stay card draws (the live split stay's cap). */
const CARD_IMAGES = 12;
/** The pause before the second try - the live `SEGMENT_RETRY_MS`; a 429 names a window of up to 27 s. */
const RETRY_MS = 8000;
const TRIES = 2;

/**
 * The search got a real answer: a hotel list, and - when it has hotels - their static info
 * (the info call can fail on its own with `{ error }`). A city with NO hotels is an answer
 * too; "no hotels" must not be told apart from "the supplier is busy" by retrying.
 */
export function isAnsweredSearch(res: HotelsData): boolean {
  const hotels = res?.data?.data?.hotels;
  if (!Array.isArray(hotels)) return false;
  if (!hotels.length) return true;
  return !!res.hotelsInfo && !("error" in res.hotelsInfo);
}

/**
 * The hotel a stay opens on. The live default filter - 3-5 stars, kind "Hotel", at least one
 * room WITHOUT breakfast (the breakfast upsell sells the other), any cancellation, any
 * distance, cheapest first - and when nothing passes it, the first hotel the API listed that
 * has static info and a rate. Its rates are narrowed to the ones the filter kept, so
 * `rates[0]` is the room the stay opens on. Null = nothing the card could draw.
 */
export function pickDefaultHotel(search: HotelsData): Hotel | null {
  const hotelsInfo = search?.hotelsInfo ?? {};
  // `applyFiltersAndSorting` reads `rates[0]` of every hotel: one without a rate would throw.
  const all = (search?.data?.data?.hotels ?? []).filter((h) => h.rates?.length);
  const preferred = applyFiltersAndSorting({
    hotels: all,
    priceRange: [0, Number.MAX_SAFE_INTEGER],
    rating: [false, false, true, true, true],
    hotelsInfo,
    meal: ["withoutMeal"],
    kind: ["Hotel"],
    freeCancellation: ["withFreeCancellation", "withoutFreeCancellation"],
    distanceFromCenter: [0, Number.MAX_SAFE_INTEGER],
  });
  return [...preferred, ...all].find((h) => hotelsInfo[h.id] && h.rates?.length) ?? null;
}

/**
 * The in-session fields a stay's card needs, from the search the hotel came from: the same
 * room's breakfast rate (`breakfast_offer`, null when there is none - or when the search is not
 * for this hotel's dates and party, which `findBreakfastUpgrade` checks) and `segment_card`
 * (the room's photos before the hotel's, distance, guest score, pin; null without metadata).
 * Both are stripped before the order is saved.
 */
export function withStayHotelExtras(h: OrderHotel, search: HotelsData): OrderHotel {
  const upgrade = findBreakfastUpgrade(h, search);
  const withOffer: OrderHotel = {
    ...h,
    breakfast_offer: upgrade ? { rate: upgrade.rate, delta_usd: upgrade.deltaUsd } : null,
  };

  const info = search?.hotelsInfo?.[h.id];
  if (!info?.metadata) return { ...withOffer, segment_card: null };

  const card: SegmentCardInfo = {
    // The hotel info files a room's photos under `main_name` + `bedding_type` - the order's
    // room name (`rateRoomName`).
    images: [...(info.rooms?.[rateRoomName(h.rate)]?.images ?? []), ...(info.general?.images ?? [])]
      .filter(Boolean)
      .slice(0, CARD_IMAGES),
    distance: Math.ceil(info.metadata.distanceFromCenter ?? 0),
    guestRating: info.metadata.guestRating,
    lat: info.metadata.latitude,
    lng: info.metadata.longitude,
  };
  return { ...withOffer, segment_card: card };
}

/**
 * A picked hotel as the order keeps it: the live `buildSegmentHotel`. The price is the rate's
 * `show_amount` for ALL guests; dates and guests are the search's own request (what the
 * supplier priced), `cityLabel` is the name the card prints ("פראג").
 */
export function buildStayHotel(a: {
  city: LodgingCity;
  cityLabel: string;
  search: HotelsData;
  hotel: Hotel;
  rate?: Rate;
}): OrderHotel {
  const { city, cityLabel, search, hotel } = a;
  const rate = a.rate ?? hotel.rates[0];
  const info = search.hotelsInfo[hotel.id];
  const request = search.data.debug.request;
  const picked: OrderHotel = {
    address: info?.metadata?.address,
    guests: request.guests,
    id: hotel.id,
    name: info?.metadata?.hotelName,
    hotelInformation: {
      hotelName: info?.metadata?.hotelName,
      // The rate's own room, never another room of the hotel (reservation 2233 - lib/hotels/roomName.ts).
      roomName: rate?.room_data_trans?.main_name || "",
      stars: info?.metadata?.rating,
      amenities: info?.general?.amenities,
      distance: info?.metadata?.distanceFromCenter,
    },
    price: rate.payment_options?.payment_types[0]?.show_amount,
    rate,
    checkin: request.checkin,
    checkout: request.checkout,
    city,
    cityName: cityLabel,
  };
  return withStayHotelExtras(picked, search);
}

/** The stay's search failed twice (or was stopped): not the same as a city with no hotels. */
export class StaySearchFailed extends Error {
  constructor() {
    super("stay hotel search failed");
    this.name = "StaySearchFailed";
  }
}

/** Waits `ms`, or less when the signal aborts (no timer left behind a closed step). */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const done = () => {
      if (timer) clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });
}

/**
 * One stay's hotel search: up to two tries, `retryMs` (8 s) apart, and the first ANSWERED result
 * wins (`isAnsweredSearch`). A failed try - a thrown fetch, a 429 that came back as JSON, hotels
 * without info - is retried once; after that, or once the signal aborts, it throws
 * `StaySearchFailed`. One search is two requests (`/api/hotels` + `/api/hotels-info`); the
 * caller runs stays one after another, never side by side.
 */
export async function searchStayHotels(
  params: FetchHotelsParams,
  signal: AbortSignal,
  opts: {
    retryMs?: number;
    fetcher?: (p: FetchHotelsParams, s: AbortSignal) => Promise<HotelsData>;
  } = {}
): Promise<HotelsData> {
  const retryMs = opts.retryMs ?? RETRY_MS;
  const fetcher = opts.fetcher ?? fetchHotels;
  for (let attempt = 0; attempt < TRIES; attempt++) {
    if (attempt) await pause(retryMs, signal);
    if (signal.aborted) break;
    let res: HotelsData | null = null;
    try {
      res = await fetcher(params, signal);
    } catch {
      res = null; // a failed try - retried once below
    }
    if (res && isAnsweredSearch(res)) return res;
  }
  throw new StaySearchFailed();
}
