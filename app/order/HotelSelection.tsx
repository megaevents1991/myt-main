"use client";

import { Hotel, HotelResponse, HotelsInfoClient } from "@/lib/hotel.type";
import { Button, Popover, Skeleton } from "@mantine/core";
import { useState, useEffect, useContext } from "react";
import { OrderContext } from "../app.context";
import { DateRange } from "@/components/ui/dateInput";
import RoomsAndGuestsInput from "@/components/ui/roomsAndGuestsInput";
import { HotelCard } from "@/components/ui/hotelCard";
import { Search, Settings2Icon } from "lucide-react";
import { useMediaQuery } from "@mantine/hooks";
import { HotelFilters } from "@/components/ui/HotelFilters";
import { applyFiltersAndSorting } from "@/lib/hotelFilter";
import { FiltersModal } from "@/components/ui/FiltersModal";
import { SortOptionsContainer } from "@/components/ui/SortOptionsContainer";
import {
  Event,
  HotelSearchCriteria,
  OrderHotel,
  SortOptions,
} from "@/lib/app.types";
import dayjs from "dayjs";

export const HotelSelection = () => {
  const [showFilters, setShowFilters] = useState(false);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const {
    setHotel,
    planeTickets,
    hotel: selectedOrderHotel,
    event = {} as Event,
  } = useContext(OrderContext);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(new Date(event.date).getTime() - 2 * 8.64e7),
    new Date(new Date(event.date).getTime() + 8.64e7),
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [roomParams, setRoomParams] = useState<
    {
      adults: number;
      children: number[];
    }[]
  >([
    {
      children: [],
      adults: planeTickets.adults,
    },
  ]);
  const [filteredHotels, setFilteredHotels] = useState<Hotel[]>([]);
  const [maxPrice, setMaxPrice] = useState<number>(0);
  const [hotelsInfo, setHotelsInfo] = useState<HotelsInfoClient>(
    {} as HotelsInfoClient
  );
  const [rating, setRating] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);
  const [, setSortOption] = useState<SortOptions>("price_asc");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, maxPrice]);
  const matches = useMediaQuery("(min-width: 768px)");
  const [withMeal, setWithMeal] = useState(false);
  const [maxDistance, setMaxDistance] = useState(0);
  const [distanceRange, setDistanceRange] = useState<[number, number]>([
    0,
    maxDistance,
  ]);
  const [requestDebug, setRequestDebug] = useState(
    {} as HotelResponse["debug"]["request"]
  );

  useEffect(() => {
    fetchHotels();
  }, []);

  const fetchHotels = async (parameters?: { radius: number }) => {
    setIsLoading(true);
    setHotel(undefined);
    const res = await fetch(`/api/hotels`, {
      method: "POST",
      body: JSON.stringify({
        location: event.location,
        checkin: dateRange?.[0]?.toISOString().split("T")[0],
        checkout: dateRange?.[1]?.toISOString().split("T")[0],
        guests: roomParams,
        radius: parameters?.radius || distanceRange[1] || 1000,
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
      return { id: hotel.id, rooms };
    });

    const hotelsInfoRes = await fetch(`/api/hotels-info`, {
      method: "POST",
      body: JSON.stringify({
        hotels,
        event: {
          location: event.location,
        },
      }),
    });

    const hotelsInfo: HotelsInfoClient = await hotelsInfoRes.json();

    const maxDistance = Math.max(
      ...Object.values(hotelsInfo).map(
        (hotel) => hotel.metadata.distanceFromCenter
      )
    );

    const maxPrice = Math.max(
      ...data.data.hotels.map(
        (hotel) => +hotel.rates[0].payment_options.payment_types[0].show_amount
      )
    );
    setRequestDebug(data.debug.request);
    setMaxDistance(maxDistance);
    setDistanceRange([0, maxDistance]);
    setPriceRange([0, maxPrice]);
    setHotelsInfo(hotelsInfo);
    setMaxPrice(maxPrice);
    setHotels(data.data.hotels);
    setFilteredHotels(data.data.hotels);
    setIsLoading(false);
    setSelectedHotelId("");
  };

  const handleSearchCriteriaChange = ({ type, value }: HotelSearchCriteria) => {
    setHotel(undefined);

    switch (type) {
      case "rating":
        setRating(value);
        break;
      case "priceRange":
        setPriceRange(value);
        break;
      case "hotelName":
        if (showFilters) {
          setShowFilters(false);
        }
        break;
      case "withMeal":
        setWithMeal(value);
        break;
      case "sortOption":
        setSortOption(value);
        break;

      case "distanceFromCenter": {
        if (value[1] > maxDistance) {
          fetchHotels({ radius: value[1] });
          return;
        }
        setDistanceRange(value);
      }
      case "region":
        break;
    }

    const hotelsToSet = applyFiltersAndSorting({
      hotels,
      priceRange,
      rating,
      hotelsInfo,
      withMeal,
      distanceFromCenter: distanceRange,
      ...{ [type]: value },
    });

    setFilteredHotels(hotelsToSet);
  };

  const handleSelectedRate = (orderHotel: Omit<OrderHotel, "guests">) => {
    setHotel({ ...orderHotel, guests: requestDebug.guests });
  };

  const handleSetRooms = (room: {
    adults: number;
    children: number[];
    i: number;
  }) => {
    setRoomParams((prev) => {
      const next = [...prev];
      next[room.i] = { adults: room.adults, children: room.children };
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <FiltersModal show={showFilters} onClose={() => setShowFilters(false)}>
        <HotelFilters
          maxDistance={maxDistance}
          selectedRating={rating}
          maxPrice={maxPrice}
          onCriteriaChange={handleSearchCriteriaChange}
          withMeal={withMeal}
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
              {dayjs(event?.date).format("DD/MM/YY")} | {event?.location.name}
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
                    {`${roomParams.reduce(
                      (ppl, room) => ppl + room.children.length + room.adults,
                      0
                    )} אורחים`}
                    {` | `}
                    {`${roomParams.length} חדרים`}
                  </div>
                </Popover.Target>
                <Popover.Dropdown>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2 justify-end mt-2 mb-2 ">
                      <button
                        className="bg-secondary text-white px-2 rounded-md"
                        onClick={() =>
                          setRoomParams((prev) => [
                            ...prev,
                            { adults: 1, children: [] },
                          ])
                        }
                      >
                        הוסף חדר
                      </button>
                      <button
                        className="bg-secondary text-white px-2 rounded-md"
                        onClick={() =>
                          setRoomParams((prev) => {
                            if (prev.length === 1) return prev;
                            return prev.slice(0, prev.length - 1);
                          })
                        }
                      >
                        מחק חדר
                      </button>
                    </div>
                    {Array.from({ length: roomParams.length }, (_, i) => (
                      <RoomsAndGuestsInput
                        key={i}
                        initialChildren={roomParams[i].children}
                        initialAdults={roomParams[i].adults}
                        onChange={({ adults, children }) =>
                          handleSetRooms({ adults, children, i })
                        }
                      />
                    ))}
                  </div>
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
                onClick={() => fetchHotels()}
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
            <button
              className="font-bold"
              onClick={() =>
                handleSearchCriteriaChange({
                  value: "price_asc",
                  type: "sortOption",
                })
              }
            >
              מחיר
            </button>
            <button
              className="font-bold"
              onClick={() =>
                handleSearchCriteriaChange({
                  value: "rating",
                  type: "sortOption",
                })
              }
            >
              כוכבים
            </button>
          </>
        }
        settings={
          <button>
            <Settings2Icon onClick={() => setShowFilters(true)} />
          </button>
        }
      />
      <div className="flex flex-row gap-4 flex-row-reverse items-start w-full">
        {matches && (
          <div className="w-1/3 space-y-8 border-r border-gray-200 shadow-lg rounded-lg sticky top-0">
            <Skeleton visible={isLoading} className="p-4">
              <HotelFilters
                maxDistance={maxDistance}
                selectedRating={rating}
                maxPrice={maxPrice}
                onCriteriaChange={handleSearchCriteriaChange}
                withMeal={withMeal}
              />
            </Skeleton>
          </div>
        )}
        <div className="w-full">
          <div className="grid grid-cols-1 gap-4 items-start">
            {filteredHotels.map((hotel) => (
              <HotelCard
                isLoading={isLoading}
                distanceFromCenter={Math.ceil(
                  hotelsInfo[hotel.id].metadata.distanceFromCenter
                )}
                isSelected={hotel.id === selectedHotelId}
                key={hotel.id}
                hotelRates={hotel.rates}
                hotelInfo={hotelsInfo[hotel.id]}
                handleSelect={() => {
                  if (
                    selectedOrderHotel &&
                    selectedOrderHotel?.id !== hotel.id
                  ) {
                    setHotel(undefined);
                  }

                  setSelectedHotelId(hotel.id);
                }}
                handleSelectedRate={handleSelectedRate}
              />
            ))}
            {hotels.length === 0 &&
              isLoading &&
              Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex justify-center">
                  <Skeleton className="p-28" />
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
