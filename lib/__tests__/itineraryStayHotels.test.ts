import { describe, expect, it } from "vitest";
import type { HotelsData } from "@/app/hooks/HotelFetch.provider";
import type { FetchHotelsParams } from "@/app/order/fetchHotels";
import type { OrderHotel } from "../app.types";
import type { Hotel, HotelInfoClient, HotelKind, Rate } from "../hotel.type";
import {
  StaySearchFailed,
  buildStayHotel,
  isAnsweredSearch,
  pickDefaultHotel,
  searchStayHotels,
  withStayHotelExtras,
} from "../itinerary/stayHotels";

const GUESTS = [{ adults: 2, children: [] as number[] }];
const REQUEST = { checkin: "2026-10-10", checkout: "2026-10-13", guests: GUESTS };

/** One rate: price, optional breakfast, room name + bed (the card's image key). */
const rate = (
  price: number,
  o: { breakfast?: boolean; main?: string; bed?: string; hash?: string } = {}
): Rate =>
  ({
    match_hash: o.hash ?? `r-${price}-${o.breakfast ? "b" : "n"}`,
    rg_ext: { class: 3, bedding: 2 },
    room_data_trans: { main_name: o.main ?? "Double Room", bedding_type: o.bed ?? "double bed" },
    meal_data: {
      has_breakfast: !!o.breakfast,
      no_child_meal: false,
      value: o.breakfast ? "breakfast" : "nomeal",
    },
    payment_options: {
      payment_types: [
        {
          show_amount: String(price),
          type: "now",
          cancellation_penalties: { policies: [], free_cancellation_before: "2026-10-01T10:00:00" },
        },
      ],
    },
  }) as unknown as Rate;

const hotel = (id: string, rates: Rate[]): Hotel => ({ id, hid: 1, rates });

const info = (
  id: string,
  o: {
    stars?: number;
    kind?: HotelKind;
    distance?: number;
    name?: string;
    rooms?: Record<string, string[]>;
    general?: string[];
    guestRating?: number;
    noMetadata?: boolean;
  } = {}
): HotelInfoClient =>
  ({
    rooms: Object.fromEntries(
      Object.entries(o.rooms ?? {}).map(([k, images]) => [k, { name: k, images, amenities: [] }])
    ),
    general: { name: "", images: o.general ?? [], amenities: ["wifi"] },
    metadata: o.noMetadata
      ? undefined
      : {
          hid: 1,
          hotelName: o.name ?? `Hotel ${id}`,
          address: `${id} Main St`,
          rating: o.stars ?? 4,
          kind: o.kind ?? "Hotel",
          id,
          latitude: 50.08,
          longitude: 14.43,
          distanceFromCenter: o.distance ?? 500,
          guestRating: o.guestRating,
        },
  }) as unknown as HotelInfoClient;

const searchOf = (hotels: Hotel[], infos: Record<string, HotelInfoClient>): HotelsData =>
  ({
    data: {
      data: { hotels, total_hotels: hotels.length },
      debug: { request: REQUEST },
      status: "ok",
      error: null,
    },
    hotelsInfo: infos,
  }) as unknown as HotelsData;

describe("isAnsweredSearch", () => {
  it("is true for a search with hotels and static info", () => {
    const s = searchOf([hotel("a", [rate(100)])], { a: info("a") });
    expect(isAnsweredSearch(s)).toBe(true);
  });

  it("is true for an empty hotel list (the city really has none)", () => {
    expect(isAnsweredSearch(searchOf([], {}))).toBe(true);
  });

  it("is false when the hotel list is missing (a failed answer)", () => {
    const s = { data: { error: "boom" }, hotelsInfo: {} } as unknown as HotelsData;
    expect(isAnsweredSearch(s)).toBe(false);
  });

  it("is false when there are hotels but the info call failed", () => {
    const bad = searchOf([hotel("a", [rate(100)])], { error: "x" } as unknown as Record<string, HotelInfoClient>);
    expect(isAnsweredSearch(bad)).toBe(false);
    const missing = { ...searchOf([hotel("a", [rate(100)])], {}), hotelsInfo: undefined } as unknown as HotelsData;
    expect(isAnsweredSearch(missing)).toBe(false);
  });
});

