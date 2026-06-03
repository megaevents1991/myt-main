/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from "next/server";
import { HotelInfo, HotelInfoDB } from "@/lib/hotelInfo.type";
import { Room, HotelsInfoClient, HotelInfoClient } from "@/lib/hotel.type";
import { Event } from "@/lib/app.types";
import { getDistance } from "geolib";
import { supabase } from "@/lib/supabase";
import { authHeader } from "../keys";
import { getHotelReviews } from "./reviews";
import { HotelGuestRating } from "@/lib/hotel.type";
import { difference } from "lodash";

// HotelInfo static data merged with our cached guest-rating fields.
type HotelStaticWithReviews = HotelInfo["data"] & {
  _id: string;
  guest_rating?: number | null;
  guest_review_count?: number | null;
  guest_detailed_ratings?: Record<string, number> | null;
};

interface AmenityGroup {
  group_name: string;
  amenities: string[];
}
interface RoomGroup {
  name: string;
  images: string[];
  room_amenities: string[];
}

const HOTEL_INFO_URL = "https://api.worldota.net/api/b2b/v3/hotel/info/";

const getHotelInfo = async (hid: number): Promise<HotelInfo | null> => {
  try {
    const hotelInfoResponse = await fetch(HOTEL_INFO_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify({ hid, language: "en" }),
    });

    if (!hotelInfoResponse.ok) {
      console.error(await hotelInfoResponse.text());
      return null;
    }

    const hotelInfoData: HotelInfo = await hotelInfoResponse.json();

    return hotelInfoData;
  } catch (error) {
    console.error("API error:", error);
    return null;
  }
};

const getHotelsStaticDataFromDB = async (
  hids: number[]
): Promise<HotelInfoDB[] | null> => {
  try {
    // Limit batch size to prevent timeouts
    const BATCH_SIZE = 100;
    const batches = [];
    
    for (let i = 0; i < hids.length; i += BATCH_SIZE) {
      batches.push(hids.slice(i, i + BATCH_SIZE));
    }

    const allHotels: HotelInfoDB[] = [];
    
    for (const batch of batches) {
      const { data: hotels, error } = await supabase
        .from("hotels")
        .select("*")
        .in("hid", batch)
        .abortSignal(AbortSignal.timeout(15000)); // 15 second timeout

      if (error) throw error;
      if (hotels) allHotels.push(...hotels);
    }

    return allHotels;
  } catch (error) {
    console.error("DB hotels static data retrieval error:", error);
    return null;
  }
};

const saveNewHotelsStaticDataToDB = async (data: HotelStaticWithReviews[]) => {
  try {
    const hotels = processHotelsData(data);
    const { error } = await supabase.from("hotels").upsert(hotels);
    if (error) throw error;

    await new Promise((resolve) => setTimeout(resolve, 500)); // Add delay
    return;
  } catch (error) {
    console.error("DB hotels static data retrieval error:", error);
    return;
  }
};

const processHotelsData = (hotels: HotelStaticWithReviews[]) => {
  const hasReviews = (h: HotelStaticWithReviews) =>
    h.guest_rating != null || h.guest_review_count != null;
  return hotels.map((hotel) => ({
    _id: hotel.id,
    hid: hotel.hid,
    name: hotel.name,
    address: hotel.address,
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    star_rating: hotel.star_rating,
    kind: hotel.kind,
    room_groups: JSON.parse(JSON.stringify(hotel.room_groups || [])),
    images_ext: JSON.parse(JSON.stringify(hotel.images_ext || [])),
    amenity_groups: JSON.parse(JSON.stringify(hotel.amenity_groups || [])),
    city: "Missing",
    guest_rating: hotel.guest_rating ?? null,
    guest_review_count: hotel.guest_review_count ?? null,
    guest_detailed_ratings: hotel.guest_detailed_ratings ?? null,
    guest_rating_updated_at: hasReviews(hotel) ? new Date().toISOString() : null,
  }));
};

