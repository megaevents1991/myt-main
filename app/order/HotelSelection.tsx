"use client";

import { Hotel, HotelInfoClient, HotelKind } from "@/lib/hotel.type";
import { Popover, ScrollArea, Skeleton } from "@mantine/core";
import {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
  useTransition,
  useRef,
  useLayoutEffect,
} from "react";
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
import { cn } from "@/lib/utils";
import { EventDataHeader } from "@/components/ui/EventDataHeader";
import { getTotalPersons } from "@/lib/price.utils";
import { logger } from "@/lib/logger";
import { HotelFetchContext, HotelsData } from "../HotelFetch.provider";
import { getDefaultDateRange } from "@/lib/getDefaultDateRange";
import { getRoomParams } from "@/lib/getRoomParams";

export const HotelSelection = () => {
  const {
    setHotel,
    planeTickets,
    flight,
    event = {} as Event,
    setSelectedHotelFilters,
  } = useContext(OrderContext);
  const { getHotels, hotelsData, isFetching } = useContext(HotelFetchContext);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(
    getDefaultDateRange(event, flight)
  );
  const [roomParams, setRoomParams] = useState<
    {
      adults: number;
      children: number[];
    }[]
  >(getRoomParams(planeTickets?.adults));

  const [filteredHotels, setFilteredHotels] = useState<Hotel[]>([]);
  const [maxPrice, setMaxPrice] = useState<number>(0);
  const [rating, setRating] = useState<boolean[]>([
    false,
    false,
    true,
    true,
    true,
  ]);
  const [sortOption, setSortOption] = useState<SortOptions>("price_asc");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, maxPrice]);
  const [meal, setMeal] = useState<("withMeal" | "withoutMeal")[]>([
    "withoutMeal",
  ]);
  const [kind, setKind] = useState<HotelKind[]>(["Hotel"]);
  const [scrollerHeight, setScrollerHeight] = useState(600);
  const [maxDistance, setMaxDistance] = useState(0);
  const [distanceRange, setDistanceRange] = useState<[number, number]>([
    0,
    maxDistance,
  ]);
  const [minPrice, setMinPrice] = useState(0);
  const [basePricePerPerson, setBasePricePerPerson] = useState(0);
  const [freeCancellation, setFreeCancellation] = useState<
    ("withFreeCancellation" | "withoutFreeCancellation")[]
  >(["withFreeCancellation"]);
  const [prevDateRange, setPrevDateRange] = useState<
    [Date | null, Date | null]
  >(getDefaultDateRange(event, flight));
  const [, startTransition] = useTransition();
  const [isProcessingHotels, setIsProcessingHotels] = useState(false);

  const matches = useMediaQuery("(min-width: 1024px)");

  const filterRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (filterRef.current && matches) {
      setScrollerHeight(filterRef.current.offsetHeight);
    } else if (!matches) {
      setScrollerHeight(600);
    }
  }, [matches, hotelsData]);

  useEffect(() => {
    setSelectedHotelFilters({});
  }, []);
  useEffect(() => {
    if (hotelsData.data.debug && !isFetching) {
      setIsProcessingHotels(true);
      startTransition(() => {
        prepareHotelData(hotelsData);
        setIsProcessingHotels(false);
      });
    } else if (!hotelsData.data.debug) {
      // Reset processing state if no data
      setIsProcessingHotels(false);
    }
  }, [isFetching]);

  useEffect(() => {
    if (matches) return; // Don't scroll on desktop (1024px+)
    const timer = setTimeout(() => {
      window.scrollTo({
        top: 90,
        behavior: "smooth",
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [matches]); // Add matches as dependency

  useEffect(() => {
    if (!flight?.outbound?.arrivalTime || !flight?.inbound?.departureTime) {
      logger.error({
        description: "Missing flight dates",
        outbound: flight?.outbound?.arrivalTime,
        inbound: flight?.inbound?.departureTime,
      });
    }
  }, []);
  const prepareHotelData = ({ hotelsInfo, data }: HotelsData) => {
    // Calculate all values first
    const maxDistance = Math.max(
      ...Object.values(hotelsInfo).map(
        (hotel) => hotel.metadata?.distanceFromCenter
      )
    );

    const totalPersons = getTotalPersons(data.debug.request.guests);

    const maxPrice = Math.max(
      ...data.data.hotels.map(
        (hotel) =>
          +hotel.rates[hotel.rates.length - 1].payment_options?.payment_types[0]
            .show_amount
      )
    );

    const minPrice = Math.min(
      ...data.data.hotels.map(
        (hotel) =>
          +hotel.rates[0].payment_options?.payment_types[0]?.show_amount
      )
    );

    const basePricePerPerson = event.base_hotel_price;

    const hotelsToSet = applyFiltersAndSorting({
      hotels: data.data.hotels,
      priceRange: [0, maxPrice],
      rating,
      hotelsInfo,
      meal,
      kind,
      freeCancellation,
      distanceFromCenter: [0, maxDistance],
    });

    const hotelInformation = {
      hotelName: hotelsInfo[0]?.metadata?.hotelName,
      roomName: hotelsInfo[0]?.rooms[0]?.name,
      stars: hotelsInfo[0]?.metadata?.rating,
      amenities: hotelsInfo[0]?.general?.amenities,
      distance: hotelsInfo[0]?.metadata?.distanceFromCenter,
    };

    // Batch all state updates together using React's automatic batching
    const selectedHotelId = hotelsToSet[0].id;

    setBasePricePerPerson(basePricePerPerson);
    setMaxDistance(maxDistance);
    setDistanceRange([0, maxDistance]);
    setPriceRange([0, Math.ceil(maxPrice)]);
    setMaxPrice(maxPrice / totalPersons);
    setFilteredHotels(hotelsToSet.slice(0, 50));
    setSelectedHotelId(selectedHotelId);
    setMinPrice(Math.floor(minPrice / totalPersons));

    // Set hotel last as it depends on the selectedHotelId
    setHotel({
      address: hotelsInfo[selectedHotelId]?.metadata.address,
      guests: data.debug.request.guests,
      id: selectedHotelId || "",
      name: hotelsInfo[selectedHotelId].metadata.hotelName,
      hotelInformation,
      price:
        hotelsToSet[0].rates[0].payment_options?.payment_types[0]?.show_amount,
      rate: hotelsToSet[0].rates[0],
      checkin: data.debug.request.checkin,
      checkout: data.debug.request.checkout,
    });
  };

  const fetchHotels = async (parameters?: { radius: number }) => {
    setHotel(undefined);

    await getHotels({
      dateRange,
      location: event.location,
      guests: roomParams,
      radius: parameters?.radius || distanceRange[1] || 2000,
    });
  };

  const hotelKinds: HotelKind[] = useMemo(
    () =>
      Array.from(
        new Set(
          Object.values(hotelsData.hotelsInfo)
            .map((hotel: HotelInfoClient) => hotel.metadata?.kind)
            .filter(
              (kind) =>
                ![
                  "Glamping",
                  "Farm",
                  "Castle",
                  "Sanatorium",
                  "Guesthouse",
                ].includes(kind)
            )
        )
      ),
    [hotelsData.hotelsInfo]
  );

  const handleSearchCriteriaChange = ({ type, value }: HotelSearchCriteria) => {
    let filterValue = value;

    setSelectedHotelFilters((prev) => ({
      ...prev,
      [type]: value,
    }));

    switch (type) {
      case "freeCancellation": {
        setFreeCancellation(value);
        break;
      }
      case "rating":
        setRating(value);
        break;
      case "priceRange":
        const persons = getTotalPersons(
          hotelsData?.data?.debug?.request?.guests
        );
        filterValue = value.map((price) => price * persons) as [number, number];
        setPriceRange(filterValue);
        break;
      case "hotelName":
        if (showFilters) {
          setShowFilters(false);
        }
        break;
      case "meal":
        setMeal(value);
        break;
      case "kind":
        setKind(value);
        break;
      case "sortOption":
        setSortOption(value);
        break;
      case "distanceFromCenter": {
        if (value[1] > maxDistance + 100) {
          fetchHotels({ radius: value[1] });
          return;
        }
        setDistanceRange(value);
      }
      case "region":
        break;
    }

    startTransition(() => {
      const hotelsToSet = applyFiltersAndSorting({
        hotels: hotelsData.data.data.hotels,
        priceRange,
        rating,
        hotelsInfo: hotelsData.hotelsInfo,
        meal,
        kind,
        freeCancellation,
        distanceFromCenter: distanceRange,
        ...{ [type]: filterValue },
      });

      if (hotelsToSet.length === 0) {
        setSelectedHotelId("");
        setHotel(undefined);
      }

      if (
        type !== "sortOption" &&
        type !== "hotelName" &&
        hotelsToSet?.[0]?.id
      ) {
        setSelectedHotelId(hotelsToSet[0].id);
      }

      setFilteredHotels(hotelsToSet.slice(0, 50));
    });
  };
  const handleSelectedRate = useCallback(
    (orderHotel: Omit<OrderHotel, "guests" | "checkin" | "checkout">) => {
      const hotelInformation = {
        hotelName: hotelsData.hotelsInfo[orderHotel?.id]?.metadata?.hotelName,
        roomName: hotelsData.hotelsInfo[orderHotel?.id]?.rooms[0]?.name,
        stars: hotelsData.hotelsInfo[orderHotel?.id]?.metadata?.rating,
        amenities: hotelsData.hotelsInfo[orderHotel?.id]?.general?.amenities,
        distance:
          hotelsData.hotelsInfo[orderHotel?.id]?.metadata?.distanceFromCenter,
      };
      setHotel({
        ...orderHotel,
        hotelInformation,
        guests: hotelsData?.data?.debug?.request?.guests,
        checkin: hotelsData?.data?.debug?.request?.checkin,
        checkout: hotelsData?.data?.debug?.request?.checkout,
      });
    },
    [hotelsData, setHotel]
  );

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

  const handleRoomRemove = (i: number) => {
    setRoomParams((prev) => {
      if (prev.length === 1) return prev;
      return [...prev.slice(0, i), ...prev.slice(i + 1)];
    });
  };

  const handleDatePopoverClose = () => {
    // Handle empty date case as before
    if (!dateRange[0] || !dateRange[1]) {
      const defaultDates = getDefaultDateRange(event, flight);
      setDateRange(defaultDates);
      setPrevDateRange(defaultDates);
      fetchHotels();
      return;
    }

    // Check if dates have actually changed
    const datesChanged =
      !prevDateRange[0] ||
      !prevDateRange[1] ||
      prevDateRange[0].getTime() !== dateRange[0].getTime() ||
      prevDateRange[1].getTime() !== dateRange[1].getTime();

    // Only fetch hotels if dates have changed
    if (datesChanged) {
      setPrevDateRange([dateRange[0], dateRange[1]]);
      fetchHotels();
    }
  };

  const hotelCards = useMemo(
    () =>
      filteredHotels.map(
        (hotel) =>
          hotelsData.hotelsInfo[hotel.id] && (
            <HotelCard
              persons={getTotalPersons(
                hotelsData?.data?.debug?.request?.guests || []
              )}
              minPrice={basePricePerPerson}
              isLoading={isFetching}
              selectedHotelId={selectedHotelId}
              hotelId={hotel.id}
              key={hotel.id}
              hotelRates={hotel.rates}
              hotelInfo={hotelsData.hotelsInfo[hotel.id]}
              handleSelect={() => setSelectedHotelId(hotel.id)}
              handleSelectedRate={handleSelectedRate}
            />
          )
      ),
    [
      filteredHotels,
      hotelsData.hotelsInfo,
      hotelsData?.data?.debug?.request?.guests,
      basePricePerPerson,
      isFetching,
      selectedHotelId,
      handleSelectedRate,
    ]
  );

  return (
    <div className="space-y-2 lg:space-y-6">
      <FiltersModal show={showFilters} onClose={() => setShowFilters(false)}>
        <HotelFilters
          basePrice={basePricePerPerson}
          minPrice={Math.min(minPrice, basePricePerPerson)}
          maxDistance={maxDistance}
          selectedRating={rating}
          maxPrice={maxPrice}
          freeCancellation={freeCancellation}
          onCriteriaChange={handleSearchCriteriaChange}
          meal={meal}
          kind={kind}
          hotelKindOptions={hotelKinds}
        />
      </FiltersModal>
      <div className="flex flex-col w-full items-center">
        <div
          dir="rtl"
          className="w-screen gap-2 flex flex-col lg:flex-row justify-center px-4 py-2 lg:p-4 bg-gray-200 items-center"
        >
          <div className="flex items-center justify-between w-full max-w-7xl mx-auto gap-2 px-2 lg:px-6 flex-col lg:flex-row lg:gap-2">
            <EventDataHeader event={event} />
            <div className="flex w-full lg:w-[60%] justify-start lg:justify-center flex-row gap-2 text-xs items-center margin-auto">
              {matches && (
                <span className="text-center text-xl">כמה תהיו?</span>
              )}

              <div className="w-fit">
                <Popover
                  width={300}
                  trapFocus
                  position="bottom"
                  shadow="md"
                  keepMounted={false}
                >
                  <Popover.Target>
                    <div className="w-full p-3 text-center bg-white rounded-lg border border-gray-300 text-[1rem] cursor-pointer">
                      <span className="whitespace-nowrap">
                        {" "}
                        {`${getTotalPersons(roomParams)} אורחים`}
                      </span>
                      {matches && roomParams.length > 1 && (
                        <span>
                          {` | `}
                          {`${roomParams.length} חדרים`}
                        </span>
                      )}
                    </div>
                  </Popover.Target>
                  <Popover.Dropdown>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2 justify-end mt-2 mb-2 "></div>
                      {Array.from({ length: roomParams.length }, (_, i) => (
                        <div key={`${i}_${roomParams[i].adults}`}>
                          {i > 0 && (
                            <button
                              className="text-[red] px-2 w-full text-right"
                              onClick={() => handleRoomRemove(i)}
                            >
                              מחק חדר
                            </button>
                          )}
                          <RoomsAndGuestsInput
                            initialChildren={roomParams[i].children}
                            initialAdults={roomParams[i].adults}
                            onChange={({ adults, children }) =>
                              handleSetRooms({ adults, children, i })
                            }
                          />
                        </div>
                      ))}
                      <button
                        className="text-secondary px-2 text-left"
                        onClick={() =>
                          setRoomParams((prev) => [
                            ...prev,
                            { adults: 1, children: [] },
                          ])
                        }
                      >
                        +הוסף חדר
                      </button>
                    </div>
                  </Popover.Dropdown>
                </Popover>
              </div>
              {matches && (
                <span className="mr-6 text-center text-xl">
                  ובאיזה תאריכים?
                </span>
              )}

              <div className="flex flex-row w-min items-center">
                <DateRange
                  disabled={isFetching}
                  onPopoverClose={handleDatePopoverClose}
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  eventDay={event?.date}
                />
                <button
                  disabled={isFetching}
                  onClick={() => fetchHotels()}
                  className="p-2 px-4 bg-secondary text-white rounded-l-lg h-[40px] flex items-center justify-center r"
                >
                  <Search size={24} />
                </button>
              </div>
            </div>
            <div className="w-[15%]"></div>
          </div>
        </div>
      </div>
      <div
        className={cn(
          "flex flex-row lg:gap-4 gap-2 flex-row-reverse items-start w-full",
          !matches && "flex-col"
        )}
      >
        <div
          className={cn(
            "w-1/4 space-y-4 ",
            !matches ? "w-full" : "sticky top-0"
          )}
          ref={filterRef}
        >
          {" "}
          <Skeleton visible={isFetching || isProcessingHotels}>
            <SortOptionsContainer
              sortOptions={
                <div className="flex items-center border-2 border-gray-200 shadow-lg rounded-lg">
                  <button
                    className={cn(
                      "font-bold px-6 py-1 rounded-r-md",
                      sortOption === "price_asc" && "text-white bg-main"
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
                      sortOption === "rating" && "text-white bg-main"
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
            <Skeleton visible={isFetching || isProcessingHotels}>
              <HotelFilters
                freeCancellation={freeCancellation}
                basePrice={basePricePerPerson}
                minPrice={Math.min(minPrice, basePricePerPerson)}
                maxDistance={maxDistance}
                selectedRating={rating}
                maxPrice={maxPrice}
                onCriteriaChange={handleSearchCriteriaChange}
                meal={meal}
                kind={kind}
                hotelKindOptions={hotelKinds}
              />
            </Skeleton>
          )}
        </div>{" "}
        <ScrollArea.Autosize mah={scrollerHeight} className="w-full lg:w-3/4">
          <div className="grid grid-cols-1 py-4 lg:py-0 lg:gap-4 gap-6 items-start">
            {isProcessingHotels || isFetching
              ? // Show skeletons while processing or fetching
                Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="flex justify-center">
                    <Skeleton className="p-28" />
                  </div>
                ))
              : // Show actual hotel cards when ready
                hotelCards}
            {!hotelsData.data?.data?.hotels?.length &&
              !isProcessingHotels &&
              !isFetching && (
                <div className="text-center w-full items-center text-gray-500 min-h-64 flex">
                  No hotels found. Please adjust your search criteria.
                </div>
              )}
          </div>
        </ScrollArea.Autosize>
      </div>
    </div>
  );
};