describe("pickDefaultHotel", () => {
  it("takes the cheapest 3-5 star hotel (a cheaper 2-star and a cheaper Hostel are skipped)", () => {
    const s = searchOf(
      [
        hotel("lux", [rate(300)]),
        hotel("two", [rate(40)]),
        hotel("hostel", [rate(45)]),
        hotel("ok", [rate(80)]),
        hotel("mid", [rate(120)]),
      ],
      {
        lux: info("lux", { stars: 5 }),
        two: info("two", { stars: 2 }),
        hostel: info("hostel", { stars: 4, kind: "Hostel" }),
        ok: info("ok", { stars: 4 }),
        mid: info("mid", { stars: 3 }),
      }
    );
    expect(pickDefaultHotel(s)?.id).toBe("ok");
  });

  it("picks a room without breakfast: the hotel's rates are narrowed to those", () => {
    const s = searchOf([hotel("ok", [rate(70, { breakfast: true }), rate(80), rate(95)])], { ok: info("ok") });
    const picked = pickDefaultHotel(s);
    expect(picked?.rates.every((r) => !r.meal_data.has_breakfast)).toBe(true);
    expect(picked?.rates[0].payment_options.payment_types[0].show_amount).toBe("80");
  });

  it("falls back to the first hotel with info and rates when no 3-5 star Hotel exists", () => {
    const s = searchOf(
      [
        hotel("noinfo", [rate(10)]),
        hotel("first", [rate(90)]),
        hotel("cheaper", [rate(50)]),
      ],
      {
        first: info("first", { stars: 2 }),
        cheaper: info("cheaper", { stars: 2 }),
      }
    );
    expect(pickDefaultHotel(s)?.id).toBe("first");
  });

  it("falls back when the only 3-5 star hotels sell breakfast alone", () => {
    const s = searchOf([hotel("b", [rate(100, { breakfast: true })])], { b: info("b", { stars: 4 }) });
    expect(pickDefaultHotel(s)?.id).toBe("b");
  });

  it("returns null with no usable hotel", () => {
    expect(pickDefaultHotel(searchOf([], {}))).toBeNull();
    // Hotels the info call did not describe cannot be drawn.
    expect(pickDefaultHotel(searchOf([hotel("x", [rate(100)])], {}))).toBeNull();
    // A hotel left with no rate is not a pick (and must not break the filter).
    expect(pickDefaultHotel(searchOf([hotel("y", [])], { y: info("y") }))).toBeNull();
  });

  it("does not trip on a rate-less hotel next to a good one", () => {
    const s = searchOf([hotel("empty", []), hotel("good", [rate(100)])], {
      empty: info("empty"),
      good: info("good"),
    });
    expect(pickDefaultHotel(s)?.id).toBe("good");
  });
});

describe("buildStayHotel", () => {
  const s = searchOf([hotel("h1", [rate(120.5), rate(150, { main: "Suite", bed: "king bed", hash: "suite" })])], {
    h1: info("h1", { stars: 4, name: "Hotel Lux", distance: 850 }),
  });
  const h1 = s.data.data.hotels[0];

  it("copies the rate price, the request's dates and guests, and the city label", () => {
    const built = buildStayHotel({ city: "event", cityLabel: "פראג", search: s, hotel: h1 });
    expect(built.price).toBe("120.5");
    expect(built.rate).toBe(h1.rates[0]);
    expect(built.checkin).toBe("2026-10-10");
    expect(built.checkout).toBe("2026-10-13");
    expect(built.guests).toBe(GUESTS);
    expect(built.city).toBe("event");
    expect(built.cityName).toBe("פראג");
    expect(built.id).toBe("h1");
    expect(built.name).toBe("Hotel Lux");
    expect(built.address).toBe("h1 Main St");
    expect(built.hotelInformation).toEqual({
      hotelName: "Hotel Lux",
      roomName: "Double Room",
      stars: 4,
      amenities: ["wifi"],
      distance: 850,
    });
  });

  it("uses the rate given instead of the hotel's first one", () => {
    const built = buildStayHotel({ city: "flight", cityLabel: "לונדון", search: s, hotel: h1, rate: h1.rates[1] });
    expect(built.price).toBe("150");
    expect(built.rate.match_hash).toBe("suite");
    expect(built.hotelInformation.roomName).toBe("Suite");
    expect(built.city).toBe("flight");
  });

  it("carries the card info and the breakfast offer, like the live split stay", () => {
    const built = buildStayHotel({ city: "event", cityLabel: "פראג", search: s, hotel: h1 });
    expect(built.segment_card).not.toBeUndefined();
    expect(built.breakfast_offer).toBeNull();
  });
});

