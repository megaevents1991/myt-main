"use client";

import React, { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "./button";

interface CounterInputProps {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  minValue?: number;
}

const CounterInput: React.FC<CounterInputProps> = ({
  label,
  value,
  onIncrement,
  onDecrement,
  minValue = 1,
}) => (
  <div className="flex items-center justify-between">
    <span className="w-20">{label}</span>
    <Button
      variant="outline"
      size="icon"
      onClick={onDecrement}
      disabled={+value <= minValue}
      aria-label={`הפחת ${label}`}
    >
      <Minus className="h-4 w-4" />
    </Button>
    <div className="w-16 text-center" role="status" aria-live="polite" aria-label={`${value} ${label}`}>{value}</div>
    <Button 
      variant="outline" 
      size="icon" 
      onClick={onIncrement}
      aria-label={`הוסף ${label}`}
    >
      <Plus className="h-4 w-4" />
    </Button>
  </div>
);

export default function RoomsAndGuestsInput({
  initialAdults,
  initialChildren = [],
  onChange,
}: {
  initialChildren: number[];
  initialAdults: number;
  onChange: ({
    adults,
    children,
  }: {
    adults: number;
    children: number[];
  }) => void;
}) {
  const [children, setChildren] = useState(initialChildren);
  const [adults, setAdults] = useState(initialAdults);

  useEffect(() => {
    onChange({ adults, children });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, adults]);

  const incrementChildren = () => setChildren((prev) => [...prev, 1]);
  const decrementChildren = () =>
    setChildren((prev) => {
      const next = [...prev];
      next.pop();
      return next;
    });
  const incrementGuests = () => setAdults((prev) => prev + 1);
  const decrementGuests = () => setAdults((prev) => Math.max(1, prev - 1));

  return (
    <div className="space-y-4 p-4 border rounded-md" dir="rtl">
      <CounterInput
        label="מבוגרים"
        value={adults}
        onIncrement={incrementGuests}
        onDecrement={decrementGuests}
      />
      <CounterInput
        label="ילדים"
        minValue={0}
        value={children.length}
        onIncrement={incrementChildren}
        onDecrement={decrementChildren}
      />
      <div className="flex items-start justify-between gap-1">
        <div>
          {children.length ? <div className="w-20">גילאים</div> : undefined}
        </div>
        <div
          style={{
            width: "-webkit-fill-available",
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "0.5rem",
          }}
        >
          {Array.from({ length: children.length }, (_, i) => (
            <ChildrenAgeSelect
              key={i}
              age={children[i]}
              onChange={(age) =>
                setChildren((prev) => [
                  ...prev.slice(0, i),
                  age,
                  ...prev.slice(i + 1),
                ])
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const ChildrenAgeSelect = ({
  onChange,
  age,
}: {
  onChange: (age: number) => void;
  age: number;
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(+e.target.value);
  };
  return (
    <select
      value={age}
      onChange={handleChange}
      className="text-center border border-gray-300 rounded-md px-2 py-1"
      aria-label="גיל ילד"
    >
      <option value="1">0-1</option>
      {Array.from({ length: 16 }, (_, i) => i).map((age) => (
        <option key={age + 2} value={age + 2}>
          {age + 2}
        </option>
      ))}
    </select>
  );
};
