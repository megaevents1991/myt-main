import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Hotel, HotelInfoClient, HotelsInfoClient } from "@/lib/hotel.type";
import { getDistance } from "geolib";
import { getOfflineRoomCapacity } from "@/lib/offlineRoomCapacity";

interface AmenityGroup {
  group_name: string;
  amenities: string[];
}
interface RoomGroup {
  name: string;
  images: string[];
  room_amenities: string[];
}

type OfflineRow = {
  id: number;
  hid: number | null;
  hotel_name: string;
  city: string;
  check_in: string;
  check_out: string;
  price: number | string;
  room_type: string;
  num_rooms: number;
  consumed_rooms: number;
  meal_plan: string | null;
  notes: string | null;
  last_cancellation_date: string | null;
};

type OfflineMeta = {
  offlineId: number; // first of offlineIds — kept for legacy backoffice code
  offlineIds: number[]; // one entry per consumed room unit (with repetition)
  checkin: string;
  checkout: string;
  numRooms: number;
  consumed: number;
  available: number;
  mealPlan: string | null;
  rawPrice: number; // total combo price (sum across matched rows)
  notes: string | null;
};

type RequestedRoom = { adults: number; children: number[] };

// Greedy matcher: for each requested room (sorted by pax DESC), pick the
// smallest available inventory unit whose capacity fits. Returns null if any
// requested room cannot be satisfied from this hotel's inventory.
function matchRoomsToInventory(
  requested: RequestedRoom[],
  rows: OfflineRow[]
): { rowIds: number[]; totalPrice: number } | null {
  const needs = requested
    .map((r) => r.adults + r.children.length)
    .sort((a, b) => b - a);

  const units = rows.map((r) => ({
    rowId: r.id,
    capacity: getOfflineRoomCapacity(r.room_type),
    price: Number(r.price),
    remaining: r.num_rooms - r.consumed_rooms,
  }));

  const matched: number[] = [];
  let total = 0;

  for (const pax of needs) {
    const pick = units
      .filter((u) => u.remaining > 0 && u.capacity >= pax)
      .sort((a, b) => a.capacity - b.capacity || a.price - b.price)[0];
    if (!pick) return null;
    pick.remaining -= 1;
    matched.push(pick.rowId);
    total += pick.price;
  }

  return { rowIds: matched, totalPrice: total };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = parseInt(searchParams.get("eventId") || "", 10);
  const checkin = searchParams.get("checkin");
  const checkout = searchParams.get("checkout");

  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  let requestedRooms: RequestedRoom[] = [{ adults: 1, children: [] }];
  const roomsParam = searchParams.get("rooms");
  if (roomsParam) {
    try {
      const parsed = JSON.parse(roomsParam);
      if (Array.isArray(parsed) && parsed.length > 0) {
        requestedRooms = parsed;
      }
    } catch {
      // ignore bad input, fall back to default 1-adult request
    }
  }

  // 1) Offline inventory rows for this event, filtered by the flight-aligned
  // window: only rows whose inventory [check_in, check_out] fully covers the
  // requested [checkin, checkout] are eligible.
  let query = (supabase as any)
    .from("offline_hotels")
    .select(
      "id, hid, hotel_name, city, check_in, check_out, price, room_type, num_rooms, consumed_rooms, meal_plan, notes, last_cancellation_date"
    )
    .contains("event_ids", [eventId])
    .eq("is_deleted", false);

  if (checkin && checkout) {
    query = query.lte("check_in", checkin).gte("check_out", checkout);
  }

  const { data: offlineRows, error } = await query.order("price", {
    ascending: true,
  });

  if (error) {
    console.error("Failed to fetch offline hotels:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!offlineRows?.length) {
    return NextResponse.json({ hotels: [], hotelsInfo: {}, meta: {} });
  }

  // 2) Event location (for distanceFromCenter)
  const { data: eventRow } = await supabase
    .from("events")
    .select("location")
    .eq("id", eventId)
    .single();

  const eventLocation = (eventRow?.location || {}) as {
    latitude?: number;
    longitude?: number;
  };

  // 3) WorldOTA metadata for rows that have a hid — same shape as /api/hotels-info
  const hids = (offlineRows as OfflineRow[])
    .filter((h) => h.hid != null)
    .map((h) => h.hid);

  let hotelsMetaRows: any[] = [];
  if (hids.length > 0) {
    const { data: meta } = await supabase
      .from("hotels")
      .select(
        "hid, _id, name, star_rating, kind, images_ext, amenity_groups, room_groups, address, latitude, longitude"
      )
      .in("hid", hids);
    hotelsMetaRows = meta ?? [];
  }

  // 4) Group rows by hid (or by id when hid is null) so multiple uploaded rows
  // for the same hotel can be matched together against the customer's room
  // request (e.g. triple + double for 5 pax).
  const groups = new Map<string, OfflineRow[]>();
  for (const row of offlineRows as OfflineRow[]) {
    const key = row.hid != null ? `hid-${row.hid}` : `id-${row.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const hotels: Hotel[] = [];
  const hotelsInfo: HotelsInfoClient = {};
  const metaById: Record<string, OfflineMeta> = {};

  for (const [, rowsInGroup] of groups) {
    const match = matchRoomsToInventory(requestedRooms, rowsInGroup);
    if (!match) continue; // hotel can't satisfy the requested room config

    // Anchor display metadata on the first row (all rows in a group share the
    // same hotel/hid).
    const anchor = rowsInGroup[0];
    const id = `offline-${anchor.hid ?? anchor.id}`;
    const meta = hotelsMetaRows.find((m: any) => m.hid === anchor.hid);

    const allImages = (meta?.images_ext ?? []) as {
      category_slug: string;
      url: string;
    }[];
    const preferred = allImages
      .filter((img) => ["hotel_front", "lobby"].includes(img.category_slug))
      .map((img) => img.url);
    const hotelImages =
      preferred.length > 0
        ? preferred
        : allImages.slice(0, 5).map((img) => img.url);

    const generalAmenities =
      ((meta?.amenity_groups ?? []) as AmenityGroup[]).find(
        (g) => g.group_name === "General"
      )?.amenities ?? [];

    const rooms = ((meta?.room_groups ?? []) as RoomGroup[]).reduce(
      (acc, room) => {
        if (room.name && !!room.images?.length) {
          acc[room.name] = {
            name: room.name,
            images: room.images,
            amenities: room.room_amenities || [],
          };
        }
        return acc;
      },
      {} as HotelInfoClient["rooms"]
    );

    const distanceFromCenter =
      meta?.latitude != null &&
      meta?.longitude != null &&
      eventLocation.latitude != null &&
      eventLocation.longitude != null
        ? getDistance(
            {
              latitude: eventLocation.latitude,
              longitude: eventLocation.longitude,
            },
            { latitude: meta.latitude, longitude: meta.longitude }
          )
        : 0;

    const info: HotelInfoClient = {
      rooms,
      general: {
        name: "general",
        amenities: generalAmenities,
        images: hotelImages,
      },
      metadata: {
        hid: anchor.hid ?? 0,
        hotelName: meta?.name || anchor.hotel_name,
        address: meta?.address || anchor.city,
        rating: meta?.star_rating ?? 0,
        kind: meta?.kind || "Hotel",
        id,
        longitude: meta?.longitude ?? 0,
        latitude: meta?.latitude ?? 0,
        distanceFromCenter,
      },
    };

    // Synthetic Rate — show_amount is the total combo price. The customer-facing
    // per-person supplement is computed in <HotelCard> the same way it is for
    // online hotels: (show_amount / persons) - event.base_hotel_price.
    const firstRoomName =
      Object.keys(rooms)[0] ||
      (anchor.room_type as string | undefined) ||
      "Standard Room";

    // Earliest cancellation deadline across matched rows — worst case for the customer
    const matchedCancDates = match.rowIds
      .map((id) => rowsInGroup.find((r) => r.id === id)?.last_cancellation_date)
      .filter((d): d is string => !!d);
    const freeCancellationBefore =
      matchedCancDates.length > 0 ? [...matchedCancDates].sort()[0] : "";

    const totalPriceStr = String(match.totalPrice);
    const rate: any = {
      match_hash: `offline-${id}`,
      daily_prices: [],
      meal: anchor.meal_plan || "nomeal",
      payment_options: {
        payment_types: [
          {
            amount: totalPriceStr,
            show_amount: totalPriceStr,
            currency_code: "USD",
            show_currency_code: "USD",
            by: "offline",
            is_need_credit_card_data: false,
            is_need_cvc: false,
            type: "deposit",
            tax_data: { taxes: [] },
            cancellation_penalties: {
              policies: [],
              free_cancellation_before: freeCancellationBefore,
            },
          },
        ],
      },
      rg_ext: {
        class: 0,
        quality: 0,
        sex: 0,
        bathroom: 0,
        bedding: 0,
        family: 0,
        capacity: 0,
        club: 0,
      },
      room_name: firstRoomName,
      room_name_info: null,
      serp_filters: [],
      allotment: null,
      amenities_data: [],
      any_residency: false,
      deposit: null,
      no_show: null,
      room_data_trans: {
        main_room_type: firstRoomName,
        main_name: firstRoomName,
        bathroom: null,
        bedding_type: "",
        misc_room_type: null,
      },
      meal_data: {
        has_breakfast: !!anchor.meal_plan,
        no_child_meal: false,
        value: anchor.meal_plan || "",
      },
    };

    const hotel: Hotel = {
      hid: anchor.hid ?? 0,
      id,
      rates: [rate],
      isOffline: true,
    };

    // Totals across the rows that make up this group's inventory
    const totalNumRooms = rowsInGroup.reduce((s, r) => s + r.num_rooms, 0);
    const totalConsumed = rowsInGroup.reduce(
      (s, r) => s + r.consumed_rooms,
      0
    );

    hotels.push(hotel);
    hotelsInfo[id] = info;
    metaById[id] = {
      offlineId: match.rowIds[0],
      offlineIds: match.rowIds,
      checkin: anchor.check_in,
      checkout: anchor.check_out,
      numRooms: totalNumRooms,
      consumed: totalConsumed,
      available: totalNumRooms - totalConsumed,
      mealPlan: anchor.meal_plan,
      rawPrice: match.totalPrice,
      notes: anchor.notes,
    };
  }

  // Keep the cheapest-first ordering the old code relied on.
  hotels.sort(
    (a, b) => metaById[a.id].rawPrice - metaById[b.id].rawPrice
  );

  return NextResponse.json({ hotels, hotelsInfo, meta: metaById });
}
