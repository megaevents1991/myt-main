import { DateRange } from "@/components/ui/dateInput";
import { CustomSlider } from "@/components/ui/CustomSlider";
import { Event, Flight, FlightSearchOptions, TimeRange } from "@/lib/app.types";
import { applyFiltersAndSorting } from "@/lib/flightFilter";
import { flightSort, SortOptions } from "@/lib/flightSort";
import { Button, ScrollArea, Skeleton } from "@mantine/core";
import { Settings2Icon, Search, UsersRound } from "lucide-react";
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { OrderContext } from "../app.context";
import { FlightTicketCard } from "@/components/ui/FlightCard";
import { SelectWithIcon } from "@/components/ui/inputWithIcon";
import { FlightFilters } from "@/components/ui/FlightFilters";
import { useMediaQuery } from "@mantine/hooks";
import { FiltersModal } from "@/components/ui/FiltersModal";
import { SortOptionsContainer } from "@/components/ui/SortOptionsContainer";
import dayjs from "dayjs";
import { prepareFlightsData } from "@/lib/prepareFlightsData";

const MAX_FLIGHT_DURATION = 30;

export const FlightSelection = () => {
  const {
    setFlight,
    flight: orderFlight,
    event = {} as Event,
    numberOfEventTickets,
    setPlaneTickets,
    planeTickets,
  } = useContext(OrderContext);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [filteredFlights, setFilteredFlights] = useState<Flight[]>([]);
  const [filters, setFilters] = useState<{
    numOfStops: string[];
    airline: string[];
    maxPrice: string;
    luggage: string[];
  }>({
    numOfStops: ["0", "1", "2"],
    maxPrice: "",
    airline: [],
    luggage: ["withoutLuggage", "withLuggage"],
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
  });
  const [selectedFlightPrice, setSelectedFlightPrice] = useState(0);
  const [arrivalRanges, setArrivalRanges] = useState<TimeRange[] | []>([]);
  const [departureRanges, setDepartureRanges] = useState<TimeRange[] | []>([]);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(event.def_date_depart),
    new Date(event.def_date_return),
  ]);
  const [showFilters, setShowFilters] = useState(false);
  const matches = useMediaQuery("(min-width: 768px)");
  const [scrollerHeight, setScrollerHeight] = useState(400);

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
      const res = await fetch(`/api/flights?eventId=${event?.id}`, {
        body: JSON.stringify({
          ...options,
          adults: options.adults || planeTickets.adults,
          departureDate: dateRange[0]?.getTime(),
          returnDate: dateRange[1]?.getTime(),
        }),
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch flights");
      }
      const flights = await res.json();

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

      setFilteredFlights(filteredFlights);
      setSelectedFlightDuration(Math.ceil(maxDuration / 60));
      setSelectedFlightPrice(Math.ceil(maxPrice));

      setFlightsMeta({
        maxDuration: Math.ceil(maxDuration / 60),
        minDuration: Math.ceil(minDuration / 60),
        maxPrice,
        minPrice,
      });

      setFilters((prev) => ({
        ...prev,
        airline: airlines,
        directOnly,
      }));
      setFlights(flights);
      setFlight(flights[0]);
    } catch (err) {
      console.error(err);
      setError(
        "An error occurred while fetching flights. Please try again later."
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

    const sortedData = flightSort(filteredFlights, selectedSortOption);

    setFilteredFlights(sortedData);
  };

  const handleFilterChange = async (
    key: string,
    value: string | boolean | string[]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setFlight(undefined);

    const filteredFlights = applyFiltersAndSorting(flights, {
      airline: filters.airline,
      sortOption,
      flightDuration: selectedFlightDuration * 60,
      departureRanges,
      arrivalRanges,
      maxPrice: selectedFlightPrice,
      numOfStops: filters.numOfStops,
      luggage: filters.luggage,
      ...{ [key]: value },
    });

    setFilteredFlights(filteredFlights);
  };

  const handleChangeDurationEnd = (duration: number) => {
    setFlight(undefined);
    setSelectedFlightDuration(duration);

    const filteredFlights = applyFiltersAndSorting(flights, {
      airline: filters.airline,
      sortOption,
      flightDuration: duration,
      departureRanges,
      arrivalRanges,
      maxPrice: selectedFlightPrice,
      numOfStops: filters.numOfStops,
      luggage: filters.luggage,
    });

    setFilteredFlights(filteredFlights);
  };

  const handlePriceChange = (price: number) => {
    setFlight(undefined);
    setSelectedFlightPrice(price);

    const filteredFlights = applyFiltersAndSorting(flights, {
      airline: filters.airline,
      sortOption,
      flightDuration: selectedFlightDuration,
      departureRanges,
      arrivalRanges,
      maxPrice: price,
      numOfStops: filters.numOfStops,
      luggage: filters.luggage,
    });

    setFilteredFlights(filteredFlights);
  };

  const handleRangeChange = ({
    range,
    name,
  }: {
    range: TimeRange[] | [];
    name: "departure" | "arrival";
  }) => {
    setFlight(undefined);
    if (name === "departure") {
      setDepartureRanges(range);
    } else {
      setArrivalRanges(range);
    }

    const filteredFlights = applyFiltersAndSorting(flights, {
      airline: filters.airline,
      sortOption,
      flightDuration: selectedFlightDuration,
      departureRanges: name === "departure" ? range : departureRanges,
      arrivalRanges: name === "arrival" ? range : arrivalRanges,
      maxPrice: selectedFlightPrice,
      numOfStops: filters.numOfStops,
      luggage: filters.luggage,
    });

    setFilteredFlights(filteredFlights);
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

  const handleFlightChange = (value: string) => {
    setFlight(flights.find((f) => f.id === value));
  };

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

  return (
    <div className="space-y-6">
      {!matches && (
        <FiltersModal show={showFilters} onClose={() => setShowFilters(false)}>
          <FlightFilters
            priceComponent={
              <CustomSlider
                onChange={setSelectedFlightPrice}
                variant="price"
                onChangeEnd={handlePriceChange}
                value={selectedFlightPrice}
                maxValue={flightsMeta.maxPrice}
                minValue={flightsMeta.minPrice}
              />
            }
            flightDurationComponent={
              <CustomSlider
                onChangeEnd={handleChangeDurationEnd}
                value={selectedFlightDuration}
                onChange={setSelectedFlightDuration}
                maxValue={flightsMeta.maxDuration}
                minValue={flightsMeta.minDuration}
              />
            }
            handleTimeRangeChange={handleRangeChange}
            airlines={airlines}
            filters={filters}
            handleFilterChange={handleFilterChange}
          />
        </FiltersModal>
      )}
      <div className="flex flex-col items-center">
        <div
          dir="rtl"
          className="w-screen gap-2 flex flex-col justify-center p-4 bg-gray-200 items-center"
        >
          <div className="text-xs w-full flex-col text-center">
            <div className="text-2xl font-bold pre ml-2">{event?.name}</div>
            <div className="whitespace-nowrap">
              <span>{dayjs(event?.date).format("DD/MM/YY")}</span> |{" "}
              {event?.location.name}
            </div>
          </div>
          <div className="flex w-full md:w-1/2 lg:w-1/3 flex-row gap-2 text-xs justify-center m§argin-auto">
            <div className="w-1/5">
              <SelectWithIcon
                value={planeTickets.adults}
                onChange={(value) =>
                  setPlaneTickets({ adults: +(value || 0), children: 0 })
                }
                icon={<UsersRound />}
              />
            </div>
            <div className="flex gap-2 flex-row w-4/5">
              <DateRange
                dateRange={dateRange}
                setDateRange={setDateRange}
                eventDay={event?.date}
              />
              <Button
                onClick={handleFlightSearch}
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
        settings={
          <button>
            <Settings2Icon onClick={() => setShowFilters(true)} />
          </button>
        }
        sortOptions={
          <>
            <div>סדר לפי</div>
            <button
              className="font-bold"
              onClick={() => handleSortChange("price_asc")}
            >
              מחיר
            </button>
            <button
              className="font-bold"
              onClick={() => handleSortChange("duration")}
            >
              משך טיסה{" "}
            </button>
          </>
        }
      />
      <div className="flex flex-row gap-8 flex-row-reverse items-start w-full">
        {matches && (
          <div
            className="w-1/3 space-y-8 border-r border-gray-200 shadow-lg rounded-lg"
            ref={filterRef}
          >
            <Skeleton visible={isLoading} className="p-4">
              <FlightFilters
                priceComponent={
                  <CustomSlider
                    onChange={setSelectedFlightPrice}
                    variant="price"
                    onChangeEnd={handlePriceChange}
                    value={selectedFlightPrice}
                    maxValue={flightsMeta.maxPrice}
                    minValue={flightsMeta.minPrice}
                  />
                }
                flightDurationComponent={
                  <CustomSlider
                    onChange={setSelectedFlightDuration}
                    onChangeEnd={handleChangeDurationEnd}
                    value={selectedFlightDuration}
                    maxValue={flightsMeta.maxDuration}
                    minValue={flightsMeta.minDuration}
                  />
                }
                handleTimeRangeChange={handleRangeChange}
                airlines={airlines}
                filters={filters}
                handleFilterChange={handleFilterChange}
              />
            </Skeleton>
          </div>
        )}
        <ScrollArea.Autosize mah={scrollerHeight} className="w-full md:w-2/3">
          <div className="grid grid-cols-1 gap-4 items-start">
            {filteredFlights.map((flight) => {
              return (
                <FlightTicketCard
                  minPrice={flightsMeta.minPrice}
                  isLoading={isLoading}
                  key={flight.id}
                  {...flight}
                  flightId={flight.id}
                  isSelected={orderFlight?.id === flight.id}
                  onClick={handleFlightChange}
                />
              );
            })}
            {filteredFlights.length === 0 && !isLoading ? (
              <div className="text-center w-full items-center md:w-2/3 text-gray-500 min-h-64 flex">
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
