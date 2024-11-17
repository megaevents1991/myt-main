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
import { Ticket } from "lucide-react";
//CalendarDays, CreditCard, Hotel, Plane,
export default function OrderPage() {
  const [step, setStep] = useState(1);
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [flightOption, setFlightOption] = useState("");
  const [hotelOption, setHotelOption] = useState("");

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handlePrevious = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center justify-between border-b">
        <Link className="flex items-center justify-center" href="/">
          <Ticket className="h-6 w-6 mr-2" />
          <span className="text-lg font-bold">MYT Events</span>
        </Link>
        <nav className="flex gap-4 sm:gap-6">
          <Link
            className="text-sm font-medium hover:underline underline-offset-4"
            href="/"
          >
            Home
          </Link>
        </nav>
      </header>
      <main className="flex-1 py-12 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Book Your Event Package</h1>
          <div className="mb-8">
            <div className="flex justify-between items-center">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`flex items-center ${
                    i <= step ? "text-primary" : "text-gray-400"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                      i <= step ? "border-primary" : "border-gray-400"
                    }`}
                  >
                    {i}
                  </div>
                  {i < 4 && (
                    <div
                      className={`h-1 w-full ${
                        i < step ? "bg-primary" : "bg-gray-400"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-sm">Tickets</span>
              <span className="text-sm">Flights</span>
              <span className="text-sm">Hotel</span>
              <span className="text-sm">Payment</span>
            </div>
          </div>
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Select Tickets</h2>
              <div className="flex items-center space-x-4">
                <Label htmlFor="ticket-quantity">Quantity:</Label>
                <Input
                  id="ticket-quantity"
                  type="number"
                  min="1"
                  max="10"
                  value={ticketQuantity}
                  onChange={(e) => setTicketQuantity(parseInt(e.target.value))}
                  className="w-20"
                />
              </div>
              <p>Price per ticket: $100</p>
              <p className="font-bold">Total: ${ticketQuantity * 100}</p>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Choose Flight</h2>
              <RadioGroup value={flightOption} onValueChange={setFlightOption}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="economy" id="economy" />
                  <Label htmlFor="economy">Economy ($200)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="business" id="business" />
                  <Label htmlFor="business">Business ($500)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="first" id="first" />
                  <Label htmlFor="first">First Class ($1000)</Label>
                </div>
              </RadioGroup>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Select Hotel</h2>
              <Select value={hotelOption} onValueChange={setHotelOption}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a hotel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="budget">
                    Budget Hotel ($50/night)
                  </SelectItem>
                  <SelectItem value="standard">
                    Standard Hotel ($100/night)
                  </SelectItem>
                  <SelectItem value="luxury">
                    Luxury Hotel ($200/night)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Payment Details</h2>
              <div className="space-y-2">
                <Label htmlFor="card-number">Card Number</Label>
                <Input
                  id="card-number"
                  type="text"
                  placeholder="1234 5678 9012 3456"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry-date">Expiry Date</Label>
                  <Input id="expiry-date" type="text" placeholder="MM/YY" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvv">CVV</Label>
                  <Input id="cvv" type="text" placeholder="123" />
                </div>
              </div>
            </div>
          )}
          <div className="mt-8 flex justify-between">
            {step > 1 && (
              <Button onClick={handlePrevious} variant="outline">
                Previous
              </Button>
            )}
            {step < 4 ? (
              <Button onClick={handleNext} className="ml-auto">
                Next
              </Button>
            ) : (
              <Button
                onClick={() => alert("Order placed successfully!")}
                className="ml-auto"
              >
                Place Order
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
