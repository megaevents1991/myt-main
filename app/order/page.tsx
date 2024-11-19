/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
import {
  Plane,
  Ticket,
  ArrowRight,
  Music,
  Search,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  events,
  flights,
  hotels,
  Event,
  Flight,
  Hotel,
} from "@/lib/events-data";
import { useRouter } from "next/navigation";

interface Filters {
  directOnly: boolean;
  oneStopMax: boolean;
  airlines: {
    emirates: boolean;
    delta: boolean;
  };
  flightTimes: {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  };
}

interface Order {
  ticketType: string;
  quantity: number;
  flightId: string;
  departureDate: Date;
  returnDate: Date;
  hotelId: string;
}

export default function OrderPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [order, setOrder] = useState<Order>({
    ticketType: "",
    quantity: 1,
    flightId: "",
    departureDate: new Date("2023-07-14"),
    returnDate: new Date("2023-07-16"),
    hotelId: "",
  });

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    directOnly: false,
    oneStopMax: false,
    airlines: {
      emirates: false,
      delta: false,
    },
    flightTimes: {
      morning: false,
      afternoon: false,
      evening: false,
    },
  });

  const [filteredFlights, setFilteredFlights] = useState(flights);
  const [sortOption, setSortOption] = useState("price_asc");
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  const updateOrder = (key: keyof Order, value: string | number | Date) => {
    setOrder((prev) => ({ ...prev, [key]: value }));
  };

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  const event = events[0]; // Using the first event as an example

  useEffect(() => {
    let newFilteredFlights = flights.filter((flight) => {
      if (filters.directOnly && flight.stops > 0) return false;
      if (filters.oneStopMax && flight.stops > 1) return false;

      if (filters.airlines.emirates && flight.airline !== "Emirates")
        return false;
      if (filters.airlines.delta && flight.airline !== "Delta") return false;

      const flightHour = parseInt(flight.departureTime.split(":")[0]);
      if (filters.flightTimes.morning && (flightHour < 6 || flightHour >= 12))
        return false;
      if (
        filters.flightTimes.afternoon &&
        (flightHour < 12 || flightHour >= 18)
      )
        return false;
      if (filters.flightTimes.evening && (flightHour < 18 || flightHour >= 24))
        return false;

      return true;
    });

    // Apply sorting
    newFilteredFlights.sort((a, b) => {
      switch (sortOption) {
        case "price_asc":
          return a.price - b.price;
        case "price_desc":
          return b.price - a.price;
        case "duration":
          return a.duration.localeCompare(b.duration);
        default:
          return 0;
      }
    });

    setFilteredFlights(newFilteredFlights);
  }, [filters, sortOption]);

  const handleFilterChange = (
    filterType: keyof Filters,
    value: string | boolean
  ) => {
    setFilters((prevFilters) => {
      if (filterType === "directOnly" || filterType === "oneStopMax") {
        return { ...prevFilters, [filterType]: value as boolean };
      } else if (filterType === "airlines" || filterType === "flightTimes") {
        return {
          ...prevFilters,
          [filterType]: {
            ...prevFilters[filterType],
            [value as string]:
              !prevFilters[filterType][
                value as keyof (typeof prevFilters)[typeof filterType]
              ],
          },
        };
      }
      return prevFilters;
    });
  };

  const calculateTotalPrice = () => {
    const ticketPrice =
      order.ticketType === "vip" ? event.price * 2 : event.price;
    const totalTicketPrice = ticketPrice * order.quantity;
    const flightPrice =
      flights.find((f) => f.id === order.flightId)?.price || 0;
    const hotelPrice =
      (hotels.find((h) => h.id === order.hotelId)?.price || 0) *
      Math.ceil(
        (order.returnDate.getTime() - order.departureDate.getTime()) /
          (1000 * 60 * 60 * 24)
      ); // Calculate nights
    return totalTicketPrice + flightPrice + hotelPrice;
  };

  const handleConfirmOrder = async () => {
    try {
      const orderDetails = {
        eventId: event.id,
        ticketType: order.ticketType,
        quantity: order.quantity,
        flightId: order.flightId,
        hotelId: order.hotelId,
        checkInDate: order.departureDate.toISOString(),
        checkOutDate: order.returnDate.toISOString(),
        totalPrice: calculateTotalPrice(),
      };

      const response = await fetch("/api/confirm-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderDetails),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Order confirmed:", result);
        setIsConfirmationOpen(false);

        const queryParams = new URLSearchParams();
        Object.entries({
          ...orderDetails,
          flight: flights.find((f) => f.id === order.flightId)?.airline || "",
          hotel: hotels.find((h) => h.id === order.hotelId)?.name || "",
          bookingReference: result.bookingReference,
        }).forEach(([key, value]) => {
          queryParams.append(key, String(value));
        });

        router.push(`/confirmation?${queryParams.toString()}`);
      } else {
        throw new Error("Failed to confirm order");
      }
    } catch (error) {
      console.error("Error confirming order:", error);
      alert(
        "There was an error confirming your order. Please try again or contact customer support."
      );
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <header className="bg-white px-4 lg:px-6 h-16 flex items-center justify-between shadow-sm">
        <Link className="flex items-center justify-center" href="/">
          <Music className="h-6 w-6" />
          <span className="ml-2 text-lg font-bold">MYT Events</span>
        </Link>
        <nav className="hidden md:flex gap-4 sm:gap-6">
          <Link
            className="text-sm font-medium hover:underline underline-offset-4"
            href="#"
          >
            Events
          </Link>
          <Link
            className="text-sm font-medium hover:underline underline-offset-4"
            href="#"
          >
            About
          </Link>
          <Link
            className="text-sm font-medium hover:underline underline-offset-4"
            href="#"
          >
            Contact
          </Link>
        </nav>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Book Your Experience</h1>
        <div className="space-y-8">
          {step === 1 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-semibold mb-4">
                Select Your Tickets
              </h2>
              <div className="space-y-4">
                <RadioGroup
                  value={order.ticketType}
                  onValueChange={(value: string) =>
                    updateOrder("ticketType", value)
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="standard" id="standard" />
                    <Label htmlFor="standard">Standard - ${event.price}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="vip" id="vip" />
                    <Label htmlFor="vip">VIP - ${event.price * 2}</Label>
                  </div>
                </RadioGroup>
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Select
                    value={order.quantity.toString()}
                    onValueChange={(value: string) =>
                      updateOrder("quantity", parseInt(value))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select quantity" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold">Select Your Flight</h2>
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="md:hidden"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </div>

              <div className="flex flex-col md:flex-row gap-6">
                {/* Filters Sidebar */}
                <div
                  className={`${
                    showFilters ? "block" : "hidden md:block"
                  } w-full md:w-64 bg-gray-50 rounded-lg p-4`}
                >
                  <h3 className="font-semibold mb-4">Filters</h3>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Stops</h4>
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <Checkbox
                            id="direct"
                            checked={filters.directOnly}
                            onCheckedChange={(checked) =>
                              handleFilterChange("directOnly", checked === true)
                            }
                          />
                          <label htmlFor="direct" className="text-sm ml-2">
                            Direct flights only
                          </label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox
                            id="one-stop"
                            checked={filters.oneStopMax}
                            onCheckedChange={(checked) =>
                              handleFilterChange("oneStopMax", checked === true)
                            }
                          />
                          <label htmlFor="one-stop" className="text-sm ml-2">
                            1 stop max
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Airlines</h4>
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <Checkbox
                            id="emirates"
                            checked={filters.airlines.emirates}
                            onCheckedChange={() =>
                              handleFilterChange("airlines", "emirates")
                            }
                          />
                          <label htmlFor="emirates" className="text-sm ml-2">
                            Emirates Airlines
                          </label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox
                            id="delta"
                            checked={filters.airlines.delta}
                            onCheckedChange={() =>
                              handleFilterChange("airlines", "delta")
                            }
                          />
                          <label htmlFor="delta" className="text-sm ml-2">
                            Delta Airlines
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Flight Times</h4>
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <Checkbox
                            id="morning"
                            checked={filters.flightTimes.morning}
                            onCheckedChange={() =>
                              handleFilterChange("flightTimes", "morning")
                            }
                          />
                          <label htmlFor="morning" className="text-sm ml-2">
                            Morning (6:00 - 12:00)
                          </label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox
                            id="afternoon"
                            checked={filters.flightTimes.afternoon}
                            onCheckedChange={() =>
                              handleFilterChange("flightTimes", "afternoon")
                            }
                          />
                          <label htmlFor="afternoon" className="text-sm ml-2">
                            Afternoon (12:00 - 18:00)
                          </label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox
                            id="evening"
                            checked={filters.flightTimes.evening}
                            onCheckedChange={() =>
                              handleFilterChange("flightTimes", "evening")
                            }
                          />
                          <label htmlFor="evening" className="text-sm ml-2">
                            Evening (18:00 - 24:00)
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1">
                  <div className="mb-6 flex items-center space-x-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search flights"
                        className="pl-10 w-full"
                      />
                    </div>
                    <Select value={sortOption} onValueChange={setSortOption}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="price_asc">
                          Price: Low to High
                        </SelectItem>
                        <SelectItem value="price_desc">
                          Price: High to Low
                        </SelectItem>
                        <SelectItem value="duration">Duration</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mb-6 flex space-x-4">
                    <DatePicker
                      selected={order.departureDate}
                      onSelect={(date) =>
                        date && updateOrder("departureDate", date)
                      }
                      label="Departure Date"
                    />
                    <DatePicker
                      selected={order.returnDate}
                      onSelect={(date) =>
                        date && updateOrder("returnDate", date)
                      }
                      label="Return Date"
                    />
                  </div>

                  <RadioGroup
                    value={order.flightId}
                    onValueChange={(value: string) =>
                      updateOrder("flightId", value)
                    }
                  >
                    {filteredFlights.map((flight: Flight) => (
                      <div
                        key={flight.id}
                        className={`mb-4 p-4 border rounded-lg transition-colors ${
                          order.flightId === flight.id
                            ? "border-primary bg-primary/5"
                            : "border-gray-200"
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
                              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                                <Plane className="w-8 h-8 text-gray-500" />
                              </div>
                              <div>
                                <p className="font-semibold text-lg">
                                  {flight.airline}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {flight.stops === 0
                                    ? "Direct"
                                    : `${flight.stops} stop${
                                        flight.stops > 1 ? "s" : ""
                                      }`}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold">
                                ${flight.price}
                              </p>
                              <p className="text-sm text-gray-600">
                                Round trip
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
                                {flight.departureAirport} to{" "}
                                {flight.arrivalAirport}
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
                                {flight.arrivalAirport} to{" "}
                                {flight.departureAirport}
                              </p>
                            </div>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-semibold mb-4">Select Your Hotel</h2>
              <div className="space-y-4">
                <RadioGroup
                  value={order.hotelId}
                  onValueChange={(value: string) =>
                    updateOrder("hotelId", value)
                  }
                >
                  {hotels.map((hotel: Hotel) => (
                    <div
                      key={hotel.id}
                      className={`p-4 border rounded-lg transition-colors ${
                        order.hotelId === hotel.id
                          ? "border-primary bg-primary/5"
                          : "border-gray-200"
                      }`}
                    >
                      <RadioGroupItem
                        value={hotel.id}
                        id={hotel.id}
                        className="sr-only"
                      />
                      <Label
                        htmlFor={hotel.id}
                        className="flex justify-between items-center cursor-pointer"
                      >
                        <div>
                          <p className="font-semibold">{hotel.name}</p>
                          <p className="text-sm text-gray-600">
                            Rating: {hotel.rating} stars
                          </p>
                          <p className="text-sm text-gray-600">
                            {hotel.amenities.join(", ")}
                          </p>
                        </div>
                        <p className="text-lg font-bold">
                          ${hotel.price}/night
                        </p>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                <div className="mt-4">
                  <p className="text-sm text-gray-600">
                    Check-in: {order.departureDate.toDateString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Check-out: {order.returnDate.toDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-semibold mb-4">Review Your Order</h2>
              <div className="space-y-4">
                <p>
                  <strong>Event:</strong> {event.name}
                </p>
                <p>
                  <strong>Date:</strong> {event.date}
                </p>
                <p>
                  <strong>Location:</strong> {event.location}
                </p>
                <p>
                  <strong>Ticket:</strong>{" "}
                  {order.ticketType === "vip" ? "VIP" : "Standard"} (x
                  {order.quantity})
                </p>
                <p>
                  <strong>Price:</strong> $
                  {order.ticketType === "vip" ? event.price * 2 : event.price}{" "}
                  per ticket
                </p>
                <p>
                  <strong>Flight:</strong>{" "}
                  {flights.find((f) => f.id === order.flightId)?.airline}
                </p>
                <p>
                  <strong>Departure Date:</strong>{" "}
                  {order.departureDate.toDateString()}
                </p>
                <p>
                  <strong>Return Date:</strong>{" "}
                  {order.returnDate.toDateString()}
                </p>
                <p>
                  <strong>Hotel:</strong>{" "}
                  {hotels.find((h) => h.id === order.hotelId)?.name}
                </p>
                <p>
                  <strong>Check-in:</strong>{" "}
                  {order.departureDate.toDateString()}
                </p>
                <p>
                  <strong>Check-out:</strong> {order.returnDate.toDateString()}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8">
            {step > 1 && (
              <Button onClick={prevStep} variant="outline">
                Previous
              </Button>
            )}
            {step < 4 ? (
              <Button onClick={nextStep} className="ml-auto">
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Dialog
                open={isConfirmationOpen}
                onOpenChange={setIsConfirmationOpen}
              >
                <DialogTrigger asChild>
                  <Button className="ml-auto">Confirm Order</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Your Order</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to confirm this order? Once
                      confirmed, you will be charged and your booking will be
                      finalized.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsConfirmationOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleConfirmOrder}>Confirm</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-white py-6 px-4 md:px-6 border-t">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
          <p className="text-xs text-gray-500 mb-4 sm:mb-0">
            © 2023 MYT Events. All rights reserved.
          </p>
          <nav className="flex gap-4 sm:gap-6">
            <Link
              className="text-xs hover:underline underline-offset-4"
              href="#"
            >
              Terms of Service
            </Link>
            <Link
              className="text-xs hover:underline underline-offset-4"
              href="#"
            >
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
