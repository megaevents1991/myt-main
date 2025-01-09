import { NextResponse } from "next/server";
import { authHeader } from "../keys";
import { HotelInfo } from "@/lib/hotelInfo.type";
import { Room, RoomsInfo } from "@/lib/hotel.type";

const HOTEL_INFO_URL = "https://api.worldota.net/api/b2b/v3/hotel/info/";

const getHotelInfo = async (hotelId: string, rooms: string[]) => {
  try {
    const hotelInfoResponse = await fetch(HOTEL_INFO_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify({ id: hotelId, language: "en" }),
    });

    if (!hotelInfoResponse.ok) {
      console.error(await hotelInfoResponse.text());
      throw new Error("API request failed");
    }

    const hotelInfoData: HotelInfo = await hotelInfoResponse.json();

    const allRooms = hotelInfoData.data.room_groups.map((roomGroup) => {
      return {
        name: roomGroup.name,
        images: roomGroup.images,
        amenities: roomGroup.room_amenities,
      };
    });

    const hotelAmenity = hotelInfoData.data.amenity_groups.filter(
      (amenityGroup) => {
        return amenityGroup.group_name === "General";
      }
    );

    const filteredRooms = allRooms.reduce((acc, currRoom) => {
      if (rooms.includes(currRoom.name)) {
        acc[currRoom.name] = currRoom;
      }
      return acc;
    }, {} as Record<string, Room>);

    return {
      id: hotelId,
      rating: hotelInfoData.data.star_rating,
      rooms: filteredRooms,
      general: {
        name: "general",
        amenities: hotelAmenity[0].amenities,
        images: hotelInfoData.data.images_ext
          .filter(
            (image) =>
              image.category_slug === "hotel_front" ||
              image.category_slug === "lobby"
          )
          .map((image) => image.url),
      },
    };
  } catch (error) {
    console.error("API error:", error);
  }
};

export async function POST(request: Request) {
  const { hotels }: { hotels: { id: string; rooms: string[] }[] } =
    await request.json();

  if (!hotels.length) {
    return NextResponse.json(
      {
        error:
          "Location, check-in, check-out dates, and number of guests are required",
      },
      { status: 400 }
    );
  }

  try {
    const data = await Promise.all(
      hotels.map(({ id, rooms }) => getHotelInfo(id, rooms))
    );

    const roomsDict = data.reduce((acc, hotel) => {
      if (hotel) {
        acc[hotel.id] = {
          rating: hotel.rating,
          rooms: hotel.rooms,
          general: hotel.general,
        };
      }
      return acc;
    }, {} as RoomsInfo);

    return NextResponse.json(roomsDict);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching hotel info" },
      { status: 500 }
    );
  }
}
