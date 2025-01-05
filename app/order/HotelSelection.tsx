"use client";

import { events } from "@/lib/events-data";
import { formatHotelName } from "@/lib/formatHotelName";
import { Hotel, HotelResponse } from "@/lib/hotel.type";
import { Button, Popover } from "@mantine/core";
import { useState, useEffect, useContext } from "react";
import { OrderContext } from "../app.context";
import { DateRange } from "@/components/ui/dateInput";
import RoomsAndGuestsInput from "@/components/ui/roomsAndGuestsInput";
import { LoaderWrapper } from "@/components/ui/loader";
import { HotelCard } from "@/components/ui/hotelCard";
import { Search } from "lucide-react";

const event = events[0];

export const HotelSelection = () => {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const {
    setHotel,
    planeTickets,
    hotel: selectedHotel,
  } = useContext(OrderContext);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(new Date(event.date).getTime() - 2 * 8.64e7),
    new Date(new Date(event.date).getTime() + 8.64e7),
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [roomParams, setRoomParams] = useState({
    rooms: 1,
    beds: 2,
    adults: planeTickets.adults,
  });

  useEffect(() => {
    fetchHotels();
  }, []);

  const fetchHotels = async () => {
    setIsLoading(true);
    const res = await fetch(`/api/hotels`, {
      method: "POST",
      body: JSON.stringify({
        location: event.location,
        checkin: dateRange?.[0]?.toISOString().split("T")[0],
        checkout: dateRange?.[1]?.toISOString().split("T")[0],
        adults: 1,
      }),
    });
    const data: HotelResponse = await res.json();
    setHotels(data.data.hotels);
    setIsLoading(false);
  };

  const handleSelect = (hotel: Hotel) => {
    setHotel({
      name: formatHotelName(hotel.id),
      id: hotel.id,
      price: +hotel.rates[0].daily_prices[0],
    });
  };

  return (
    <div>
      <div className="flex flex-col w-full items-center">
        <div
          dir="rtl"
          className="w-screen gap-2 flex flex-col justify-center p-4 bg-gray-200 items-center"
        >
          <div className="text-xs w-full flex-col text-center">
            <div className="text-2xl font-bold pre">{event?.name}</div>
            <div className="whitespace-nowrap">
              {event?.date} | {event?.location.name}
            </div>
          </div>
          <div className="flex w-full md:w-1/2 lg:w-1/3 flex-row gap-2 text-xs">
            <div className="w-2/5">
              <Popover
                width={300}
                trapFocus
                position="bottom"
                shadow="md"
                keepMounted={false}
              >
                <Popover.Target>
                  <div className="w-full p-3 text-center bg-white rounded-lg border border-gray-300 text-[1rem] cursor-pointer">
                    {`${roomParams.rooms} חדרים | ${roomParams.beds} מיטות | ${roomParams.adults} מבוגרים`}
                  </div>
                </Popover.Target>
                <Popover.Dropdown>
                  <RoomsAndGuestsInput
                    initialGuests={roomParams.adults}
                    initialRooms={roomParams.rooms}
                    onUnmount={({ guests, rooms }) => {
                      setRoomParams({ ...roomParams, rooms, adults: guests });
                    }}
                  />
                </Popover.Dropdown>
              </Popover>
            </div>
            <div className="flex gap-2 flex-row w-3/5">
              <DateRange
                dateRange={dateRange}
                setDateRange={setDateRange}
                eventDay={event?.date}
              />
              <Button
                onClick={fetchHotels}
                size="md"
                style={{ borderRadius: "var(--radius)" }}
              >
                <Search size={30} />
              </Button>
            </div>
          </div>
        </div>
      </div>
      <LoaderWrapper isLoading={isLoading}>
        <div className="grid grid-cols-1 gap-4 items-start">
          {" "}
          {hotels.map((hotel) => {
            return (
              <HotelCard
                isSelected={hotel.id === selectedHotel?.id}
                key={hotel.id}
                hotel={hotel}
                handleSelect={handleSelect}
              />
            );
          })}
        </div>
      </LoaderWrapper>
    </div>
  );
};
