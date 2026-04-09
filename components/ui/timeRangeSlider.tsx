import React, { useState } from "react";
import { RangeSlider, Text } from "@mantine/core";
import { TimeRange } from "@/lib/app.types";

const formatTime = (value: number) => {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return { hours, minutes };
};

// Convert slider values to time format (e.g., 12:00 AM, 1:00 PM)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const convertToAMPM = (hour: number, minutes: number) => {
  const period = hour >= 12 ? "PM" : "AM";
  const adjustedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${adjustedHour}:${
    minutes.toString().length === 1 ? "0" + minutes : minutes
  } ${period}`;
};

export const TimeRangeSlider = ({
  onChangeEnd,
}: {
  onChangeEnd: (value: TimeRange) => void;
}) => {
  const [value, setValue] = useState<[number, number]>([0, 1439]); // Initial range: 12 AM to 12 AM
  const handleOnChangeEnd = (value: [number, number]) => {
    onChangeEnd([formatTime(value[0]), formatTime(value[1])]);
  };

  const handleOnChange = (value: [number, number]) => {
    setValue(value);
  };

  return (
    <div style={{ maxWidth: 400, margin: "auto", padding: 20 }}>
      <Text mb="xs">
        Selected time range:{" "}
        {convertToAMPM(
          formatTime(value[0]).hours,
          formatTime(value[0]).minutes
        )}
        -{" "}
        {convertToAMPM(
          formatTime(value[1]).hours,
          formatTime(value[1]).minutes
        )}
      </Text>
      <RangeSlider
        min={0}
        max={1439}
        onChangeEnd={handleOnChangeEnd}
        value={value}
        onChange={handleOnChange}
        step={30}
        marks={[
          { value: 0, label: "12:00 AM" },
          { value: 720, label: "12:00 PM" },
          { value: 1439, label: "11:59 PM" },
        ]}
        label={null}
      />
    </div>
  );
};
