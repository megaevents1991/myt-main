import { Hotel, HotelResponse, HotelSearchRequest } from "@/lib/hotel.type";
import { NextResponse } from "next/server";
import { authHeader } from "../keys";

const API_URL = "https://api.worldota.net/api/b2b/v3/search/serp/geo";

export async function POST(request: Request) {
  const { location, checkin, checkout, guests, radius } = await request.json();

  if (!location || !checkin || !checkout || !guests?.length) {
    console.log("Invalid request body:", { location, checkin, checkout, guests });
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

    const fixedHotels: Hotel[] = data.data.hotels.map((hotel) => {
      const fixedRates = hotel.rates.map((rate) => {
        const fixedPaymentTypes = rate.payment_options.payment_types.map(
          (paymentType) => {
            const vat = paymentType.tax_data["taxes"].find(
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

      return {
        ...hotel,
        rates: fixedRates,
      };
    });
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
