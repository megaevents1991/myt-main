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
import { Search, SlidersHorizontal, DollarSign, Star, MapPin } from "lucide-react";
import { useMediaQuery } from "@mantine/hooks";
import { HotelFilters } from "@/components/ui/HotelFilters";
import { applyFiltersAndSorting } from "@/lib/hotelFilter";
import { FiltersModal } from "@/components/ui/FiltersModal";
import {
  Event,
  HotelSearchCriteria,
  OrderHotel,
  SortOptions,
} from "@/lib/app.types";
import { cn } from "@/lib/utils";
import { EventDataHeader } from "@/components/ui/EventDataHeader";
import { getTotalPersons } from "@/lib/price.utils";
import { HotelFetchContext, HotelsData } from "../hooks/HotelFetch.provider";
import { getDefaultDateRange } from "@/lib/getDefaultDateRange";
import { getRoomParams } from "@/lib/getRoomParams";
import { FlightLoadingTransition } from "@/components/ui/FlightLoadingTransition";
import dayjs from "dayjs";

export const HotelSelection = () => {
  const {
    setHotel,
    planeTickets,
    flight,
    event = {} as Event,
    setSelectedHotelFilters,
    setSkipHotel,
    flightSkipped,
    numberOfEventTickets,
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
    // Hotel party size follows the flight traveler count (planeTickets.adults),
    // which is itself synced to the number of booked tickets at ticket
    // selection. tickets → flight → hotel, one consistent headcount.
    // Fall back to the ticket count when planeTickets isn't set yet (skip-flight
    // / US / direct-to-hotel) — otherwise getRoomParams(undefined) returns [],
    // collapsing the per-person divisor to 1 and showing the full room price
    // (e.g. 940) as the per-traveler price instead of 470.
  >(getRoomParams(planeTickets?.adults || numberOfEventTickets || 1));

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
  const [hotelNameFilter, setHotelNameFilter] = useState("");
  const [userInteracted, setUserInteracted] = useState(false);

  // Offline hotels — fetched from /api/offline-hotels and merged into the main
  // WorldOTA-style list so they render through the exact same <HotelCard>.
  type OfflineMeta = {
    offlineId: number;
    offlineIds: number[];
    checkin: string;
    checkout: string;
    numRooms: number;
    consumed: number;
    available: number;
    mealPlan: string | null;
    rawPrice: number;
    notes: string | null;
  };
  const [offlineHotels, setOfflineHotels] = useState<Hotel[]>([]);
  const [offlineHotelsInfo, setOfflineHotelsInfo] = useState<
    Record<string, HotelInfoClient>
  >({});
  const [offlineMeta, setOfflineMeta] = useState<Record<string, OfflineMeta>>({});
  const [offlineLoading, setOfflineLoading] = useState(true);

  // Serialize roomParams so the effect re-runs when the customer changes their
  // room/guest config — needed because the API now filters by room capacity.
  const roomParamsKey = useMemo(
    () => JSON.stringify(roomParams),
    [roomParams]
  );

  // Correct a stale online hotel search. An early preload (OrderForm, on event
  // load) fetches hotels with the default 2 guests — before the customer's real
  // party size is known — and a stale-cache guard then blocks later refetches.
  // If the cached search's guest count doesn't match the current party size,
  // refetch once so prices, room capacity, and the selected hotel reflect the
  // real headcount (this drove the "hotel only for 2" under-booking bug).
  const guestCorrectedRef = useRef<string | null>(null);
  const cachedGuestCount = getTotalPersons(
    hotelsData?.data?.debug?.request?.guests || []
  );
  useEffect(() => {
    if (event?.location?.country_code === "US") return;
    const wantedGuests = getTotalPersons(roomParams);
    if (!wantedGuests) return;
    const hasHotels = !!hotelsData?.data?.data?.hotels;
    if (hasHotels && cachedGuestCount === wantedGuests) {
      guestCorrectedRef.current = roomParamsKey;
      return;
    }
    // Only auto-correct once per party-size config to avoid a refetch loop if
    // the API ever normalizes the guest array differently than requested.
    if (guestCorrectedRef.current === roomParamsKey) return;
    guestCorrectedRef.current = roomParamsKey;
    getHotels(
      {
        dateRange,
        location: event.location,
        guests: roomParams,
        radius: distanceRange[1] || 2000,
        eventId: event.id,
      },
      { immediate: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedGuestCount, roomParamsKey]);

  useEffect(() => {
    if (!event?.id) return;
    if (!dateRange[0] || !dateRange[1]) return;
    const checkin = dayjs(dateRange[0]).format("YYYY-MM-DD");
    const checkout = dayjs(dateRange[1]).format("YYYY-MM-DD");
    setOfflineLoading(true);
    fetch(
      `/api/offline-hotels?eventId=${event.id}&checkin=${checkin}&checkout=${checkout}&rooms=${encodeURIComponent(
        roomParamsKey
      )}`
    )
      .then((res) => res.json())
      .then(
        (data: {
          hotels: Hotel[];
          hotelsInfo: Record<string, HotelInfoClient>;
          meta: Record<string, OfflineMeta>;
        }) => {
          setOfflineHotels(data.hotels || []);
          setOfflineHotelsInfo(data.hotelsInfo || {});
          setOfflineMeta(data.meta || {});
        }
      )
      .catch(console.error)
      .finally(() => setOfflineLoading(false));
  }, [event?.id, dateRange, roomParamsKey]);

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
    // Reset skipHotel flag when entering hotel selection to allow user to change their mind
    setSkipHotel(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [matches]);

  const prepareHotelData = ({ hotelsInfo, data }: HotelsData) => {
    const DEFAULT_RATING: boolean[] = [false, false, true, true, true];
    const DEFAULT_KIND: HotelKind[] = ["Hotel"];
    const MIN_DEFAULT_MATCHES_BEFORE_RELAX = 5;

    const arraysEqual = <T,>(a: T[], b: T[]) =>
      a.length === b.length && a.every((value, index) => value === b[index]);

    // Calculate all values first
    let maxDistance = Math.max(
      ...Object.values(hotelsInfo).map(
        (hotel) => hotel.metadata?.distanceFromCenter
      )
    );

    let distanceRangeToSet: [number, number] = [0, maxDistance];

    if (event?.location?.country_code === "US") {
      maxDistance = 5000;
      distanceRangeToSet = [0, 3500];
    }

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

    const defaultFilteredHotels = applyFiltersAndSorting({
      hotels: data.data.hotels,
      priceRange: [0, maxPrice],
      rating,
      hotelsInfo,
      meal,
      kind,
      freeCancellation,
      distanceFromCenter: distanceRangeToSet,
    });

    // If default filters are too restrictive (e.g. < 5 hotels), relax ONLY the
    // default star rating + hospitality kind to show more options.
    let hotelsToSet = defaultFilteredHotels;
    let ratingToSet = rating;
    let kindToSet = kind;

    const shouldRelaxDefaults =
      hotelsToSet.length < MIN_DEFAULT_MATCHES_BEFORE_RELAX &&
      arraysEqual(rating, DEFAULT_RATING) &&
      arraysEqual(kind, DEFAULT_KIND);

    if (shouldRelaxDefaults) {
      const allKinds = Array.from(
        new Set(
          Object.values(hotelsInfo)
            .map((hotel) => hotel.metadata?.kind)
            .filter(Boolean)
        )
      ) as HotelKind[];

      ratingToSet = [true, true, true, true, true];
      kindToSet = allKinds.length ? allKinds : kind;

      hotelsToSet = applyFiltersAndSorting({
        hotels: data.data.hotels,
        priceRange: [0, maxPrice],
        rating: ratingToSet,
        hotelsInfo,
        meal,
        kind: kindToSet,
        freeCancellation,
        distanceFromCenter: distanceRangeToSet,
      });
    }

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
    setDistanceRange(distanceRangeToSet);
    setPriceRange([0, Math.ceil(maxPrice)]);
    setMaxPrice(maxPrice / totalPersons);
    setFilteredHotels(hotelsToSet.slice(0, 50));
    setSelectedHotelId(selectedHotelId);
    setMinPrice(Math.floor(minPrice / totalPersons));

    if (shouldRelaxDefaults) {
      setRating(ratingToSet);
      setKind(kindToSet);
      setSelectedHotelFilters((prev) => ({
        ...prev,
        rating: ratingToSet,
        kind: kindToSet,
      }));
    }

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
      eventId: event.id,
    });
  };

  const hotelKinds: HotelKind[] = useMemo(
    () =>
      Array.from(
        new Set(
          Object.values(hotelsData.hotelsInfo)
            .map((hotel: HotelInfoClient) => hotel.metadata?.kind)
            .filter(Boolean)
        )
      ),
    [hotelsData.hotelsInfo]
  );

  const handleSearchCriteriaChange = ({ type, value }: HotelSearchCriteria) => {
    let filterValue = value;

    setUserInteracted(true);

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
        setHotelNameFilter(value);
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
      const combinedHotels = [
        ...hotelsData.data.data.hotels,
        ...offlineHotels,
      ];
      const combinedHotelsInfoForFilter = {
        ...hotelsData.hotelsInfo,
        ...offlineHotelsInfo,
      };
      const hotelsToSet = applyFiltersAndSorting({
        hotels: combinedHotels,
        priceRange,
        rating,
        hotelsInfo: combinedHotelsInfoForFilter,
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
      const isOffline = orderHotel.id.startsWith("offline-");
      const info = isOffline
        ? offlineHotelsInfo[orderHotel.id]
        : hotelsData.hotelsInfo[orderHotel?.id];

      const hotelInformation = {
        hotelName: info?.metadata?.hotelName,
        roomName: info?.rooms[Object.keys(info?.rooms || {})[0]]?.name || "",
        stars: info?.metadata?.rating,
        amenities: info?.general?.amenities,
        distance: info?.metadata?.distanceFromCenter,
      };

      const meta = isOffline ? offlineMeta[orderHotel.id] : null;

      // Offline hotels carry the inventory row's own fixed check_in/check_out
      // (exact-matched to the flight by /api/offline-hotels). The order stores
      // those real dates so it never silently diverges from the held block.
      // Online hotels get flight-aligned dates via the WorldOTA search request.
      setHotel({
        ...orderHotel,
        hotelInformation,
        guests: meta ? roomParams : hotelsData?.data?.debug?.request?.guests,
        checkin: isOffline
          ? meta?.checkin ?? ""
          : hotelsData?.data?.debug?.request?.checkin,
        checkout: isOffline
          ? meta?.checkout ?? ""
          : hotelsData?.data?.debug?.request?.checkout,
        ...(isOffline && meta && {
          isOffline: true,
          offlineId: meta.offlineId,
          offlineIds: meta.offlineIds,
          offlineRawPrice: meta.rawPrice,
        }),
      });
    },
    [hotelsData, offlineHotelsInfo, offlineMeta, roomParams, setHotel]
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

  // Total pax across requested rooms — used as the HotelCard `persons` divisor
  // for offline hotels so the supplement math matches the online pipeline:
  //   perPerson = show_amount / persons
  //   supplement = perPerson - event.base_hotel_price
  const totalPersons = useMemo(
    () =>
      roomParams.reduce(
        (sum, r) => sum + r.adults + r.children.length,
        0
      ) ||
      numberOfEventTickets ||
      1,
    [roomParams, numberOfEventTickets]
  );

  const displayHotels = useMemo(() => {
    if (userInteracted) {
      return filteredHotels;
    }
    const online = filteredHotels.filter((h) => !h.isOffline);
    const nameQuery = hotelNameFilter.trim().toUpperCase();
    const offline = nameQuery
      ? offlineHotels.filter((h) =>
          offlineHotelsInfo[h.id]?.metadata?.hotelName
            ?.toUpperCase()
            .includes(nameQuery)
        )
      : offlineHotels;
    return [...offline, ...online];
  }, [
    userInteracted,
    offlineHotels,
    offlineHotelsInfo,
    filteredHotels,
    hotelNameFilter,
  ]);

  const mergedHotelsInfo = useMemo(
    () => ({ ...hotelsData.hotelsInfo, ...offlineHotelsInfo }),
    [hotelsData.hotelsInfo, offlineHotelsInfo]
  );

  const hotelNames = useMemo(
    () =>
      Array.from(
        new Set(
          Object.values(mergedHotelsInfo)
            .map((h) => h?.metadata?.hotelName)
            .filter((name): name is string => !!name)
        )
      ),
    [mergedHotelsInfo]
  );

  // Default-select the cheapest offline hotel once it loads (and nothing is selected yet)
  useEffect(() => {
    if (
      offlineHotels.length > 0 &&
      (!selectedHotelId || !mergedHotelsInfo[selectedHotelId])
    ) {
      const first = offlineHotels[0];
      setSelectedHotelId(first.id);
      handleSelectedRate({
        rate: first.rates[0],
        hotelInformation: {
          hotelName:
            offlineHotelsInfo[first.id]?.metadata?.hotelName || "",
          roomName: first.rates[0].room_data_trans.main_name,
          stars: offlineHotelsInfo[first.id]?.metadata?.rating || 0,
          amenities:
            offlineHotelsInfo[first.id]?.general?.amenities || [],
          distance:
            offlineHotelsInfo[first.id]?.metadata?.distanceFromCenter || 0,
        },
        address: offlineHotelsInfo[first.id]?.metadata?.address || "",
        name: offlineHotelsInfo[first.id]?.metadata?.hotelName || "",
        id: first.id,
        price: first.rates[0].payment_options.payment_types[0].show_amount,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineHotels]);

  const hotelCards = useMemo(
    () =>
      displayHotels.map(
        (hotel) =>
          mergedHotelsInfo[hotel.id] && (
            <HotelCard
              persons={
                hotel.isOffline
                  ? totalPersons
                  : getTotalPersons(
                      hotelsData?.data?.debug?.request?.guests || []
                    )
              }
              minPrice={basePricePerPerson}
              isLoading={isFetching}
              selectedHotelId={selectedHotelId}
              hotelId={hotel.id}
              key={hotel.id}
              hotelRates={hotel.rates}
              hotelInfo={mergedHotelsInfo[hotel.id]}
              handleSelect={() => setSelectedHotelId(hotel.id)}
              handleSelectedRate={handleSelectedRate}
              isPromoted={hotel.isOffline}
            />
          )
      ),
    [
      displayHotels,
      mergedHotelsInfo,
      hotelsData?.data?.debug?.request?.guests,
      totalPersons,
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
          hotelNames={hotelNames}
          onApply={() => setShowFilters(false)}
        />
      </FiltersModal>
      <div className="flex flex-col w-full items-center">
        <div
          dir="rtl"
          className="w-screen gap-2 flex flex-col lg:flex-row justify-center px-4 py-2 lg:p-4 bg-muted items-center"
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
                    <div className="w-full p-3 text-center bg-card rounded-lg border border-border text-[1rem] cursor-pointer">
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
                              type="button"
                              aria-label={`מחק חדר ${i + 1}`}
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
                        className="text-success px-2 text-left"
                        onClick={() =>
                          setRoomParams((prev) => [
                            ...prev,
                            { adults: 1, children: [] },
                          ])
                        }
                        type="button"
                        aria-label="הוסף חדר נוסף"
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
                  className="p-2 px-4 bg-main text-main-foreground rounded-l-lg h-[40px] flex items-center justify-center r"
                  type="button"
                  aria-label="חפש מלונות"
                >
                  <Search size={24} />
                </button>
              </div>
            </div>
            <div className="w-[15%]"></div>
          </div>
        </div>
      </div>
      <div dir="rtl" className="px-4 lg:px-6">
        <Skeleton visible={isFetching || isProcessingHotels}>
          {/* Desktop: 3 cards in a row */}
          <div
            className="hidden lg:grid lg:grid-cols-3 gap-3"
            role="tablist"
            aria-label="מיון מלונות"
          >
            {([
              { key: "price_asc" as const, title: "הזול ביותר", sub: "המחיר הנמוך ביותר", Icon: DollarSign },
              { key: "rating" as const, title: "כוכבים", sub: "הדירוג הגבוה ביותר", Icon: Star },
              { key: "distance_asc" as const, title: "הקרוב ביותר", sub: "הקרוב למרכז העיר", Icon: MapPin },
            ]).map(({ key, title, sub, Icon }) => {
              const isActive = sortOption === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() =>
                    handleSearchCriteriaChange({
                      value: key,
                      type: "sortOption",
                    })
                  }
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md border-[1.5px] text-right transition-colors outline-none",
                    isActive
                      ? "border-main bg-main/10 dark:border-foreground/40"
                      : "border-border bg-card hover:border-main"
                  )}
                >
                  <span
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                      isActive ? "bg-main dark:bg-foreground" : "bg-muted"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-[18px] h-[18px] transition-colors",
                        isActive ? "text-white dark:text-background" : "text-muted-foreground"
                      )}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="flex flex-col items-end flex-1 min-w-0">
                    <span className="font-bold text-sm text-foreground">{title}</span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">{sub}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mobile: filter icon + 3 sort pills in one row */}
          <div className="flex lg:hidden items-stretch gap-1.5 w-full">
            <button
              type="button"
              aria-label="פתח פילטרים"
              onClick={() => setShowFilters(true)}
              className="w-[38px] flex-shrink-0 bg-card border border-border rounded-md flex items-center justify-center hover:border-success hover:bg-success/10 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4 text-foreground" strokeWidth={1.8} aria-hidden="true" />
            </button>
            <div
              role="tablist"
              aria-label="מיון מלונות"
              className="flex-1 flex bg-card border border-border rounded-md p-[3px] gap-[2px] min-w-0"
            >
              {([
                { key: "price_asc" as const, label: "הזול ביותר", Icon: DollarSign },
                { key: "rating" as const, label: "כוכבים", Icon: Star },
                { key: "distance_asc" as const, label: "הקרוב ביותר", Icon: MapPin },
              ]).map(({ key, label, Icon }) => {
                const isActive = sortOption === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() =>
                      handleSearchCriteriaChange({
                        value: key,
                        type: "sortOption",
                      })
                    }
                    className={cn(
                      "flex-1 px-1 py-2 rounded flex flex-col items-center justify-center gap-1 leading-tight min-w-0 transition-colors",
                      isActive ? "bg-main dark:bg-foreground" : "hover:bg-muted"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-3.5 h-3.5 flex-shrink-0",
                        isActive ? "text-white dark:text-background" : "text-muted-foreground"
                      )}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        "text-[11px] font-bold whitespace-nowrap",
                        isActive ? "text-white dark:text-background" : "text-foreground"
                      )}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Skeleton>
      </div>
      <div
        className={cn(
          "flex flex-row lg:gap-4 gap-2 items-start w-full",
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
                hotelNames={hotelNames}
              />
            </Skeleton>
          )}
        </div>{" "}
        <ScrollArea.Autosize mah={matches ? scrollerHeight : undefined} className="w-full lg:w-3/4">
          <div className="grid grid-cols-1 py-4 lg:py-0 lg:gap-4 gap-6 items-start">
            {isFetching && offlineHotels.length === 0 ? (
              // Show the branded loading animation for ANY active fetch (same as
              // the flight step), not only first load. Prefetch now survives into
              // this step, so hotelsData is often already populated when a refetch
              // (dates/guests/distance) runs — gating on "no hotels" used to drop
              // us into the plain skeleton branch and lose the animation.
              <FlightLoadingTransition
                title={flightSkipped ? "מחפשים לכם את המלונות הטובים ביותר" : "!?כבר הספקתם לבחור טיסות"}
                subtitle={flightSkipped ? "ממש עוד רגע יופיעו המלונות" : "ממש עוד רגע יופיעו גם המלונות"}
                showHotelOnly
                className="py-12"
              />
            ) : isProcessingHotels && offlineHotels.length === 0 ? (
              Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex justify-center">
                  <Skeleton className="p-28" />
                </div>
              ))
            ) : (
              hotelCards
            )}
            {!hotelsData.data?.data?.hotels?.length &&
              !offlineLoading &&
              offlineHotels.length === 0 &&
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
