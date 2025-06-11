/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from "next/server";
import { HotelInfo, HotelInfoDB } from "@/lib/hotelInfo.type";
import { Room, HotelsInfoClient, HotelInfoClient } from "@/lib/hotel.type";
import { Event } from "@/lib/app.types";
import { getDistance } from "geolib";
import { supabase } from "@/lib/supabase";
import { authHeader } from "../keys";
import { difference } from "lodash";

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

const saveNewHotelsStaticDataToDB = async (
  data: (HotelInfo["data"] & { _id: string })[]
) => {
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

const processHotelsData = (hotels: (HotelInfo["data"] & { _id: string })[]) => {
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
    let missingHotels: (HotelInfo["data"] & { _id: string })[] = [];

    if (hotelsData?.length !== hotelIds.length) {
      const missingHotelsIds = difference(
        hotelIds,
        hotelsData?.map(({ hid }) => hid) || []
      );

      console.log("Missing hotels:", missingHotelsIds);

      missingHotels = (
        await Promise.all(missingHotelsIds.slice(0, 14).map(getHotelInfo))
      )
        .filter((hotel) => !!hotel)
        .map(({ data }) => ({ ...data, _id: data.id }));

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
          if (room.name && !!room.images.length) {
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
