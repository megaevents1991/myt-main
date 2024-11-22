"use client";

import { useState, useEffect } from "react";
import { Flight } from "@/lib/events-data";
import { Order } from "./useOrderState";
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
import { Plane, ArrowRight, Filter } from "lucide-react";

interface FlightSelectionProps {
  order: Order;
  updateOrder: (key: keyof Order, value: string | number) => void;
}

export default function FlightSelection({
  order,
  updateOrder,
}: FlightSelectionProps) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [filteredFlights, setFilteredFlights] = useState<Flight[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    directOnly: false,
    maxPrice: "",
    airline: "all",
  });
  const [sortOption, setSortOption] = useState("price_asc");

  useEffect(() => {
    async function fetchFlights() {
      const res = await fetch(`/api/flights?eventId=${order.eventId}`);
      const data = await res.json();

      // Sort the data before setting it
      const sortedData = [...data].sort((a, b) => {
        if (sortOption === "price_asc") return a.price - b.price;
        if (sortOption === "price_desc") return b.price - a.price;
        if (sortOption === "duration")
          return a.duration.localeCompare(b.duration);
        return 0;
      });

      setFlights(data);
      setFilteredFlights(sortedData);
    }
    fetchFlights();
  }, [order.eventId, sortOption]);

  useEffect(() => {
    let result = flights;

    if (filters.directOnly) {
      result = result.filter((flight) => flight.stops === 0);
    }

    if (filters.maxPrice) {
      result = result.filter(
        (flight) => flight.price <= parseInt(filters.maxPrice)
      );
    }

    if (filters.airline && filters.airline !== "all") {
      result = result.filter((flight) => flight.airline === filters.airline);
    }

    result.sort((a, b) => {
      if (sortOption === "price_asc") return a.price - b.price;
      if (sortOption === "price_desc") return b.price - a.price;
      if (sortOption === "duration")
        return a.duration.localeCompare(b.duration);
      return 0;
    });

    setFilteredFlights(result);
  }, [flights, filters, sortOption]);

  const handleFilterChange = (key: string, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const airlines = Array.from(new Set(flights.map((flight) => flight.airline)));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold mb-4">Select Your Flight</h2>

      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="w-4 h-4 mr-2" />
          {showFilters ? "Hide Filters" : "Show Filters"}
        </Button>
        <Select value={sortOption} onValueChange={setSortOption}>
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
              onValueChange={(value) => handleFilterChange("airline", value)}
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
        value={order.flightId}
        onValueChange={(value) => updateOrder("flightId", value)}
      >
        {filteredFlights.map((flight) => (
          <div
            key={flight.id}
            className={`mb-4 p-4 border rounded-lg transition-colors hover:bg-gray-50 ${
              order.flightId === flight.id ? "selected-flight" : ""
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
}
