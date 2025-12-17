import { Event } from "@/lib/app.types";
import { HotelResponse, HotelsInfoClient } from "@/lib/hotel.type";
import dayjs from "dayjs";

export type FetchHotelsParams = {
  location: Event["location"];
  radius?: number;
  dateRange: [Date | null, Date | null];
  guests: {
    adults: number;
    children: number[];
  }[];
};

export const fetchHotels = async (
  {
    radius = 2000,
    dateRange,
    location,
    guests = [
      {
        adults: 1,
        children: [],
      },
    ],
  }: FetchHotelsParams,
  signal: AbortSignal
) => {
  const effectiveRadius = location?.country_code === "US" ? 5000 : radius;

  const res = await fetch(`/api/hotels`, {
    signal,
    method: "POST",
    body: JSON.stringify({
      location,
      checkin: dayjs(dateRange[0]?.toDateString()).format("YYYY-MM-DD"),
      checkout: dayjs(dateRange[1]?.toDateString()).format("YYYY-MM-DD"),
      guests,
      radius: effectiveRadius,
    }),
  });
  const data: HotelResponse = await res.json();

  const hotels = data?.data?.hotels?.map((hotel) => {
    const allRooms = hotel.rates.map(
      (rate) =>
        rate.room_data_trans.main_name +
        (rate.room_data_trans.bedding_type
          ? " " + rate.room_data_trans.bedding_type
          : "")
    );

    const rooms = [...new Set(allRooms)];
    return { id: hotel.id, hid: hotel.hid, rooms };
  });

  const hotelsInfoRes = await fetch(`/api/hotels-info`, {
    signal,
    method: "POST",
    body: JSON.stringify({
      hotels,
      event: {
        location,
      },
    }),
  });

  const hotelsInfo: HotelsInfoClient = await hotelsInfoRes.json();

  return {
    data,
    hotelsInfo,
  };
};
