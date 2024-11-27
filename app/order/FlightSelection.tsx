import { DateRange } from "@/components/ui/dateInput";
import { Label } from "@/components/ui/label";
import { LoaderWrapper } from "@/components/ui/loader";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TimeRangeSlider } from "@/components/ui/timeRangeSlider";
import { TimeSlider } from "@/components/ui/timeSlider";
import { Event, Flight, FlightSearchOptions, TimeRange } from "@/lib/app.types";
import { applyFiltersAndSorting } from "@/lib/flightFilter";
import { flightSort, SortOptions } from "@/lib/flightSort";
import { Button, Checkbox, MultiSelect, Select, Text } from "@mantine/core";
import { ArrowRight, Filter, Plane } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { OrderContext } from "../context";
import { parseDuration } from "@/lib/parseDuration";

const MAX_FLIGHT_DURATION = 30;
const DEFAULT_FLIGHT_RANGE = [
  { hours: 0, minutes: 0 },
  { hours: 23, minutes: 59 },
] as TimeRange;

export const FlightSelection = () => {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [filteredFlights, setFilteredFlights] = useState<Flight[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    directOnly: boolean;
    airline: string[];
    maxPrice: string;
  }>({
    directOnly: false,
    maxPrice: "",
    airline: [],
  });
  const [sortOption, setSortOption] = useState<SortOptions>("price_asc");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    setFlight,
    flight: orderFlight,
    event = {} as Event,
  } = useContext(OrderContext);
  const [durationValue, setDurationValue] = useState(MAX_FLIGHT_DURATION);
  const [maxDuration, setMaxDuration] = useState(MAX_FLIGHT_DURATION);
  const [inboundRange, setInboundRange] =
    useState<TimeRange>(DEFAULT_FLIGHT_RANGE);
  const [outboundRange, setOutboundRange] =
    useState<TimeRange>(DEFAULT_FLIGHT_RANGE);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(new Date(event.date).getTime() - 2 * 8.64e7),
    new Date(new Date(event.date).getTime() + 8.64e7),
  ]);

  useEffect(() => {
    // setDateRange(DEFALUT_DATE_RANGE);
    fetchFlights();
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
    setInboundRange(DEFAULT_FLIGHT_RANGE);
    setOutboundRange(DEFAULT_FLIGHT_RANGE);

    try {
      const res = await fetch(`/api/flights?eventId=${event?.id}`, {
        body: JSON.stringify({
          ...options,
          departureDate: dateRange[0]?.getTime(),
          returnDate: dateRange[1]?.getTime(),
        }),
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch flights");
      }
      const flights = await res.json();

      const airlines: string[] = Array.from(
        new Set(flights.map((flight: Flight) => flight.airline))
      );

      const maxDuration = Math.max(
        ...flights.map((flight: Flight) => parseDuration(flight.duration))
      );

      setDurationValue(Math.ceil(maxDuration / 60));
      setMaxDuration(Math.ceil(maxDuration / 60));

      const filteredFlights = applyFiltersAndSorting(flights, {
        airline: airlines,
        directOnly,
        sortOption,
        flightDuration: 30 * 60,
        inboundRange: DEFAULT_FLIGHT_RANGE,
        outboundRange: DEFAULT_FLIGHT_RANGE,
      });

      setFlights(flights);
      setFilteredFlights(filteredFlights);
      setFilters((prev) => ({
        ...prev,
        airline: airlines,
        directOnly,
      }));
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
    if (key === "directOnly" && value !== filters[key]) {
      await fetchFlights({ nonStop: !!value });
      return;
    }

    setFilters((prev) => ({ ...prev, [key]: value }));

    if (key === "airline" && Array.isArray(value)) {
      const filteredFlights = applyFiltersAndSorting(flights, {
        airline: value,
        directOnly: filters.directOnly,
        sortOption,
        flightDuration: durationValue,
        inboundRange,
        outboundRange,
      });

      setFilteredFlights(filteredFlights);
    }
  };

  const handleChangeDurartionEnd = (duration: number) => {
    const flightDuration = duration * 60;

    const filteredFlights = applyFiltersAndSorting(flights, {
      airline: filters.airline,
      directOnly: filters.directOnly,
      sortOption,
      flightDuration,
      inboundRange,
      outboundRange,
    });

    setFilteredFlights(filteredFlights);
  };

  const handleRangeChange = ({
    range,
    name,
  }: {
    range: TimeRange;
    name: "inbound" | "outbound";
  }) => {
    if (name === "inbound") {
      setInboundRange(range);
    } else {
      setOutboundRange(range);
    }

    const filteredFlights = applyFiltersAndSorting(flights, {
      airline: filters.airline,
      directOnly: filters.directOnly,
      sortOption,
      flightDuration: durationValue,
      inboundRange: name === "inbound" ? range : inboundRange,
      outboundRange: name === "outbound" ? range : outboundRange,
    });

    setFilteredFlights(filteredFlights);
  };

  const airlines = Array.from(new Set(flights.map((flight) => flight.airline)));

  // if (isLoading) {
  //   return (
  //     <div className="flex justify-center items-center h-64">
  //       <Loader2 className="w-8 h-8 animate-spin" />
  //       <span className="ml-2">Loading flights...</span>
  //     </div>
  //   );
  // }

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
      <h2 className="text-2xl font-semibold mb-4">Select Your Flight</h2>
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="w-4 h-4 mr-2" />
          {showFilters ? "Hide Filters" : "Show Filters"}
        </Button>
        <Select
          data={[
            { value: "price_asc", label: "Cheapest" },
            { value: "duration", label: "Fastes" },
          ]}
          value={sortOption}
          onChange={(value) => handleSortChange(value as SortOptions)}
        />
      </div>
      {showFilters && (
        <div className="bg-gray-100 p-4 rounded-lg space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="directOnly"
              checked={filters.directOnly}
              onChange={(e) =>
                handleFilterChange("directOnly", e.currentTarget.checked)
              }
            />
            <Label htmlFor="directOnly">Direct flights only</Label>
          </div>
          <div>
            <Label htmlFor="airline">Airline</Label>
            <MultiSelect
              data={airlines}
              value={filters.airline}
              onChange={(value) => handleFilterChange("airline", value)}
            />
          </div>
        </div>
      )}
      <TimeSlider
        onChangeEnd={handleChangeDurartionEnd}
        value={durationValue}
        onChange={setDurationValue}
        maxValue={maxDuration}
      />
      <DateRange dateRange={dateRange} setDateRange={setDateRange} />
      <Text mb="xs">Outbound</Text>
      <TimeRangeSlider
        onChangeEnd={(range) => handleRangeChange({ range, name: "outbound" })}
      />
      <Text mb="xs">Inbound</Text>
      <TimeRangeSlider
        onChangeEnd={(range) => handleRangeChange({ range, name: "inbound" })}
      />
      <Button onClick={handleFlightSearch}>Find a flight</Button>
      <LoaderWrapper isLoading={isLoading}>
        <RadioGroup
          value={orderFlight?.id}
          onValueChange={(value) =>
            setFlight(flights.find((f) => f.id === value))
          }
        >
          {filteredFlights.map((flight) => (
            <div
              key={flight.id}
              className={`mb-4 p-4 border rounded-lg transition-colors hover:bg-gray-50 ${
                orderFlight?.id === flight.id ? "selected-flight" : ""
              }`}
            >
              <RadioGroupItem
                value={flight.id}
                id={flight.id}
                className="sr-only"
              />
              <Label
                htmlFor={flight.id}
                className="flex flex-col cursor-pointer"
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Plane className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{flight.airline}</p>
                      <p className="text-sm text-gray-500">
                        Duration: {flight.duration}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">${flight.price}</p>
                    <p className="text-sm text-gray-500">
                      {flight.stops === 0
                        ? "Direct"
                        : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">Outbound</p>
                    <div className="flex items-center text-sm text-gray-600">
                      <p>{flight.departureTime}</p>
                      <ArrowRight className="w-4 h-4 mx-2" />
                      <p>{flight.arrivalTime}</p>
                    </div>
                    <p className="text-sm text-gray-600">
                      {flight.departureAirport} to {flight.arrivalAirport}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">Return</p>
                    <div className="flex items-center text-sm text-gray-600">
                      <p>{flight.returnDepartureTime}</p>
                      <ArrowRight className="w-4 h-4 mx-2" />
                      <p>{flight.returnArrivalTime}</p>
                    </div>
                    <p className="text-sm text-gray-600">
                      {flight.arrivalAirport} to {flight.departureAirport}
                    </p>
                  </div>
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>
        {filteredFlights.length === 0 && (
          <p className="text-center text-gray-500">
            No flights match your criteria. Please adjust your filters.
          </p>
        )}
      </LoaderWrapper>
    </div>
  );
};
