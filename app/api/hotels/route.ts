import { HotelResponse, HotelSearchRequest } from "@/lib/hotel.type";
import { NextResponse } from "next/server";
import { authHeader } from "../keys";

const API_URL = "https://api.worldota.net/api/b2b/v3/search/serp/geo";

export async function POST(request: Request) {
  const { location, checkin, checkout, guests, radius } = await request.json();

  if (!location || !checkin || !checkout || !guests?.length) {
    return NextResponse.json(
      {
        error:
          "Location, check-in, check-out dates, and number of guests are required",
      },
      { status: 400 }
    );
  }

  const { latitude, longitude } = location;

  const hotelSearchRequest: HotelSearchRequest = {
    checkin,
    checkout,
    residency: "il",
    language: "en",
    guests,
    longitude,
    latitude,
    radius,
    currency: "USD",
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify(hotelSearchRequest),
    });

    if (!response.ok) {
      console.log(await response.text());
      throw new Error("API request failed");
    }

    const data: HotelResponse = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching hotel data" },
      { status: 500 }
    );
  }
}
