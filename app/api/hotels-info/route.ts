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
    const { data: hotels, error } = await supabase
      .from("hotels")
      .select("*")
      .in("hid", hids);

    if (error) throw error;

    return hotels;
  } catch (error) {
    console.error("DB hotels static data retrieval error:", error);
    return null;
  }
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

      missingHotels = (await Promise.all(missingHotelsIds.map(getHotelInfo)))
        .filter((hotel) => !!hotel)
        .map(({ data }) => ({ ...data, _id: data.id }));

      console.log("Missing hotels received from API:", missingHotels.length);
    }

    const transformedData = [...(hotelsData || []), ...missingHotels]?.reduce(
      (acc, hotel) => {
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
          if (room.name) {
            roomsAcc[room.name] = {
              name: room.name,
              images: room.images || [],
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
            images: hotel.images_ext
              .filter((image) =>
                ["hotel_front", "lobby"].includes(image.category_slug)
              )
              .map((image) => image.url),
          },
          metadata: {
            hotelName: hotel.name,
            address: hotel.address,
            rating: hotel.star_rating,
            id: hotel._id,
            longitude: hotel.longitude,
            latitude: hotel.latitude,
            // amenity_groups: hotel.amenity_groups,
            hid: hotel.hid,
            // images_ext: hotel.images_ext,
            // room_groups: hotel.room_groups,
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
} /*
    

    if (!hotelsData) {
      throw new Error("Failed to fetch hotels data from database");
    }

    const HotelInfoByKey = hotelsData.reduce((acc: HotelsInfoClient, hotelData) => {
      const hotelConfig = hotels.find(h => h.id === hotelData.hid);
      if (!hotelConfig) return acc;

      const allRooms = hotelData.room_groups.map((roomGroup: any) => ({
        name: roomGroup.name,
        images: roomGroup.images,
        amenities: roomGroup.room_amenities,
      }));

      const hotelAmenity = hotelData.amenity_groups.find(
        (amenityGroup: AmenityGroup) => amenityGroup.group_name === "General"
      );

      const filteredRooms = allRooms.reduce((roomAcc: Record<string, Room>, currRoom: RoomGroup) => {
        if (hotelConfig.rooms.includes(currRoom.name)) {
          roomAcc[currRoom.name] = currRoom;
        }
        return roomAcc;
      }, {});

      acc[hotelData.hid] = {
        rooms: filteredRooms,
        metadata: {
          hotelName: hotelData.name,
          address: hotelData.address,
          rating: hotelData.star_rating,
          id: hotelData.hid,
          longitude: hotelData.longitude,
          latitude: hotelData.latitude,
          distanceFromCenter: getDistance(
            {
              latitude: event.location.latitude,
              longitude: event.location.longitude,
            },
            {
              latitude: hotelData.latitude,
              longitude: hotelData.longitude,
            },
            1
          ),
        },
        general: {
          name: "general",
          amenities: hotelAmenity?.amenities || [],
          images: hotelData.images_ext
            .filter((image: string) =>
              ["hotel_front", "lobby"].includes(image.category_slug)
            )
            .map((image: string) => image.url),
        },
      };
      return acc;
    }, {});

    return NextResponse.json(HotelInfoByKey);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching hotel info" },
      { status: 500 }
    );
  }
}

*/