describe("withStayHotelExtras", () => {
  const stayHotel = (r: Rate, id = "h1"): OrderHotel =>
    ({
      id,
      name: "Hotel",
      address: "x",
      price: "300",
      rate: r,
      checkin: REQUEST.checkin,
      checkout: REQUEST.checkout,
      guests: GUESTS,
      hotelInformation: { hotelName: "Hotel", roomName: "Double Room", stars: 4, amenities: [], distance: 1 },
    }) as OrderHotel;

  it("puts the room's images before the hotel's, max 12", () => {
    const general = Array.from({ length: 12 }, (_, i) => `g${i}`);
    const r = rate(100);
    const s = searchOf([hotel("h1", [r])], {
      h1: info("h1", { rooms: { "Double Room double bed": ["r1", "r2"] }, general }),
    });
    const out = withStayHotelExtras(stayHotel(r), s);
    expect(out.segment_card?.images).toHaveLength(12);
    expect(out.segment_card?.images.slice(0, 4)).toEqual(["r1", "r2", "g0", "g1"]);
  });

  it("keys the room by its name alone when the rate has no bed type", () => {
    const r = rate(100, { main: "Studio", bed: "" });
    const s = searchOf([hotel("h1", [r])], { h1: info("h1", { rooms: { Studio: ["s1"] }, general: ["g0"] }) });
    expect(withStayHotelExtras(stayHotel(r), s).segment_card?.images).toEqual(["s1", "g0"]);
  });

  it("fills the card from the metadata: distance rounded up, guest score, pin", () => {
    const r = rate(100);
    const s = searchOf([hotel("h1", [r])], { h1: info("h1", { distance: 850.2, guestRating: 8.7 }) });
    expect(withStayHotelExtras(stayHotel(r), s).segment_card).toEqual({
      images: [],
      distance: 851,
      guestRating: 8.7,
      lat: 50.08,
      lng: 14.43,
    });
  });

  it("segment_card is null without metadata", () => {
    const r = rate(100);
    const noMeta = searchOf([hotel("h1", [r])], { h1: info("h1", { noMetadata: true }) });
    expect(withStayHotelExtras(stayHotel(r), noMeta).segment_card).toBeNull();
    const noInfo = searchOf([hotel("h1", [r])], {});
    expect(withStayHotelExtras(stayHotel(r), noInfo).segment_card).toBeNull();
  });

  it("breakfast_offer is null when no breakfast rate exists", () => {
    const r = rate(100);
    const s = searchOf([hotel("h1", [r, rate(130, { hash: "other" })])], { h1: info("h1") });
    expect(withStayHotelExtras(stayHotel(r), s).breakfast_offer).toBeNull();
  });

  it("breakfast_offer is the same room's breakfast rate and its delta", () => {
    const r = rate(100);
    const withBreakfast = rate(140, { breakfast: true });
    const s = searchOf([hotel("h1", [r, withBreakfast])], { h1: info("h1") });
    const out = withStayHotelExtras(stayHotel(r), s);
    expect(out.breakfast_offer?.rate).toBe(withBreakfast);
    expect(out.breakfast_offer?.delta_usd).toBe(40);
  });

  it("breakfast_offer is null when the search is for other dates than the hotel", () => {
    const r = rate(100);
    const s = searchOf([hotel("h1", [r, rate(140, { breakfast: true })])], { h1: info("h1") });
    const moved = { ...stayHotel(r), checkout: "2026-10-14" };
    expect(withStayHotelExtras(moved, s).breakfast_offer).toBeNull();
  });

  it("leaves the rest of the hotel as it was", () => {
    const r = rate(100);
    const s = searchOf([hotel("h1", [r])], { h1: info("h1") });
    const before = stayHotel(r);
    const out = withStayHotelExtras(before, s);
    expect(out).toMatchObject({ id: "h1", price: "300", checkin: REQUEST.checkin, rate: r });
    expect(before).not.toHaveProperty("segment_card");
  });
});

