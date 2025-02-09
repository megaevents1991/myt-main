/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from "next/server";
import { HotelInfoDB } from "@/lib/hotelInfo.type";
import { Room, HotelsInfoClient } from "@/lib/hotel.type";
import { Event } from "@/lib/app.types";
import { getDistance } from "geolib";
import { supabase } from "@/lib/supabase";


interface AmenityGroup {
  group_name: string;
  amenities: string[];
}
interface RoomGroup {
  name: string;
  images: string[];
  room_amenities: string[];
}

export async function getHotelsStaticDataFromDB(hids: number[]) {
  try {
    const { data: hotels, error } = await supabase
      .from('hotels')
      .select('*')
      .in('hid', hids);

    if (error) throw error;

    return hotels;
  } catch (error) {
    console.error("DB hotels static data retrival error:", error);
    return null;
  }
}

export async function POST(request: Request) {
  const {
    hotels,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    event,
  }: {
    hotels: { hid: number, id: string; rooms: string[] }[];
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
    const hotelIds = hotels.map(hotel => hotel.hid);
    const hotelsData = await getHotelsStaticDataFromDB(hotelIds) as HotelInfoDB[];


    const transformedData = hotelsData.reduce((acc: Record<string, any>, hotel) => {
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
      const rooms = hotel.room_groups?.reduce((roomsAcc: Record<string, any>, room: any) => {
        if (room.name) {
          roomsAcc[room.name] = {
            name: room.name,
            images: room.images || [],
            amenities: room.room_amenities || []
          };
        }
        return roomsAcc;
      }, {});

      // Create hotel entry
      acc[hotel._id] = {
        rooms: rooms || {},
        metadata: {
          hotelName: hotel.name,
          address: hotel.address,
          rating: hotel.star_rating,
          id: hotel._id,
          longitude: hotel.longitude,
          latitude: hotel.latitude,
          amenity_groups: hotel.amenity_groups,
          hid: hotel.hid,
          images_ext: hotel.images_ext,
          room_groups: hotel.room_groups,
          distanceFromCenter: distanceInMeters,
          general: {
            name: "general",
            amenities: hotelAmenity?.amenities || [],
            images: hotelData.images_ext
              .filter((image: string) =>
                ["hotel_front", "lobby"].includes(image.category_slug)
              )
              .map((image: string) => image.url),
          },
        }
      };

      return acc;
    }, {});

    return NextResponse.json(transformedData);

  } catch (error) {
    console.log("API error:", error);
  }
}; /*
    

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