"use client";

import React, { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "./button";

interface CounterInputProps {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

const CounterInput: React.FC<CounterInputProps> = ({
  label,
  value,
  onIncrement,
  onDecrement,
}) => (
  <div className="flex items-center space-x-2">
    <span className="w-20">{label}</span>
    <Button
      variant="outline"
      size="icon"
      onClick={onDecrement}
      disabled={value <= 1}
    >
      <Minus className="h-4 w-4" />
    </Button>
    <input type="number" value={value} readOnly className="w-16 text-center" />
    <Button variant="outline" size="icon" onClick={onIncrement}>
      <Plus className="h-4 w-4" />
    </Button>
  </div>
);

export default function RoomsAndGuestsInput({
  initialGuests,
  initialRooms,
  onUnmount,
}: {
  initialGuests: number;
  initialRooms: number;
  onUnmount: ({ guests, rooms }: { guests: number; rooms: number }) => void;
}) {
  useEffect(() => {
    return () => {
      onUnmount({ guests, rooms });
    };
  }, []);

  const [rooms, setRooms] = useState(initialRooms);
  const [guests, setGuests] = useState(initialGuests);

  const incrementRooms = () => setRooms((prev) => prev + 1);
  const decrementRooms = () => setRooms((prev) => Math.max(1, prev - 1));
  const incrementGuests = () => setGuests((prev) => prev + 1);
  const decrementGuests = () => setGuests((prev) => Math.max(1, prev - 1));

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <CounterInput
        label="Rooms"
        value={rooms}
        onIncrement={incrementRooms}
        onDecrement={decrementRooms}
      />
      <CounterInput
        label="Guests"
        value={guests}
        onIncrement={incrementGuests}
        onDecrement={decrementGuests}
      />
    </div>
  );
}
