import { useState, useEffect, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plane, ArrowRight, Filter, Loader2 } from "lucide-react";
import { Flight, FlightSearchOptions } from "@/lib/app.types";
import { OrderContext } from "../context";
import { flightSort, SortOptions } from "@/lib/flightSort";
import { TimeSlider } from "@/components/ui/timeSlider";
import { applyFiltersAndSorting } from "@/lib/flightFilter";
import TimeRangeSlider from "@/components/ui/timeRangeSlider";
import { Text } from "@mantine/core";

const MAX_FLIGHT_DURATION = 30 * 60;
const DEFAULT_FLIGHT_RANGE = [0, 24] as [number, number];

const FlightSelection = () => {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [filteredFlights, setFilteredFlights] = useState<Flight[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    directOnly: false,
    maxPrice: "",
    airline: "all",
  });
  const [sortOption, setSortOption] = useState<SortOptions>("price_asc");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setFlight, flight: orderFlight, event } = useContext(OrderContext);
  const [duration, setDuration] = useState(MAX_FLIGHT_DURATION);
  const [inboundRange, setInboundRange] =
    useState<[number, number]>(DEFAULT_FLIGHT_RANGE);
  const [outboundRange, setOutboundRange] =
    useState<[number, number]>(DEFAULT_FLIGHT_RANGE);

  useEffect(() => {
    fetchFlights();
  }, []);

  const fetchFlights = async (options: Partial<FlightSearchOptions> = {}) => {
    const directOnly = !!options.nonStop;

    setIsLoading(true);
    setError(null);
    setFilters((prev) => ({
      ...prev,
      airline: "all",
      directOnly,
    }));
    setDuration(MAX_FLIGHT_DURATION);
    setInboundRange(DEFAULT_FLIGHT_RANGE);
    setOutboundRange(DEFAULT_FLIGHT_RANGE);

    try {
      const res = await fetch(`/api/flights?eventId=${event?.id}`, {
        body: JSON.stringify(options),
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch flights");
      }
      const flights = await res.json();

      const filteredFlights = applyFiltersAndSorting(flights, {
        airline: "all",
        directOnly,
        sortOption,
        flightDuration: MAX_FLIGHT_DURATION,
        inboundRange: DEFAULT_FLIGHT_RANGE,
        outboundRange: DEFAULT_FLIGHT_RANGE,
      });

      setFlights(flights);
      setFilteredFlights(filteredFlights);
    } catch (err) {
      console.error(err);
      setError(
        "An error occurred while fetching flights. Please try again later."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSortChange = (selectedSortOption: SortOptions) => {
    setSortOption(selectedSortOption);

    const sortedData = flightSort(filteredFlights, selectedSortOption);

    setFilteredFlights(sortedData);
  };

  const handleFilterChange = async (key: string, value: string | boolean) => {
    if (key === "directOnly" && value !== filters[key]) {
      await fetchFlights({ nonStop: !!value });
      return;
    }

    setFilters((prev) => ({ ...prev, [key]: value }));

    if (key === "airline" && typeof value === "string") {
      const filteredFlights = applyFiltersAndSorting(flights, {
        airline: value,
        directOnly: filters.directOnly,
        sortOption,
        flightDuration: duration,
        inboundRange,
        outboundRange,
      });

      setFilteredFlights(filteredFlights);
    }
  };

  const handleDurationChange = (duration: number) => {
    const flightDuration = duration * 60;
    setDuration(flightDuration);

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
    range: [number, number];
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
      flightDuration: duration,
      inboundRange: name === "inbound" ? range : inboundRange,
      outboundRange: name === "outbound" ? range : outboundRange,
    });

    setFilteredFlights(filteredFlights);
  };

  const airlines = Array.from(new Set(flights.map((flight) => flight.airline)));

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading flights...</span>
      </div>
    );
  }

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
        <Select value={sortOption} onValueChange={handleSortChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
            <SelectItem value="duration">Duration</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <TimeSlider handleOnChangeEnd={(value) => handleDurationChange(value)} />
      <Text mb="xs">Outbound</Text>
      <TimeRangeSlider
        onChangeEnd={(range) => handleRangeChange({ range, name: "outbound" })}
      />
      <Text mb="xs">Inbound</Text>
      <TimeRangeSlider
        onChangeEnd={(range) => handleRangeChange({ range, name: "inbound" })}
      />
      {showFilters && (
        <div className="bg-gray-100 p-4 rounded-lg space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="directOnly"
              checked={filters.directOnly}
              onCheckedChange={(checked) =>
                handleFilterChange("directOnly", checked === true)
              }
            />
            <Label htmlFor="directOnly">Direct flights only</Label>
          </div>
          <div>
            <Label htmlFor="maxPrice">Maximum Price</Label>
            <Input
              id="maxPrice"
              type="number"
              value={filters.maxPrice}
              onChange={(e) => handleFilterChange("maxPrice", e.target.value)}
              placeholder="Enter max price"
            />
          </div>
          <div>
            <Label htmlFor="airline">Airline</Label>
            <Select
              value={filters.airline}
              onValueChange={async (value) =>
                await handleFilterChange("airline", value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select airline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Airlines</SelectItem>
                {airlines.map((airline) => (
                  <SelectItem key={airline} value={airline}>
                    {airline}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

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
            <Label htmlFor={flight.id} className="flex flex-col cursor-pointer">
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
    </div>
  );
};

export default FlightSelection;
