"use client";

import { DateRange } from "@/components/ui/dateInput";
import { CustomSlider } from "@/components/ui/CustomSlider";
import {
  Event,
  Flight,
  FlightSearchCriteria,
  FlightSearchOptions,
  TimeRange,
} from "@/lib/app.types";
import { applyFiltersAndSorting } from "@/lib/flightFilter";
import { flightSort, SortOptions } from "@/lib/flightSort";
import { Button, ScrollArea, Skeleton } from "@mantine/core";
import { Settings2Icon, Search } from "lucide-react";
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { OrderContext } from "../app.context";
import { FlightTicketCard } from "@/components/ui/FlightCard";
import { SelectWithIcon } from "@/components/ui/inputWithIcon";
import { FlightFilters } from "@/components/ui/FlightFilters";
import { useMediaQuery } from "@mantine/hooks";
import { FiltersModal } from "@/components/ui/FiltersModal";
import { SortOptionsContainer } from "@/components/ui/SortOptionsContainer";
import { prepareFlightsData } from "@/lib/prepareFlightsData";
import { cn } from "@/lib/utils";
import { EventDataHeader } from "@/components/ui/EventDataHeader";
import { isMobile } from "react-device-detect";
import dayjs from "dayjs";
import { getDefaultDateRange } from "@/lib/getDefaultDateRange";
import { getRoomParams } from "@/lib/getRoomParams";
import { HotelFetchContext } from "../HotelFetch.provider";

const MAX_FLIGHT_DURATION = 30;