describe("searchStayHotels", () => {
  const params = {
    dateRange: [new Date("2026-10-10T00:00:00"), new Date("2026-10-13T00:00:00")],
    location: { name: "Prague", latitude: 50.08, longitude: 14.43 },
    guests: GUESTS,
    radius: 2000,
    eventId: 7,
  } as unknown as FetchHotelsParams;

  const answered = searchOf([hotel("a", [rate(100)])], { a: info("a") });
  const emptyAnswered = searchOf([], {});

  /** A fetcher that plays `script` in turn (a thrown/rejected entry fails that attempt). */
  const scripted = (script: (HotelsData | Error)[]) => {
    const calls: number[] = [];
    const fetcher = async () => {
      calls.push(calls.length);
      const next = script[calls.length - 1];
      if (next instanceof Error) throw next;
      return next;
    };
    return { fetcher, calls };
  };

  it("returns the first answered result without a second call", async () => {
    const { fetcher, calls } = scripted([answered]);
    const res = await searchStayHotels(params, new AbortController().signal, { retryMs: 0, fetcher });
    expect(res).toBe(answered);
    expect(calls).toHaveLength(1);
  });

  it("returns an answered empty search without retrying", async () => {
    const { fetcher, calls } = scripted([emptyAnswered, answered]);
    const res = await searchStayHotels(params, new AbortController().signal, { retryMs: 0, fetcher });
    expect(res).toBe(emptyAnswered);
    expect(calls).toHaveLength(1);
  });

  it("retries once after a failed attempt and returns the answer", async () => {
    const { fetcher, calls } = scripted([new Error("429"), answered]);
    const res = await searchStayHotels(params, new AbortController().signal, { retryMs: 0, fetcher });
    expect(res).toBe(answered);
    expect(calls).toHaveLength(2);
  });

  it("retries a search whose info call failed (hotels without info)", async () => {
    const half = searchOf([hotel("a", [rate(100)])], { error: "x" } as unknown as Record<string, HotelInfoClient>);
    const { fetcher, calls } = scripted([half, answered]);
    const res = await searchStayHotels(params, new AbortController().signal, { retryMs: 0, fetcher });
    expect(res).toBe(answered);
    expect(calls).toHaveLength(2);
  });

  it("retries once then throws StaySearchFailed", async () => {
    const { fetcher, calls } = scripted([new Error("a"), new Error("b"), answered]);
    const run = searchStayHotels(params, new AbortController().signal, { retryMs: 0, fetcher });
    await expect(run).rejects.toBeInstanceOf(StaySearchFailed);
    expect(calls).toHaveLength(2);
  });

  it("stops when the signal is aborted before the first call", async () => {
    const ctl = new AbortController();
    ctl.abort();
    const { fetcher, calls } = scripted([answered]);
    await expect(searchStayHotels(params, ctl.signal, { retryMs: 0, fetcher })).rejects.toBeInstanceOf(
      StaySearchFailed
    );
    expect(calls).toHaveLength(0);
  });

  it("stops when the signal is aborted between the attempts", async () => {
    const ctl = new AbortController();
    const calls: number[] = [];
    const fetcher = async () => {
      calls.push(calls.length);
      ctl.abort();
      throw new Error("aborted");
    };
    await expect(searchStayHotels(params, ctl.signal, { retryMs: 0, fetcher })).rejects.toBeInstanceOf(
      StaySearchFailed
    );
    expect(calls).toHaveLength(1);
  });

  it("does not sit out the retry delay once aborted", async () => {
    const ctl = new AbortController();
    const calls: number[] = [];
    const fetcher = async () => {
      calls.push(calls.length);
      setTimeout(() => ctl.abort(), 5);
      throw new Error("429");
    };
    const started = Date.now();
    await expect(searchStayHotels(params, ctl.signal, { retryMs: 60_000, fetcher })).rejects.toBeInstanceOf(
      StaySearchFailed
    );
    expect(calls).toHaveLength(1);
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
