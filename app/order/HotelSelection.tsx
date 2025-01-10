"use client";

import { events } from "@/lib/events-data";
import { formatHotelName } from "@/lib/formatHotelName";
import { Hotel, HotelResponse, RoomsInfo } from "@/lib/hotel.type";
import { Button, Popover } from "@mantine/core";
import { useState, useEffect, useContext } from "react";
import { OrderContext } from "../app.context";
import { DateRange } from "@/components/ui/dateInput";
import RoomsAndGuestsInput from "@/components/ui/roomsAndGuestsInput";
import { LoaderWrapper } from "@/components/ui/loader";
import { HotelCard } from "@/components/ui/hotelCard";
import { Search, Settings2Icon } from "lucide-react";
import { useMediaQuery } from "@mantine/hooks";
import { HotelFilters } from "@/components/ui/HotelFilters";
import { applyFiltersAndSorting } from "@/lib/hotelFilter";
import { FiltersModal } from "@/components/ui/FiltersModal";
import { SortOptionsContainer } from "@/components/ui/SortOptionsContainer";

const event = events[0];

export const HotelSelection = () => {
  const [showFilters, setShowFilters] = useState(false);
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

  const [filteredHotels, setFilteredHotels] = useState<Hotel[]>([]);
  const [maxPrice, setMaxPrice] = useState<number>(0);
  const [hotelsInfo, setHotelsInfo] = useState<RoomsInfo>({} as RoomsInfo);
  const [rating, setRating] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);

  const [priceRange, setPriceRange] = useState<[number, number]>([0, maxPrice]);

  const matches = useMediaQuery("(min-width: 768px)");

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

    const hotels = data.data.hotels.map((hotel) => {
      const allRooms = hotel.rates.map(
        (rate) =>
          rate.room_data_trans.main_name +
          (rate.room_data_trans.bedding_type
            ? " " + rate.room_data_trans.bedding_type
            : "")
      );

      const rooms = [...new Set(allRooms)];
      return { id: hotel.id, rooms };
    });

    const hotelsInfoRes = await fetch(`/api/hotels-info`, {
      method: "POST",
      body: JSON.stringify({
        hotels,
      }),
    });

    const hotelsInfo = await hotelsInfoRes.json();

    const maxPrice = Math.max(
      ...data.data.hotels.map(
        (hotel) => +hotel.rates[0].payment_options.payment_types[0].show_amount
      )
    );
    setPriceRange([0, maxPrice]);
    setHotelsInfo(hotelsInfo);
    setMaxPrice(maxPrice);
    setHotels(data.data.hotels);
    setFilteredHotels(data.data.hotels);
    setIsLoading(false);
  };

  const handleSelect = (hotel: Hotel) => {
    setHotel({
      name: formatHotelName(hotel.id),
      id: hotel.id,
      price: +hotel.rates[0].daily_prices[0],
    });
  };

  const handlePriceChange = (priceRange: [number, number]) => {
    setPriceRange(priceRange);
    const hotelsToSet = applyFiltersAndSorting({
      hotels,
      priceRange,
      rating,
      hotelsInfo,
    });

    setFilteredHotels(hotelsToSet);
  };

  const handleRatingChange = (rating: boolean[]) => {
    setRating(rating);
    const hotelsToSet = applyFiltersAndSorting({
      hotels,
      priceRange,
      rating,
      hotelsInfo,
    });

    setFilteredHotels(hotelsToSet);
  };

  return (
    <div className="space-y-6">
      <FiltersModal show={showFilters} onClose={() => setShowFilters(false)}>
        <HotelFilters
          selectedRating={rating}
          maxPrice={maxPrice}
          onPriceRangeChange={handlePriceChange}
          onSearchChange={() => {}}
          onRatingChange={handleRatingChange}
        />
      </FiltersModal>
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
          <div className="flex w-full md:w-2/3 lg:w-1/2 flex-col gap-2 text-xs md:flex-row">
            <div className="w-full md:w-1/2">
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
            <div className="flex gap-2 flex-row md:w-1/2">
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
      <SortOptionsContainer
        sortOptions={
          <>
            <div>סדר לפי</div>
            <button className="font-bold" onClick={() => {}}>
              מחיר
            </button>
            <button className="font-bold" onClick={() => {}}>
              משך טיסה
            </button>
          </>
        }
        settings={
          <button>
            <Settings2Icon onClick={() => setShowFilters(true)} />
          </button>
        }
      />
      <LoaderWrapper isLoading={isLoading}>
        <div className="flex flex-row gap-4 flex-row-reverse items-start w-full">
          {matches && (
            <div className="w-1/3 space-y-8 border-r border-gray-200 shadow-lg p-4 rounded-lg">
              <HotelFilters
                selectedRating={rating}
                maxPrice={maxPrice}
                onPriceRangeChange={handlePriceChange}
                onSearchChange={() => {}}
                onRatingChange={handleRatingChange}
              />
            </div>
          )}
          <div className="w-full">
            <div className="grid grid-cols-1 gap-4 items-start">
              {filteredHotels.map((hotel) => {
                return (
                  <HotelCard
                    isSelected={hotel.id === selectedHotel?.id}
                    key={hotel.id}
                    hotel={hotel}
                    roomsInfo={hotelsInfo[hotel.id]}
                    handleSelect={handleSelect}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </LoaderWrapper>
    </div>
  );
};