export const FlightSelection = () => {
  const {
    setFlight,
    flight: orderFlight,
    event = {} as Event,
    numberOfEventTickets,
    setPlaneTickets,
    planeTickets,
    setSelectedPlaneTicketsFilters,
  } = useContext(OrderContext);
  const { getHotels, hotelsData } = useContext(HotelFetchContext);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [filteredFlights, setFilteredFlights] = useState<Flight[]>([]);
  const [filters, setFilters] = useState<{
    numOfStops: string[];
    airline: string[];
    maxPrice: string;
    luggage: string[];
  }>({
    numOfStops: ["0", "1"],
    maxPrice: "",
    airline: [],
    luggage: ["withCheckedBags", "withCabinBags"],
  });
  const [sortOption, setSortOption] = useState<SortOptions>("price_asc");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFlightDuration, setSelectedFlightDuration] =
    useState(MAX_FLIGHT_DURATION);
  const [flightsMeta, setFlightsMeta] = useState({
    maxDuration: MAX_FLIGHT_DURATION,
    minDuration: MAX_FLIGHT_DURATION,
    maxPrice: 0,
    minPrice: 0,
    numOfPassengers: numberOfEventTickets,
  });
  const [selectedFlightPrice, setSelectedFlightPrice] = useState(0);
  const [arrivalRanges, setArrivalRanges] = useState<TimeRange[] | []>([]);
  const [departureRanges, setDepartureRanges] = useState<TimeRange[] | []>([]);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(event.def_date_depart),
    new Date(event.def_date_return),
  ]);
  const [showFilters, setShowFilters] = useState(false);
  const matches = useMediaQuery("(min-width: 1024px)");
  const [scrollerHeight, setScrollerHeight] = useState(400);
  const [, startTransition] = useTransition();
  const [debug, setDebug] = useState<{
    departureDate: Date;
    returnDate: Date;
  }>({ departureDate: new Date(), returnDate: new Date() });

  const filterRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (filterRef.current && matches) {
      setScrollerHeight(filterRef.current.offsetHeight);
    } else if (!matches) {
      setScrollerHeight(400);
    }
  }, [matches, flights]);

  useEffect(() => {
    setPlaneTickets({ adults: numberOfEventTickets, children: 0 });
    fetchFlights({ adults: numberOfEventTickets });
  }, []);

  // Fetch hotels when the orderFlight dates or number of adults change
  useEffect(() => {
    if (orderFlight?.id) {
      getHotels({
        dateRange: getDefaultDateRange(event, orderFlight),
        guests: getRoomParams(planeTickets.adults),
        location: event.location,
      });
    }
  }, [
    dayjs(getDefaultDateRange(event, orderFlight)[0]).format("YYYY-MM-DD"),
    dayjs(getDefaultDateRange(event, orderFlight)[1]).format("YYYY-MM-DD"),
    planeTickets.adults,
  ]);

  // First time fetching hotels, only if no hotels are already fetched
  useEffect(() => {
    if (orderFlight?.id && !hotelsData?.data?.data?.hotels) {
      getHotels({
        dateRange: getDefaultDateRange(event, orderFlight),
        guests: getRoomParams(planeTickets.adults),
        location: event.location,
      });
    }
  }, [orderFlight?.id]);

  useEffect(() => {
    setSelectedPlaneTicketsFilters({});
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    const timer = setTimeout(() => {
      window.scrollTo({
        top: 90,
        behavior: "smooth", // Adds a smooth scrolling effect
      });
    }, 1000); // 1 second delay

    return () => clearTimeout(timer); // Cleanup timeout if component unmounts
  }, []);

  const fetchFlights = async (options: Partial<FlightSearchOptions> = {}) => {
    const directOnly = !!options.nonStop;

    setIsLoading(true);
    setError(null);
    setFilters((prev) => ({
      ...prev,
      airline: [],
      directOnly,
    }));
    setDepartureRanges([]);
    setArrivalRanges([]);
    setFlight(undefined);

    try {
      const adults = options.adults || planeTickets.adults;
      const gtmIdnts =
        document.cookie
          .split("; ")
          .find((row) => row.startsWith("gtmIdnts="))
          ?.split("=")[1] || "";
      const res = await fetch(`/api/flights/search?eventId=${event?.id}`, {
        body: JSON.stringify({
          ...options,
          adults,
          departureDate: dateRange[0]?.toDateString(),
          returnDate: dateRange[1]?.toDateString(),
          gtmIdnts,
        }),
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch flights");
      }
      const {
        flights,
        debug,
      }: {
        flights: Flight[];
        debug: { departureDate: string; returnDate: string };
      } = await res.json();

      const { airlines, maxDuration, minDuration, maxPrice, minPrice } =
        prepareFlightsData(flights);

      const filteredFlights = applyFiltersAndSorting(flights, {
        airline: airlines,
        sortOption,
        flightDuration: maxDuration,
        departureRanges: [],
        arrivalRanges: [],
        maxPrice,
        numOfStops: filters.numOfStops,
        luggage: filters.luggage,
      });

      setFilteredFlights(filteredFlights.slice(0, 50));
      setSelectedFlightDuration(Math.ceil(maxDuration / 60));
      setSelectedFlightPrice(Math.ceil(maxPrice));
      setDebug({
        departureDate: new Date(debug.departureDate),
        returnDate: new Date(debug.returnDate),
      });
      setFlightsMeta({
        maxDuration: Math.ceil(maxDuration / 60),
        minDuration: Math.ceil(minDuration / 60),
        maxPrice,
        minPrice,
        numOfPassengers: adults,
      });

      setFilters((prev) => ({
        ...prev,
        airline: airlines,
        directOnly,
      }));
      setFlights(flights);
      setFlight(flights[0]);
      return flights;
    } catch (err) {
      console.error(err);
      setError(
        "היי חברים, סליחה, יש לנו תקלה ואנחנו על זה. נסו אותנו יותר מאוחר בבקשה."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlightSearch = async () => {
    await fetchFlights();
  };

  const handleSortChange = (selectedSortOption: SortOptions) => {
    setSortOption(selectedSortOption);

    startTransition(() => {
      const sortedData = flightSort(filteredFlights, selectedSortOption);
      setFilteredFlights(sortedData.slice(0, 50));
    });
  };

  const airlines = useMemo(
    () =>
      Array.from(
        new Map(
          flights.map((flight) => [
            flight.airline, // Use airline as the key
            { value: flight.airline, label: flight.metadata.name }, // Object as the value
          ])
        ).values() // Extract the unique values
      ),
    [flights]
  );

  const handleFlightChange = useCallback(
    (value: string) => {
      setFlight(flights.find((f) => f.id === value));
    },
    [flights, setFlight]
  );

  const handleFlightSearchCriteriaChange = ({
    value,
    type,
  }: FlightSearchCriteria) => {
    setSelectedPlaneTicketsFilters((prev) => ({
      ...prev,
      [type]: value,
    }));
    switch (type) {
      case "arrivalRanges":
        setArrivalRanges(value);
        break;
      case "departureRanges":
        setDepartureRanges(value);
        break;
      case "maxPrice":
        setSelectedFlightPrice(value);
        break;
      case "flightDuration":
        setSelectedFlightDuration(value);
        break;
      case "airline":
      case "numOfStops":
      case "luggage":
        setFilters((prev) => ({ ...prev, [type]: value }));
        break;
    }

    startTransition(() => {
      setFlight(undefined);

      const filteredFlights = applyFiltersAndSorting(flights, {
        airline: filters.airline,
        sortOption,
        flightDuration: selectedFlightDuration,
        departureRanges,
        arrivalRanges,
        maxPrice: selectedFlightPrice,
        numOfStops: filters.numOfStops,
        luggage: filters.luggage,
        ...{ [type]: value },
      });
      if (filteredFlights.length !== 0) {
        setFlight(filteredFlights[0]);
      }
      setFilteredFlights(filteredFlights.slice(0, 50));
    });
  };

  const flightTicketCards = useMemo(
    () =>
      filteredFlights.map((flight) => {
        return (
          <FlightTicketCard
            minPrice={event.base_flight_price}
            isLoading={isLoading}
            key={flight.id}
            {...flight}
            price={Math.ceil(flight.price / flightsMeta.numOfPassengers)}
            flightId={flight.id}
            isSelected={orderFlight?.id === flight.id}
            onClick={handleFlightChange}
          />
        );
      }),
    [
      filteredFlights,
      event.base_flight_price,
      isLoading,
      flightsMeta.numOfPassengers,
      orderFlight?.id,
      handleFlightChange,
    ]
  );

  if (error) {
    return (
      <div className="text-center text-red-500">
        <p>{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  const handleDatePopoverClose = () => {
    if (!dateRange[0] || !dateRange[1]) {
      const defaultDates: [Date, Date] = [
        new Date(event.def_date_depart),
        new Date(event.def_date_return),
      ];
      setDateRange(defaultDates);
      return;
    }

    if (
      dayjs(dateRange[0]).isSame(dayjs(debug.departureDate), "day") &&
      dayjs(dateRange[1]).isSame(dayjs(debug.returnDate), "day")
    ) {
      return;
    }

    fetchFlights();
  };

  return (
    <div className="space-y-2 lg:space-y-6">
      {!matches && (
        <FiltersModal show={showFilters} onClose={() => setShowFilters(false)}>
          <FlightFilters
            handleFlightSearchCriteriaChange={handleFlightSearchCriteriaChange}
            priceComponent={
              <CustomSlider
                onChange={setSelectedFlightPrice}
                variant="maxPrice"
                onChangeEnd={handleFlightSearchCriteriaChange}
                value={selectedFlightPrice}
                maxValue={flightsMeta.maxPrice}
                minValue={flightsMeta.minPrice}
                basePrice={event.base_flight_price}
                numOfPassengers={flightsMeta.numOfPassengers}
              />
            }
            flightDurationComponent={
              <CustomSlider
                onChangeEnd={handleFlightSearchCriteriaChange}
                value={selectedFlightDuration}
                onChange={setSelectedFlightDuration}
                maxValue={flightsMeta.maxDuration}
                minValue={flightsMeta.minDuration}
              />
            }
            airlines={airlines}
            filters={filters}
          />
        </FiltersModal>
      )}
      <div className="flex flex-col items-center">
        <div dir="rtl" className="w-screen px-4 py-2 lg:p-4 bg-gray-200 ">
          <div className="flex justify-between w-full max-w-7xl mx-auto gap-2 px-2 lg:px-6 flex-col lg:flex-row lg:gap-2">
            <EventDataHeader event={event} />
            <div className="flex w-full lg:w-[60%] flex-row gap-2 text-xs justify-start lg:justify-center items-center margin-auto">
              {matches && (
                <span className="text-center text-xl">כמה טסים?</span>
              )}
              <div className="w-fit">
                <SelectWithIcon
                  value={planeTickets.adults}
                  onChange={(value) =>
                    setPlaneTickets({ adults: +(value || 0), children: 0 })
                  }
                  icon={null}
                />
              </div>
              {matches && (
                <span className="mr-6 text-center text-xl">
                  ובאיזה תאריכים?
                </span>
              )}
              <div className="flex flex-row w-min items-center">
                <DateRange
                  disabled={isLoading}
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  eventDay={event?.date}
                  onPopoverClose={handleDatePopoverClose}
                  showTooltip={true}
                />
                <button
                  onClick={handleFlightSearch}
                  disabled={isLoading}
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
          "flex lg:gap-4 flex-row-reverse justify-between items-start w-full",
          !matches && "flex-col gap-2"
        )}
      >
        <div
          className={cn("w-1/4 space-y-4", !matches && "w-full")}
          ref={filterRef}
        >
          <Skeleton visible={isLoading}>
            <SortOptionsContainer
              settings={
                <button className="flex items-center border-2 p-2 border-gray-200 shadow-lg rounded-lg">
                  <Settings2Icon onClick={() => setShowFilters(true)} />
                </button>
              }
              sortOptions={
                <div className="flex items-center border-2 border-gray-200 shadow-lg rounded-lg">
                  <button
                    className={cn(
                      "font-bold px-6 py-1 rounded-r-md",
                      sortOption === "price_asc" && "text-white bg-main"
                    )}
                    onClick={() => handleSortChange("price_asc")}
                  >
                    מחיר
                  </button>
                  <button
                    className={cn(
                      "font-bold px-6 py-1 rounded-l-md whitespace-nowrap",
                      sortOption === "duration" && "text-white bg-main"
                    )}
                    onClick={() => handleSortChange("duration")}
                  >
                    משך טיסה
                  </button>
                </div>
              }
            />
          </Skeleton>
          {matches && (
            <Skeleton visible={isLoading}>
              <FlightFilters
                handleFlightSearchCriteriaChange={
                  handleFlightSearchCriteriaChange
                }
                priceComponent={
                  <CustomSlider
                    onChange={setSelectedFlightPrice}
                    variant="maxPrice"
                    onChangeEnd={handleFlightSearchCriteriaChange}
                    value={selectedFlightPrice}
                    maxValue={flightsMeta.maxPrice}
                    minValue={flightsMeta.minPrice}
                    basePrice={event.base_flight_price}
                    numOfPassengers={flightsMeta.numOfPassengers}
                  />
                }
                flightDurationComponent={
                  <CustomSlider
                    onChange={setSelectedFlightDuration}
                    onChangeEnd={handleFlightSearchCriteriaChange}
                    value={selectedFlightDuration}
                    maxValue={flightsMeta.maxDuration}
                    minValue={flightsMeta.minDuration}
                  />
                }
                airlines={airlines}
                filters={filters}
              />
            </Skeleton>
          )}
        </div>
        <ScrollArea.Autosize mah={scrollerHeight} className="w-full lg:w-3/4">
          <div className="grid grid-cols-1 py-4 lg:py-0 lg:gap-4 gap-6 items-start">
            {flightTicketCards}
            {filteredFlights.length === 0 && !isLoading ? (
              <div className="text-center w-full items-center lg:w-2/3 text-gray-500 min-h-64 flex">
                No flights match your criteria. Please adjust your filters.
              </div>
            ) : (
              filteredFlights.length === 0 &&
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="p-24" />
              ))
            )}
          </div>
        </ScrollArea.Autosize>
      </div>
    </div>
  );
};
