"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Checkbox } from "@mantine/core";
import { Sunset, Sun, Moon } from "lucide-react";
import { TimeRange } from "@/lib/app.types";

interface TimeBlockProps {
  label: string;
  time: string;
  icon?: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
}

const timeRangeMap: { [key: string]: TimeRange } = {
  morning: [
    { hours: 0, minutes: 0 },
    {
      hours: 12,
      minutes: 0,
    },
  ],
  afternoon: [
    { hours: 12, minutes: 0 },
    {
      hours: 18,
      minutes: 0,
    },
  ],
  evening: [
    { hours: 18, minutes: 0 },
    {
      hours: 23,
      minutes: 59,
    },
  ],
};

const TimeBlock = ({
  label,
  time,
  icon,
  selected,
  onClick,
}: TimeBlockProps) => (
  <div
    onClick={onClick}
    className={cn(
      "flex flex-col items-center p-2 rounded-lg cursor-pointer transition-colors",
      selected ? "bg-primary/10" : "hover:bg-primary/5"
    )}
  >
    {icon}
    <div className="text-lg font-medium text-right">{label}</div>
    <div className="text-sm text-muted-foreground">{time}</div>
  </div>
);

export const FlightFilter = ({
  airlines,
  handleFilterChange,
  filters,
  handleTimeRangeChange,
  flightDurationComponent,
  priceComponent,
}: {
  priceComponent: React.ReactNode;
  flightDurationComponent: React.ReactNode;
  airlines: { label: string; value: string }[];
  handleTimeRangeChange: ({
    range,
    name,
  }: {
    range: TimeRange[] | [];
    name: "arrival" | "departure";
  }) => void;
  handleFilterChange: (key: string, value: string | boolean | string[]) => void;
  filters: {
    numOfStops: string[];
    airline: string[];
    maxPrice: string;
  };
}) => {
  const [departureTime, setDepartureTime] = React.useState<string[]>([]);
  const [arrivalTime, setArrivalTime] = React.useState<string[]>([]);

  const setAirline = (value: string[]) => {
    handleFilterChange("airline", value);
  };

  const handleStopsChange = (value: string[]) => {
    handleFilterChange("numOfStops", value);
  };

  const handleTimeChange = ({
    range,
    state,
  }: {
    range: "morning" | "afternoon" | "evening";
    state: "departure" | "arrival";
  }) => {
    if (state === "departure") {
      const newRange = departureTime.includes(range)
        ? departureTime.filter((item) => item !== range)
        : [...departureTime, range];
      setDepartureTime(newRange);
      handleTimeRangeChange({
        range: newRange.map((item) => timeRangeMap[item]),
        name: state,
      });
    } else {
      const newRange = arrivalTime.includes(range)
        ? arrivalTime.filter((item) => item !== range)
        : [...arrivalTime, range];
      setArrivalTime(newRange);
      handleTimeRangeChange({
        range: newRange.map((item) => timeRangeMap[item]),
        name: state,
      });
    }
  };

  return (
    <div className="w-full max-w-md p-6 space-y-8">
      {/* Stops Section */}
      <div dir="rtl">
        <h3 className="text-lg font-semibold mb-4">עצירות</h3>
        <Checkbox.Group value={filters.numOfStops} onChange={handleStopsChange}>
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox value="0" id="direct" />
            <label htmlFor="direct">טיסה ישירה</label>
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox value="1" id="one-stop" />
            <label htmlFor="one-stop">עצירה אחת</label>
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox value="2" id="multi-stop" />
            <label htmlFor="multi-stop">אחת ויותר</label>
          </div>
        </Checkbox.Group>
      </div>

      {/* Departure Time Section */}
      <div dir="rtl">
        <h3 className="text-lg font-semibold mb-4">זמן המראה</h3>
        <div className="grid grid-cols-3 gap-4">
          <TimeBlock
            label="בוקר"
            icon={<Sun size={38} />}
            time="00:00-12:00"
            selected={departureTime.includes("morning")}
            onClick={() => {
              handleTimeChange({
                range: "morning",
                state: "departure",
              });
            }}
          />
          <TimeBlock
            label="צהריים"
            icon={<Sunset size={38} />}
            time="12:00-18:00"
            selected={departureTime.includes("afternoon")}
            onClick={() => {
              handleTimeChange({
                range: "afternoon",
                state: "departure",
              });
            }}
          />
          <TimeBlock
            label="ערב"
            icon={<Moon size={38} />}
            time="18:00-00:00"
            selected={departureTime.includes("evening")}
            onClick={() => {
              handleTimeChange({
                range: "evening",
                state: "departure",
              });
            }}
          />
        </div>
      </div>

      {/* Arrival Time Section */}
      <div dir="rtl">
        <h3 className="text-lg font-semibold mb-4">זמן הגעה</h3>
        <div className="grid grid-cols-3 gap-4">
          <TimeBlock
            label="בוקר"
            icon={<Sun size={38} />}
            time="00:00-12:00"
            selected={arrivalTime.includes("morning")}
            onClick={() => {
              handleTimeChange({
                range: "morning",
                state: "arrival",
              });
            }}
          />
          <TimeBlock
            label="צהריים"
            time="12:00-18:00"
            icon={<Sunset size={38} />}
            selected={arrivalTime.includes("afternoon")}
            onClick={() => {
              handleTimeChange({
                range: "afternoon",
                state: "arrival",
              });
            }}
          />
          <TimeBlock
            label="ערב"
            icon={<Moon size={38} />}
            time="18:00-00:00"
            selected={arrivalTime.includes("evening")}
            onClick={() => {
              handleTimeChange({
                range: "evening",
                state: "arrival",
              });
            }}
          />
        </div>
      </div>
      <div className="mx-10"></div>

      {/* Price Range Section */}
      <div>{priceComponent}</div>

      {/* Duration Section */}
      <div>{flightDurationComponent}</div>

      {/* Airlines Section */}
      <div dir="rtl">
        <h3 className="text-lg font-semibold mb-4">חברת תעופה</h3>
        <Checkbox.Group value={filters.airline} onChange={setAirline}>
          {airlines.map(({ label, value }) => (
            <Checkbox
              value={value}
              id={label}
              label={label}
              key={label}
              className="my-2"
            />
          ))}
        </Checkbox.Group>
      </div>
    </div>
  );
};
