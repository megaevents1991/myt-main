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
import { cn } from "@/lib/utils";

export const HotelSelection = () => {
  const {
    setHotel,
    planeTickets,
    flight,
    hotel: selectedOrderHotel,
    event = {} as Event,
  } = useContext(OrderContext);
  const [showFilters, setShowFilters] = useState(false);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(flight?.outbound?.arrivalTime ?? event.def_date_depart),
    new Date(flight?.inbound?.departureTime ?? event.def_date_return),
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [roomParams, setRoomParams] = useState<
    {
      adults: number;
      children: number[];
    }[]
  >(() => {
    const totalAdults = planeTickets.adults;
    const baseRoom = { children: [] };
    const rooms: Array<{ children: never[]; adults: number }> = [];

    // Maximum possible rooms with 3 adults
    const maxThreePersonRooms = Math.floor(totalAdults / 3);
    const remainingAdults = totalAdults % 3;

    // Distribute 3-person rooms
    for (let i = 0; i < maxThreePersonRooms; i++) {
      rooms.push({ ...baseRoom, adults: 3 });
    }

    // Handle remaining adults
    if (remainingAdults === 1 && rooms.length > 0) {
      // Convert one 3-person room to two 2-person rooms
      rooms.pop();
      rooms.push({ ...baseRoom, adults: 2 });
      rooms.push({ ...baseRoom, adults: 2 });
    } else if (remainingAdults === 2) {
      rooms.push({ ...baseRoom, adults: 2 });
    }

    return rooms;
  });

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
  const [sortOption, setSortOption] = useState<SortOptions>("price_asc");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, maxPrice]);
  const [withMeal, setWithMeal] = useState(false);
  const [maxDistance, setMaxDistance] = useState(0);
  const [distanceRange, setDistanceRange] = useState<[number, number]>([
    0,
    maxDistance,
  ]);
  const [requestDebug, setRequestDebug] = useState(
    {} as HotelResponse["debug"]["request"]
  );
  const [minPrice, setMinPrice] = useState({
    minPrice: 0,
    minDailyPrice: 0,
  });

  const matches = useMediaQuery("(min-width: 1024px)");

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

    let minPrice = Infinity;
    let minDailyPrice = 0;

    data.data.hotels.forEach((hotel) => {
      const price =
        +hotel.rates[0].payment_options.payment_types[0].show_amount;
      if (price < minPrice) {
        minPrice = price;
        minDailyPrice = +hotel.rates[0].daily_prices[0];
      }
    });

    setRequestDebug(data.debug.request);
    setMaxDistance(maxDistance);
    setDistanceRange([0, maxDistance]);
    setPriceRange([0, maxPrice]);
    setHotelsInfo(hotelsInfo);
    setMaxPrice(maxPrice);
    setHotels(data.data.hotels);
    setFilteredHotels(data.data.hotels);
    setIsLoading(false);
    setSelectedHotelId(data.data.hotels[0].id);
    setMinPrice({
      minPrice,
      minDailyPrice,
    });
    setHotel({
      address: hotelsInfo[data.data.hotels[0].id]?.metadata.address,
      guests: data.debug.request.guests,
      id: data.data.hotels[0].id || "",
      name: hotelsInfo[data.data.hotels[0].id].metadata.hotelName,
      price:
        data.data.hotels[0].rates[0].payment_options.payment_types[0]
          .show_amount,
      rate: data.data.hotels[0].rates[0],
    });
  };

  const handleSearchCriteriaChange = ({ type, value }: HotelSearchCriteria) => {
    switch (type) {
      case "rating":
        setHotel(undefined);
        setRating(value);
        break;
      case "priceRange":
        setHotel(undefined);
        setPriceRange(value);
        break;
      case "hotelName":
        if (showFilters) {
          setShowFilters(false);
        }
        break;
      case "withMeal":
        setHotel(undefined);
        setWithMeal(value);
        break;
      case "sortOption":
        setSortOption(value);
        break;

      case "distanceFromCenter": {
        setHotel(undefined);
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
          minPrice={minPrice.minPrice}
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
          className="w-screen gap-2 flex flex-col lg:flex-row justify-center p-4 bg-gray-200 items-center"
        >
          <div className="flex justify-between w-full max-w-7xl mx-auto gap-2 px-2 lg:px-6 flex-col lg:flex-row lg:gap-2">
            <div className="text-xs w-full lg:w-1/3 flex-col text-right">
              <div className="text-3xl font-bold pre mb-1">{event?.name}</div>
              <div className="whitespace-nowrap text-lg">
                {dayjs(event?.date).format("DD/MM/YY")} | {event?.location.name}
              </div>
            </div>
            <div className="flex w-full lg:w-2/3 flex-col gap-2 text-xs lg:flex-row">
              <div className="w-full lg:w-1/2">
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
              <div className="flex gap-2 flex-row lg:w-1/2">
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
      </div>
      <div
        className={cn(
          "flex flex-row gap-4 flex-row-reverse items-start w-full",
          !matches && "flex-col"
        )}
      >
        <div
          className={cn("w-1/3 space-y-4 sticky top-0", !matches && "w-full")}
        >
          <Skeleton visible={isLoading}>
            <SortOptionsContainer
              sortOptions={
                <div className="flex items-center border-2 border-gray-200 shadow-lg rounded-lg">
                  <button
                    className={cn(
                      "font-bold px-6 py-1 rounded-r-md",
                      sortOption === "price_asc" && "text-white bg-secondary"
                    )}
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
                    className={cn(
                      "font-bold px-6 py-1 rounded-l-md",
                      sortOption === "rating" && "text-white bg-secondary"
                    )}
                    onClick={() =>
                      handleSearchCriteriaChange({
                        value: "rating",
                        type: "sortOption",
                      })
                    }
                  >
                    כוכבים
                  </button>
                </div>
              }
              settings={
                <button className="flex items-center border-2 p-2 border-gray-200 shadow-lg rounded-lg">
                  <Settings2Icon onClick={() => setShowFilters(true)} />
                </button>
              }
            />
          </Skeleton>
          {matches && (
            <Skeleton visible={isLoading}>
              <HotelFilters
                minPrice={minPrice.minPrice}
                maxDistance={maxDistance}
                selectedRating={rating}
                maxPrice={maxPrice}
                onCriteriaChange={handleSearchCriteriaChange}
                withMeal={withMeal}
              />
            </Skeleton>
          )}
        </div>
        <div className="w-full">
          <div className="grid grid-cols-1 gap-4 items-start">
            {filteredHotels.map((hotel) => (
              <HotelCard
                minPrice={minPrice}
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
