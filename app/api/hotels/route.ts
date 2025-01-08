import { HotelResponse, HotelSearchRequest } from "@/lib/hotel.type";
import { NextResponse } from "next/server";
import { authHeader } from "../keys";

const API_URL = "https://api.worldota.net/api/b2b/v3/search/serp/geo";

export async function POST(request: Request) {
  const { location, checkin, checkout, adults } = await request.json();

  if (!location || !checkin || !checkout || !adults) {
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
    guests: [
      {
        adults,
        children: [],
      },
    ],
    longitude,
    latitude,
    radius: 1000,
    currency: "EUR",
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
