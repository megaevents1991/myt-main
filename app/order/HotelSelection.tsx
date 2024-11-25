"use client";

import { Hotel, Order } from "@/lib/app.types";
import { useState, useEffect } from "react";

interface HotelSelectionProps {
  order: Order;
  updateOrder: (key: keyof Order, value: string | number) => void;
}

export default function HotelSelection({
  order,
  updateOrder,
}: HotelSelectionProps) {
  const [hotels, setHotels] = useState<Hotel[]>([]);

  useEffect(() => {
    async function fetchHotels() {
      const res = await fetch(`/api/hotels?eventId=${order.eventId}`);
      const data = await res.json();
      setHotels(data);
    }
    fetchHotels();
  }, [order.eventId]);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Select Your Hotel</h2>
      {hotels.map((hotel) => (
        <div key={hotel.id} className="mb-4 p-4 border rounded">
          <label className="flex items-center">
            <input
              type="radio"
              name="hotelId"
              value={hotel.id}
              checked={order.hotelId === hotel.id}
              onChange={(e) => updateOrder("hotelId", e.target.value)}
            />
            <span className="ml-2">
              {hotel.name} - ${hotel.price}/night - {hotel.rating} stars
            </span>
          </label>
        </div>
      ))}
    </div>
  );
}
