/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
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
import { Plane, Hotel, Ticket, ArrowRight, Music } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

// Mocked data (in a real app, this would come from an API or database)
const event = {
  id: "1",
  name: "Summer Music Festival",
  date: "2023-07-15",
  location: "Central Park, New York",
  ticketTypes: [
    { id: "general", name: "General Admission", price: 150 },
    { id: "vip", name: "VIP", price: 300 },
  ],
};

const flights = [
  {
    id: "1",
    airline: "Emirates",
    departureTime: "07:10",
    arrivalTime: "17:45",
    departureDate: "2023-07-14",
    arrivalDate: "2023-07-14",
    departureAirport: "JFK",
    arrivalAirport: "LGA",
    price: 450,
    duration: "1h 35m",
    stops: 0,
  },
  {
    id: "2",
    airline: "Delta",
    departureTime: "14:05",
    arrivalTime: "15:55",
    departureDate: "2023-07-14",
    arrivalDate: "2023-07-14",
    departureAirport: "JFK",
    arrivalAirport: "LGA",
    price: 380,
    duration: "1h 50m",
    stops: 0,
  },
];

const hotels = [
  {
    id: "1",
    name: "Luxury Hotel",
    price: 300,
    rating: 5,
    amenities: ["Free Wi-Fi", "Pool", "Spa"],
  },
  {
    id: "2",
    name: "Budget Inn",
    price: 100,
    rating: 3,
    amenities: ["Free Wi-Fi", "Breakfast"],
  },
];

export default function OrderPage() {
  const [step, setStep] = useState(1);
  const [order, setOrder] = useState({
    ticketType: "",
    quantity: 1,
    flightId: "",
    hotelId: "",
    checkInDate: new Date("2023-07-14"),
    checkOutDate: new Date("2023-07-16"),
  });

  const updateOrder = (key: string, value: any) => {
    setOrder((prev) => ({ ...prev, [key]: value }));
  };

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center justify-between">
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
            <div>
              <h2 className="text-2xl font-semibold mb-4">
                Select Your Tickets
              </h2>
              <div className="space-y-4">
                <RadioGroup
                  value={order.ticketType}
                  onValueChange={(value) => updateOrder("ticketType", value)}
                >
                  {event.ticketTypes.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center space-x-2"
                    >
                      <RadioGroupItem value={ticket.id} id={ticket.id} />
                      <Label htmlFor={ticket.id}>
                        {ticket.name} - ${ticket.price}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Select
                    value={order.quantity.toString()}
                    onValueChange={(value) =>
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
            <div>
              <h2 className="text-2xl font-semibold mb-4">
                Select Your Flight
              </h2>
              <RadioGroup
                value={order.flightId}
                onValueChange={(value) => updateOrder("flightId", value)}
              >
                {flights.map((flight) => (
                  <div key={flight.id} className="mb-4 p-4 border rounded-lg">
                    <RadioGroupItem
                      value={flight.id}
                      id={flight.id}
                      className="sr-only"
                    />
                    <Label
                      htmlFor={flight.id}
                      className="flex justify-between items-center cursor-pointer"
                    >
                      <div>
                        <p className="font-semibold">{flight.airline}</p>
                        <p className="text-sm text-gray-600">
                          {flight.departureTime} - {flight.arrivalTime} (
                          {flight.duration})
                        </p>
                        <p className="text-sm text-gray-600">
                          {flight.departureAirport} to {flight.arrivalAirport}
                        </p>
                      </div>
                      <p className="text-lg font-bold">${flight.price}</p>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Select Your Hotel</h2>
              <div className="space-y-4">
                <RadioGroup
                  value={order.hotelId}
                  onValueChange={(value) => updateOrder("hotelId", value)}
                >
                  {hotels.map((hotel) => (
                    <div key={hotel.id} className="p-4 border rounded-lg">
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
                <div className="flex space-x-4">
                  <DatePicker
                    selected={order.checkInDate}
                    onSelect={(date) => updateOrder("checkInDate", date)}
                    label="Check-in"
                  />
                  <DatePicker
                    selected={order.checkOutDate}
                    onSelect={(date) => updateOrder("checkOutDate", date)}
                    label="Check-out"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Review Your Order</h2>
              <div className="space-y-4">
                <p>
                  <strong>Event:</strong> {event.name}
                </p>
                <p>
                  <strong>Date:</strong> {event.date}
                </p>
                <p>
                  <strong>Ticket:</strong>{" "}
                  {
                    event.ticketTypes.find((t) => t.id === order.ticketType)
                      ?.name
                  }{" "}
                  (x{order.quantity})
                </p>
                <p>
                  <strong>Flight:</strong>{" "}
                  {flights.find((f) => f.id === order.flightId)?.airline}
                </p>
                <p>
                  <strong>Hotel:</strong>{" "}
                  {hotels.find((h) => h.id === order.hotelId)?.name}
                </p>
                <p>
                  <strong>Check-in:</strong> {order.checkInDate.toDateString()}
                </p>
                <p>
                  <strong>Check-out:</strong>{" "}
                  {order.checkOutDate.toDateString()}
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
              <Button
                onClick={() => console.log("Order submitted:", order)}
                className="ml-auto"
              >
                Confirm Order
              </Button>
            )}
          </div>
        </div>
      </main>

      <footer className="py-6 w-full px-4 md:px-6 border-t">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 sm:mb-0">
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