export async function POST(request: Request) {
  const {
    hotels,
    event,
  }: {
    hotels: { hid: number; id: string; rooms: string[] }[];
    event: Pick<Event, "location">;
  } = await request.json();

  if (!hotels?.length) {
    console.log(
      `Invalid request body "(!hotels?.length) check":`,
      JSON.stringify(hotels),
      event
    );
    return NextResponse.json(
      {
        error:
          "Location, check-in, check-out dates, and number of guests are required",
      },
      { status: 400 }
    );
  }

  try {
    const hotelIds = hotels.map((hotel) => hotel.hid);
    const hotelsData = await getHotelsStaticDataFromDB(hotelIds);
    let missingHotels: HotelStaticWithReviews[] = [];

    if (hotelsData?.length !== hotelIds.length) {
      const missingHotelsIds = difference(
        hotelIds,
        hotelsData?.map(({ hid }) => hid) || []
      );

      console.log("Missing hotels:", missingHotelsIds);

      const fetchedHotels = (
        await Promise.all(missingHotelsIds.slice(0, 14).map(getHotelInfo))
      )
        .filter((hotel) => !!hotel)
        .map(({ data }) => data);

      // Fetch RateHawk guest ratings for the newly-cached hotels in one call,
      // and attach them so they're persisted + returned alongside static data.
      const reviewsByHid = await getHotelReviews(
        fetchedHotels.map((h) => h.hid)
      );
      missingHotels = fetchedHotels.map((data) => {
        const review: HotelGuestRating | undefined = reviewsByHid[data.hid];
        return {
          ...data,
          _id: data.id,
          guest_rating: review?.guest_rating ?? null,
          guest_review_count: review?.guest_review_count ?? null,
          guest_detailed_ratings: review?.guest_detailed_ratings ?? null,
        };
      });

      console.log("Missing hotels received from API:", missingHotels.length);
    }

    saveNewHotelsStaticDataToDB(missingHotels);

    const transformedData = [...(hotelsData || []), ...missingHotels]?.reduce(
      (acc, hotel) => {
        const hotelImages = hotel.images_ext
          .filter((image) =>
            ["hotel_front", "lobby"].includes(image.category_slug)
          )
          .map((image) => image.url);

        if (!hotelImages.length) {
          return acc;
        }

        // Calculate distance from event center to hotel
        const distanceInMeters = getDistance(
          {
            latitude: event.location.latitude,
            longitude: event.location.longitude,
          },
          {
            latitude: hotel.latitude,
            longitude: hotel.longitude,
          }
        );

        const hotelAmenity = hotel.amenity_groups.find(
          (amenityGroup: AmenityGroup) => amenityGroup.group_name === "General"
        );

        // Transform rooms data
        const rooms = hotel.room_groups?.reduce((roomsAcc, room) => {
          if (room.name && !!room.images?.length) {
            roomsAcc[room.name] = {
              name: room.name,
              images: room.images,
              amenities: room.room_amenities || [],
            };
          }
          return roomsAcc;
        }, {} as HotelInfoClient["rooms"]);

        // Create hotel entry
        acc[hotel._id] = {
          rooms,
          general: {
            name: "general",
            amenities: hotelAmenity?.amenities || [],
            images: hotelImages,
          },
          metadata: {
            hotelName: hotel.name,
            address: hotel.address,
            rating: hotel.star_rating,
            id: hotel._id,
            longitude: hotel.longitude,
            latitude: hotel.latitude,
            kind: hotel.kind,
            hid: hotel.hid,
            distanceFromCenter: distanceInMeters,
            guestRating: hotel.guest_rating ?? 0,
            guestReviewCount: hotel.guest_review_count ?? 0,
          },
        };

        return acc;
      },
      {} as HotelsInfoClient
    );

    return NextResponse.json(transformedData);
  } catch (error) {
    console.log("API error:", error);
  }
}
