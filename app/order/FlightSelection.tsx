import { DateRange } from "@/components/ui/dateInput";
import { LoaderWrapper } from "@/components/ui/loader";
import { TimeRangeSlider } from "@/components/ui/timeRangeSlider";
import { TimeSlider } from "@/components/ui/timeSlider";
import { Event, Flight, FlightSearchOptions, TimeRange } from "@/lib/app.types";
import { applyFiltersAndSorting } from "@/lib/flightFilter";
import { flightSort, SortOptions } from "@/lib/flightSort";
import {
  Button,
  Checkbox,
  MultiSelect,
  NumberInput,
  Select,
  Text,
  ScrollArea,
} from "@mantine/core";
import { Filter } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { OrderContext } from "../app.context";
import { parseDuration } from "@/lib/parseDuration";
import { FlightTicketCard } from "@/components/ui/flightTicketCard";

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
    numberOfEventTickets,
    setPlaneTickets,
    planeTickets,
  } = useContext(OrderContext);
  const [selectedFlightDuration, setSelectedFlightDuration] =
    useState(MAX_FLIGHT_DURATION);
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
    // setDateRange(DEFAULT_DATE_RANGE);
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
    setInboundRange(DEFAULT_FLIGHT_RANGE);
    setOutboundRange(DEFAULT_FLIGHT_RANGE);

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

      const airlines: string[] = Array.from(
        new Set(flights.map((flight: Flight) => flight.airline))
      );

      const maxDuration = Math.max(
        ...flights.map((flight: Flight) => parseDuration(flight.duration))
      );

      const filteredFlights = applyFiltersAndSorting(flights, {
        airline: airlines,
        directOnly,
        sortOption,
        flightDuration: maxDuration,
        inboundRange: DEFAULT_FLIGHT_RANGE,
        outboundRange: DEFAULT_FLIGHT_RANGE,
      });

      setFilteredFlights(filteredFlights);
      setSelectedFlightDuration(Math.ceil(maxDuration / 60));
      setMaxDuration(Math.ceil(maxDuration / 60));
      setFilters((prev) => ({
        ...prev,
        airline: airlines,
        directOnly,
      }));
      setFlights(flights);
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
        flightDuration: selectedFlightDuration * 60,
        inboundRange,
        outboundRange,
      });

      setFilteredFlights(filteredFlights);
    }
  };

  const handleChangeDurationEnd = (duration: number) => {
    setSelectedFlightDuration(duration);
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
      flightDuration: selectedFlightDuration,
      inboundRange: name === "inbound" ? range : inboundRange,
      outboundRange: name === "outbound" ? range : outboundRange,
    });

    setFilteredFlights(filteredFlights);
  };

  const airlines = Array.from(
    new Map(
      flights.map((flight) => [
        flight.airline, // Use airline as the key
        { value: flight.airline, label: flight.metadata.name }, // Object as the value
      ])
    ).values() // Extract the unique values
  );

  // if (isLoading) {
  //   return (
  //     <div className="flex justify-center items-center h-64">
  //       <Loader2 className="w-8 h-8 animate-spin" />
  //       <span className="ml-2">Loading flights...</span>
  //     </div>
  //   );
  // }

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
      <h2 className="text-2xl font-semibold mb-4">Select Your Flight</h2>
      <div className="flex justify-between items-center">
        <NumberInput
          onChange={(value) => setPlaneTickets({ adults: +value, children: 0 })}
          value={planeTickets.adults}
        />
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
            <Text>Direct flights only</Text>
          </div>
          <div>
            <Text>Airline</Text>
            <MultiSelect
              data={airlines}
              value={filters.airline}
              onChange={(value) => handleFilterChange("airline", value)}
            />
          </div>
        </div>
      )}
      <DateRange dateRange={dateRange} setDateRange={setDateRange} />
      <TimeSlider
        onChangeEnd={handleChangeDurationEnd}
        value={selectedFlightDuration}
        onChange={setSelectedFlightDuration}
        maxValue={maxDuration}
      />
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
        <ScrollArea className="h-96">
          <div className="grid grid-cols-1 gap-4">
            {filteredFlights.map((flight) => {
              return (
                <FlightTicketCard
                  key={flight.id}
                  {...flight}
                  flightId={flight.id}
                  isSelected={orderFlight?.id === flight.id}
                  onClick={handleFlightChange}
                />
              );
            })}
          </div>
        </ScrollArea>
        {filteredFlights.length === 0 && (
          <p className="text-center text-gray-500">
            No flights match your criteria. Please adjust your filters.
          </p>
        )}
      </LoaderWrapper>
    </div>
  );
};
