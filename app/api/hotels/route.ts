import { Hotel, HotelResponse, HotelSearchRequest } from "@/lib/hotel.type";
import { NextResponse } from "next/server";
import { authHeader } from "../keys";
import { supabase } from "@/lib/supabase";

const API_URL = "https://api.worldota.net/api/b2b/v3/search/serp/geo";

const fetchHotels = async (hotelSearchRequest: HotelSearchRequest) => {
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

  return response;
};

// offline_hotels has no hid column — it is a standalone inventory not linked to Ratehawk.
// Returns empty set until offline hotels are shown separately (like offline flights).
const getOfflineHotelHids = async (eventId: number): Promise<Set<number>> => {
  void eventId;
  return new Set();
};

export async function POST(request: Request) {
  const { location, checkin, checkout, guests, radius, eventId } = await request.json();

  if (!location || !checkin || !checkout || !guests?.length) {
    console.log("Invalid request body:", {
      location,
      checkin,
      checkout,
      guests,
    });
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
    const [data, offlineHids] = await Promise.all([
      fetchHotels(hotelSearchRequest)
        .then((res) => res.json())
        .then(async (data: HotelResponse) => {
          // Cold serp sometimes returns 0 — retry once immediately (no sleep).
          if (!data.data.total_hotels) {
            console.log("No hotels found, retrying immediately");
            return (await fetchHotels(hotelSearchRequest)).json();
          }
          return data;
        }),
      eventId ? getOfflineHotelHids(eventId) : Promise.resolve(new Set<number>()),
    ]);

    const fixedHotels: Hotel[] = data.data.hotels.reduce((acc: Hotel[], hotel: Hotel) => {
      if (!hotel.rates || !Array.isArray(hotel.rates) || hotel.rates.length === 0) {
        return acc;
      }
      const fixedRates = hotel.rates.map((rate) => {
        if (!rate.payment_options?.payment_types) {
          return rate;
        }
        const fixedPaymentTypes = rate.payment_options.payment_types.map(
          (paymentType) => {
            const vat = paymentType.tax_data?.["taxes"]?.find(
              (tax) => tax.name === "vat"
            );
            const tax =
              !vat?.included_by_supplier && vat?.amount ? +vat.amount : 0;

            if (tax) {
              console.log({
                taxFound: tax,
                oldPrice: +paymentType.show_amount,
                newPrice: +paymentType.show_amount + tax,
              });
            }

            return {
              ...paymentType,
              show_amount: (+paymentType.show_amount + tax).toString(),
            };
          }
        );

        return {
          ...rate,
          payment_options: {
            ...rate.payment_options,
            payment_types: fixedPaymentTypes,
          },
        };
      });

      acc.push({
        ...hotel,
        rates: fixedRates,
        ...(offlineHids.has(hotel.hid) && { isOffline: true }),
      });

      return acc;
    }, [] as Hotel[]);

    return NextResponse.json<HotelResponse>({
      ...data,
      data: {
        hotels: fixedHotels,
        total_hotels: data.data.total_hotels,
      },
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching hotel data" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = parseFloat(searchParams.get('lat') || '');
  const longitude = parseFloat(searchParams.get('lon') || '');
  const checkin = searchParams.get('checkin');
  const checkout = searchParams.get('checkout');
  const secret = searchParams.get('secret');
    
  if (secret !== process.env.NEXT_SECRET_REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate required parameters (isFinite, not truthiness — 0 is a valid coordinate)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !checkin || !checkout) {
    return NextResponse.json(
      { 
        error: "latitude, longitude, checkin, and checkout are required",
        example: "?latitude=31.7683&longitude=35.2137&checkin=2025-08-01&checkout=2025-08-03"
      },
      { status: 400 }
    );
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(checkin) || !dateRegex.test(checkout)) {
    return NextResponse.json(
      { error: "Dates must be in YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  const hotelSearchRequest: HotelSearchRequest = {
    checkin,
    checkout,
    residency: "il",
    language: "en",
    guests: [{ adults: 2, children: [] }], // Fixed: 2 adults
    longitude,
    latitude,
    radius: 1500, // Fixed: 1.5 KM radius
    currency: "USD",
  };

  try {
    // Step 1: Search for hotels
    const hotelResponse: HotelResponse = await fetchHotels(hotelSearchRequest)
      .then((res) => res.json())
      .then(async (data: HotelResponse) => {
        if (!data.data.total_hotels) {
          console.log("No hotels found, retrying in 1 second");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return (await fetchHotels(hotelSearchRequest)).json();
        }
        return data;
      });

    if (!hotelResponse.data.hotels.length) {
      return NextResponse.json({
        cheapest_price: null,
        message: "No hotels found within 2km radius",
        search_params: { latitude, longitude, checkin, checkout }
      });
    }

    // Step 2: Get hotel info to filter for 4-star hotels
    const hotelIds = hotelResponse.data.hotels.map(hotel => hotel.hid);
    
    // Fetch hotel static data from database
    const { data: hotelsStaticData, error } = await supabase
      .from("hotels")
      .select("hid, star_rating, name")
      .in("hid", hotelIds)
      .eq("kind", "Hotel")
      .eq("star_rating", 3);

    if (error) {
      console.error("Database query error:", error);
      return NextResponse.json(
        { error: "Error retrieving hotel information" },
        { status: 500 }
      );
    }

    if (!hotelsStaticData || hotelsStaticData.length === 0) {
      return NextResponse.json({
        cheapest_price: null,
        message: "No 3-star hotels found within 1km radius",
        search_params: { latitude, longitude, checkin, checkout }
      });
    }

    // Step 3: Find cheapest price among 3-star hotels
    const threeStarHotelIds = new Set(hotelsStaticData.map(h => h.hid));
    let cheapestPrice = Infinity;
    let cheapestHotel = null;

    for (const hotel of hotelResponse.data.hotels) {
      // Skip if not a 3-star hotel
      if (!threeStarHotelIds.has(hotel.hid)) {
        continue;
      }

      // Check all rates for this hotel
      for (const rate of hotel.rates || []) {
        for (const paymentType of rate.payment_options?.payment_types || []) {
          const price = parseFloat(paymentType.show_amount);
          if (price < cheapestPrice) {
            cheapestPrice = price;
            cheapestHotel = {
              hid: hotel.hid,
              name: hotelsStaticData.find(h => h.hid === hotel.hid)?.name,
              price: price,
              currency: paymentType.show_currency_code,
              room_name: rate.room_name,
              meal: rate.meal
            };
          }
        }
      }
    }

    if (cheapestHotel) {
      return NextResponse.json({
        cheapest_price: cheapestPrice,
        currency: cheapestHotel.currency,
        hotel: {
          hid: cheapestHotel.hid,
          name: cheapestHotel.name,
          room_name: cheapestHotel.room_name,
          meal: cheapestHotel.meal
        },
        search_params: { latitude, longitude, checkin, checkout, radius: 2 },
        total_4star_hotels_found: hotelsStaticData.length
      });
    } else {
      return NextResponse.json({
        cheapest_price: null,
        message: "No available rates found for 3-star hotels",
        search_params: { latitude, longitude, checkin, checkout },
        total_4star_hotels_found: hotelsStaticData.length
      });
    }

  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching cheapest hotel price" },
      { status: 500 }
    );
  }
}