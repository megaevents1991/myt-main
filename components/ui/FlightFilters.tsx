"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Checkbox } from "@mantine/core";
import { Sunset, Sun, Moon } from "lucide-react";
import { FlightSearchCriteria, TimeRange } from "@/lib/app.types";

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
    <div className="text-xs text-muted-foreground whitespace-nowrap">
      {time}
    </div>
  </div>
);

export const FlightFilters = ({
  airlines,
  filters,
  flightDurationComponent,
  priceComponent,
  handleFlightSearchCriteriaChange,
}: {
  priceComponent: React.ReactNode;
  flightDurationComponent: React.ReactNode;
  airlines: { label: string; value: string }[];
  handleFlightSearchCriteriaChange: (criteria: FlightSearchCriteria) => void;
  filters: {
    numOfStops: string[];
    airline: string[];
    maxPrice: string;
    luggage: string[];
  };
}) => {
  const [departureTime, setDepartureTime] = React.useState<string[]>([]);
  const [arrivalTime, setArrivalTime] = React.useState<string[]>([]);

  const handleTimeChange = ({
    range,
    state,
  }: {
    range: "morning" | "afternoon" | "evening";
    state: "departureRanges" | "arrivalRanges";
  }) => {
    if (state === "departureRanges") {
      const newRange = departureTime.includes(range)
        ? departureTime.filter((item) => item !== range)
        : [...departureTime, range];
      setDepartureTime(newRange);
      handleFlightSearchCriteriaChange({
        value: newRange.map((item) => timeRangeMap[item]),
        type: "departureRanges",
      });
    } else {
      const newRange = arrivalTime.includes(range)
        ? arrivalTime.filter((item) => item !== range)
        : [...arrivalTime, range];
      setArrivalTime(newRange);
      handleFlightSearchCriteriaChange({
        value: newRange.map((item) => timeRangeMap[item]),
        type: "arrivalRanges",
      });
    }
  };

  return (
    <div className="w-full p-4 space-y-4 border-2 border-gray-200 shadow-lg rounded-lg">
      {/* Stops Section */}
      <div dir="rtl" className="px-2">
        <h3 className="text-lg font-semibold mb-2">עצירות</h3>
        <Checkbox.Group
          value={filters.numOfStops}
          onChange={(value) =>
            handleFlightSearchCriteriaChange({ type: "numOfStops", value })
          }
        >
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox value="0" id="direct" />
            <label htmlFor="direct">טיסה ישירה</label>
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox value="1" id="one-stop" />
            <label htmlFor="one-stop">עצירה אחת</label>
          </div>
        </Checkbox.Group>
      </div>
      {/* Luggage */}
      <div dir="rtl" className="px-2">
        <h3 className="text-lg font-semibold mb-2">כבודה</h3>
        <Checkbox.Group
          value={filters.luggage}
          onChange={(value) =>
            handleFlightSearchCriteriaChange({ type: "luggage", value })
          }
        >
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox value="withLuggage" id="one-stop" />
            <label htmlFor="one-stop">כולל מזוודה</label>
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox value="withoutLuggage" id="multi-stop" />
            <label htmlFor="multi-stop">תיק בלבד</label>
          </div>
        </Checkbox.Group>
      </div>
      <div className="px-2">
        <h3 dir="rtl" className="text-lg font-semibold mb-4">
          ננסה לחסוך?
        </h3>
        {priceComponent}
      </div>
      <div className="px-2">
        <h3 dir="rtl" className="text-lg mt-8 font-semibold mb-4">
          משך זמן טיסה
        </h3>
        {flightDurationComponent}
      </div>
      {/* Departure Time Section */}
      <div dir="rtl" className="px-2">
        <h3 className="text-lg font-semibold mt-8 mb-2">זמן המראה</h3>
        <div className="grid grid-cols-3 gap-4">
          <TimeBlock
            label="בוקר"
            icon={<Sun size={38} strokeWidth={1} />}
            time="00:00-12:00"
            selected={departureTime.includes("morning")}
            onClick={() => {
              handleTimeChange({
                range: "morning",
                state: "departureRanges",
              });
            }}
          />
          <TimeBlock
            label="צהריים"
            icon={<Sunset size={38} strokeWidth={1} />}
            time="12:00-18:00"
            selected={departureTime.includes("afternoon")}
            onClick={() => {
              handleTimeChange({
                range: "afternoon",
                state: "departureRanges",
              });
            }}
          />
          <TimeBlock
            label="ערב"
            icon={<Moon size={38} strokeWidth={1} />}
            time="18:00-00:00"
            selected={departureTime.includes("evening")}
            onClick={() => {
              handleTimeChange({
                range: "evening",
                state: "departureRanges",
              });
            }}
          />
        </div>
      </div>
      {/* Arrival Time Section */}
      <div dir="rtl" className="px-2">
        <h3 className="text-lg font-semibold mb-2">זמן הגעה</h3>
        <div className="grid grid-cols-3 gap-4">
          <TimeBlock
            label="בוקר"
            icon={<Sun size={38} strokeWidth={1} />}
            time="00:00-12:00"
            selected={arrivalTime.includes("morning")}
            onClick={() => {
              handleTimeChange({
                range: "morning",
                state: "arrivalRanges",
              });
            }}
          />
          <TimeBlock
            label="צהריים"
            time="12:00-18:00"
            icon={<Sunset size={38} strokeWidth={1} />}
            selected={arrivalTime.includes("afternoon")}
            onClick={() => {
              handleTimeChange({
                range: "afternoon",
                state: "arrivalRanges",
              });
            }}
          />
          <TimeBlock
            label="ערב"
            icon={<Moon size={38} strokeWidth={1} />}
            time="18:00-00:00"
            selected={arrivalTime.includes("evening")}
            onClick={() => {
              handleTimeChange({
                range: "evening",
                state: "arrivalRanges",
              });
            }}
          />
        </div>
      </div>
      {/* Airlines Section */}
      <div dir="rtl" className="px-2">
        <h3 className="text-lg font-semibold mt-4 mb-2">חברות תעופה</h3>
        <Checkbox.Group
          value={filters.airline}
          onChange={(value) =>
            handleFlightSearchCriteriaChange({ type: "airline", value })
          }
        >
          {airlines.map(({ label, value }, i) => (
            <Checkbox
              value={value}
              id={label}
              label={label}
              key={i}
              className="my-2"
            />
          ))}
        </Checkbox.Group>
      </div>
    </div>
  );
};
